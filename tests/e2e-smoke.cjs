// Real PeerJS + WebRTC on loopback. Only screen/input/clipboard are synthetic.
// The receiver writes actual chunks through the production FileReceiver.
const { app, BrowserWindow, ipcMain } = require('electron');
const { WebSocketServer } = require('ws');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { FileReceiver } = require('../src/core/file-store');
const root = path.resolve(__dirname, '..');
app.setPath('userData', path.join(root, 'review', 'e2e-test-profile'));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const states = new Map();
const windows = [];
let server;
const watchdog = setTimeout(() => {
  console.error('E2E timeout');
  app.exit(1);
}, 60000);
app
  .whenReady()
  .then(async () => {
    const peers = new Map();
    server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise((r) => server.once('listening', r));
    server.on('connection', (socket, request) => {
      const id = new URL(request.url, 'http://127.0.0.1').searchParams.get('id');
      peers.set(id, socket);
      socket.send(JSON.stringify({ type: 'OPEN' }));
      socket.on('message', (raw) => {
        const packet = JSON.parse(raw);
        if (packet.type === 'HEARTBEAT') return;
        const destination = peers.get(packet.dst);
        if (destination?.readyState === 1) destination.send(JSON.stringify({ ...packet, src: id }));
        else socket.send(JSON.stringify({ type: 'EXPIRE', src: packet.dst }));
      });
      socket.on('close', () => peers.delete(id));
    });
    const runDirectory = await fs.mkdtemp(path.join(root, 'review', 'e2e-run-'));
    ipcMain.handle('e2e-api', async (event, method, ...args) => {
      const s = states.get(event.sender.id);
      switch (method) {
        case 'info':
          return { name: s.name, version: require('../package.json').version };
        case 'sources':
          return [
            { id: 'screen:1', displayId: '1', width: 640, height: 360, thumbnail: '' },
            { id: 'screen:2', displayId: '2', width: 800, height: 600, thumbnail: '' },
          ];
        case 'begin':
          s.session = { ...args[0], token: crypto.randomUUID() };
          return s.session.token;
        case 'end':
          s.session = null;
          await s.receiver.cancel();
          return;
        case 'permissions':
          Object.assign(s.session, args[1]);
          return;
        case 'videoState':
          Object.assign(s.session, args[1], { inputPaused: true });
          s.videoTransitions++;
          return;
        case 'videoReady':
          if (s.session.videoKey !== args[1]) return false;
          s.session.inputPaused = false;
          return true;
        case 'input':
          if (s.session?.input && !s.session.inputPaused && args[1].videoKey === s.session.videoKey)
            s.inputs.push(args[1]);
          return;
        case 'cursor':
          return s.cursor;
        case 'pointer':
          if (
            !s.session?.inputPaused &&
            s.session?.pointerEnabled !== false &&
            args[1].videoKey === s.session.videoKey
          )
            s.pointers.push(args[1]);
          return true;
        case 'pointerEnabled':
          s.session.pointerEnabled = args[1];
          return;
        case 'clipboardRead':
          return s.session?.clipboard ? s.clipboard : null;
        case 'clipboardWrite':
          if (s.session?.clipboard) {
            s.clipboard = args[1];
            s.writes.push(args[1]);
          }
          return;
        case 'clipboardPermission':
          s.session.clipboard = args[1];
          return;
        case 'copyId':
        case 'fullscreen':
          return;
        case 'selectFile':
          s.offset = 0;
          s.fileId = crypto.randomUUID();
          return { id: s.fileId, name: 'loopback.bin', size: s.payload.length };
        case 'readFile': {
          if (s.offset === s.payload.length)
            return {
              done: true,
              hash: crypto.createHash('sha256').update(s.payload).digest('hex'),
            };
          const chunk = s.payload.subarray(s.offset, s.offset + 32768);
          s.offset += chunk.length;
          return { done: false, data: chunk.toString('base64'), bytes: s.offset };
        }
        case 'beginFile':
          return s.receiver.begin(args[1]);
        case 'writeChunk':
          return s.receiver.chunk(args[1], args[2], args[3]);
        case 'finishFile': {
          const result = await s.receiver.finish(args[1], args[2]);
          s.saved.push(result);
          return result;
        }
        case 'cancelFile':
          return s.receiver.cancel();
        default:
          throw Error('Unknown test API: ' + method);
      }
    });
    const port = server.address().port;
    const bootstrap = `
    const RealPeer = window.Peer;
    window.Peer = class extends RealPeer {
      constructor(id, options) { super(id, { ...options, host: '127.0.0.1', port: ${port}, path: '/', secure: false, config: { iceServers: [] } }); window.testPeer=this; }
    };
    localStorage.setItem('menzil_preferences_v3', JSON.stringify({quality:'balanced',clipboard:true}));
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async (options) => {
      if(window.failCapture) throw Error('Test: ekran yakalanamadı');
      if(window.holdCapture) await new Promise(resolve=>window.finishCapture=resolve);
      const c=document.createElement('canvas'); c.width=options.video.mandatory.maxWidth; c.height=options.video.mandatory.maxHeight;
      const ctx=c.getContext('2d'); let frame=0;
      window.patternCanvas=c;
      const timer=setInterval(()=>{ctx.fillStyle=frame++%2?'#51684c':'#263324';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#fff';ctx.fillText('RK Screen loopback '+frame,20,30);
        ctx.fillStyle='#fff';ctx.fillRect(16,48,220,72);ctx.fillStyle='#000';ctx.font='12px sans-serif';ctx.fillText('RK Screen | Küçük metin 012345',22,67);
        for(let x=22;x<225;x+=6)ctx.fillRect(x,78,1,32);
      },100);
      const captured=c.captureStream(10);
      const originalStop=captured.getVideoTracks()[0].stop.bind(captured.getVideoTracks()[0]);
      captured.getVideoTracks()[0].stop=()=>{clearInterval(timer);originalStop();};
      window.testStreams ??= []; window.testStreams.push(captured);
      return captured;
    }});
  `;
    await fs.writeFile(path.join(root, 'review', 'e2e-bootstrap.js'), bootstrap);
    const html = (await fs.readFile(path.join(root, 'index.html'), 'utf8'))
      .replaceAll('src="src/', 'src="../src/')
      .replaceAll('href="src/', 'href="../src/')
      .replace('https: wss:', `https: wss: ws://127.0.0.1:${port}`)
      .replace(
        '<script src="../src/renderer.js"',
        '<script src="e2e-bootstrap.js" defer></script><script src="../src/renderer.js"',
      );
    const fixture = path.join(root, 'review', 'e2e-fixture.html');
    await fs.writeFile(fixture, html);
    const errors = [];
    for (let i = 0; i < 2; i++) {
      const dir = path.join(runDirectory, String(i));
      await fs.mkdir(dir);
      const win = new BrowserWindow({
        show: false,
        width: 1160,
        height: 790,
        webPreferences: {
          preload: path.join(__dirname, 'e2e-preload.cjs'),
          sandbox: true,
          contextIsolation: true,
          partition: 'e2e-' + i,
          backgroundThrottling: false,
        },
      });
      windows.push(win);
      states.set(win.webContents.id, {
        name: i ? 'Enes' : 'RK',
        session: null,
        inputs: [],
        pointers: [],
        cursor: { x: 0.5, y: 0.5, visible: true },
        videoTransitions: 0,
        writes: [],
        clipboard: 'private baseline ' + i,
        payload: i ? crypto.randomBytes(100123) : Buffer.alloc(0),
        receiver: new FileReceiver(dir),
        saved: [],
      });
      win.webContents.on('console-message', (details) => {
        if (details.level === 'error') errors.push(details.message);
      });
      await win.loadFile(fixture);
    }
    const [host, controller] = windows;
    const hostState = states.get(host.webContents.id),
      controllerState = states.get(controller.webContents.id);
    const run = (w, code) =>
      w.webContents.executeJavaScript(code.trim().endsWith(';') ? '(()=>{' + code + '})()' : code);
    const wait = async (w, code) => {
      for (let i = 0; i < 200; i++) {
        if (await run(w, code)) return;
        await delay(50);
      }
      throw Error('Timeout: ' + code);
    };
    try {
      for (const w of windows)
        await wait(w, "document.getElementById('network-label').textContent==='Bağlantıya hazır'");
      const id = await run(host, "document.getElementById('device-id').textContent");
      await run(
        controller,
        `document.getElementById('remote-id').value=${JSON.stringify(id)};document.getElementById('connect-form').dispatchEvent(new Event('submit',{cancelable:true}));`,
      );
      await wait(
        host,
        "document.getElementById('incoming-dialog').open && !document.getElementById('accept').disabled",
      );
      assert.equal(hostState.session, null);
      await run(
        host,
        "document.getElementById('allow-input').checked=true;document.getElementById('allow-clipboard').checked=true;document.getElementById('accept').click();",
      );
      await wait(
        controller,
        "document.getElementById('remote-video').videoWidth===640 && document.getElementById('remote-video').currentTime>0.2",
      );
      console.log('E2E video received: 640x360 over real WebRTC');
      await wait(controller, "!document.getElementById('remote-cursor').hidden");
      assert.equal(
        await run(controller, "document.getElementById('cursor-name').textContent"),
        'RK',
      );
      const cursorStarted = Date.now();
      hostState.cursor = { x: 0.62, y: 0.3, visible: true };
      await wait(
        controller,
        "parseFloat(document.getElementById('remote-cursor').style.left)>document.getElementById('video-stage').clientWidth*0.55",
      );
      assert.ok(
        Date.now() - cursorStarted < 1500,
        'cursor should not wait for the 2-second heartbeat',
      );
      const keyBeforeRecovery = hostState.session.videoKey;
      const sessionBeforeRecovery = hostState.session.token;
      await run(
        controller,
        "window.interruptedCall=Object.values(testPeer.connections).flat().find(c=>c.type==='media');Object.defineProperty(interruptedCall.peerConnection,'connectionState',{configurable:true,value:'disconnected'});interruptedCall.peerConnection.dispatchEvent(new Event('connectionstatechange'));",
      );
      await wait(controller, "!document.getElementById('video-wait').hidden");
      await delay(250);
      assert.equal(
        hostState.session.inputPaused,
        true,
        'outage pauses native input before rebuilding',
      );
      assert.equal(
        hostState.session.videoKey,
        keyBeforeRecovery,
        'recovery waits before rotating key',
      );
      await run(
        controller,
        "Object.values(testPeer.connections).flat().find(c=>c.type==='data'&&c.open).send({type:'chat',id:'during-recovery',text:'Kesinti sırasında sohbet'});",
      );
      await wait(
        host,
        "document.getElementById('chat-messages').textContent.includes('Kesinti sırasında sohbet')",
      );
      await delay(4100);
      await wait(
        controller,
        "document.getElementById('video-wait').hidden && document.getElementById('remote-video').currentTime>0.2",
      );
      assert.notEqual(hostState.session.videoKey, keyBeforeRecovery);
      assert.equal(
        hostState.session.token,
        sessionBeforeRecovery,
        'approval survives media recovery',
      );
      assert.equal(hostState.session.inputPaused, false);
      await run(host, "document.getElementById('close-chat').click();");
      console.log(
        'E2E automatic video recovery: paused input, preserved chat/approval, new key and decoded frames',
      );
      await run(controller, "document.getElementById('refresh-video').click();");
      await wait(
        controller,
        "document.getElementById('remote-video').videoWidth===640 && document.getElementById('remote-video').currentTime>0.2 && document.getElementById('video-wait').hidden",
      );
      await run(
        controller,
        "document.getElementById('quality').value='detail';document.getElementById('quality').dispatchEvent(new Event('change'));",
      );
      await wait(
        host,
        "Object.values(testPeer.connections).flat().filter(c=>c.type==='media').some(c=>c.peerConnection.getSenders().some(s=>s.getParameters().encodings?.[0]?.maxBitrate===20000000))",
      );
      assert.equal(await run(host, 'testStreams[0].getVideoTracks()[0].contentHint'), 'text');
      await run(
        controller,
        "document.getElementById('quality').value='fluid';document.getElementById('quality').dispatchEvent(new Event('change'));",
      );
      await wait(
        host,
        "Object.values(testPeer.connections).flat().filter(c=>c.type==='media').some(c=>c.peerConnection.getSenders().some(s=>s.getParameters().encodings?.[0]?.maxFramerate===60 && s.getParameters().encodings?.[0]?.maxBitrate===24000000))",
      );
      assert.equal(await run(host, 'testStreams[0].getVideoTracks()[0].contentHint'), 'motion');
      await run(
        host,
        "window.adaptivePc=Object.values(testPeer.connections).flat().find(c=>c.type==='media').peerConnection;window.realStats=adaptivePc.getStats.bind(adaptivePc);adaptivePc.getStats=async()=>{const report=await realStats();return new Map([...report].map(([id,r])=>[id,r.type==='candidate-pair'?{...r,availableOutgoingBitrate:2000000}:r.type==='outbound-rtp'&&r.kind==='video'?{...r,qualityLimitationReason:'cpu'}:r]));};",
      );
      await wait(
        host,
        'adaptivePc.getSenders().some(s=>s.getParameters().encodings?.[0]?.maxBitrate===1700000 && s.getParameters().encodings?.[0]?.maxFramerate===30)',
      );
      await run(host, 'adaptivePc.getStats=realStats;');
      console.log(
        'E2E adaptive sender: simulated low bandwidth/CPU evidence applied to real encoder',
      );
      await run(
        controller,
        "document.getElementById('quality').value='detail';document.getElementById('quality').dispatchEvent(new Event('change'));",
      );
      await wait(
        controller,
        "document.getElementById('quality-status').textContent.includes('Kaynak 640×360')",
      );
      await delay(500);
      const reference = await run(
        host,
        'Array.from(patternCanvas.getContext("2d").getImageData(16,48,220,72).data)',
      );
      const decoded = await run(
        controller,
        '(()=>{const c=document.createElement("canvas");c.width=220;c.height=72;const g=c.getContext("2d");g.drawImage(document.getElementById("remote-video"),16,48,220,72,0,0,220,72);return Array.from(g.getImageData(0,0,220,72).data);})()',
      );
      let mse = 0;
      for (let i = 0; i < reference.length; i += 4) {
        const d = reference[i] - decoded[i];
        mse += d * d;
      }
      mse /= reference.length / 4;
      const patternPsnr = Number(
        (10 * Math.log10((255 * 255) / Math.max(mse, 0.00001))).toFixed(1),
      );
      assert.ok(patternPsnr >= 24, 'text/line fixture quality regressed: ' + patternPsnr + ' dB');
      await run(
        controller,
        `
        const v=document.getElementById('viewport'),r=document.getElementById('video-stage').getBoundingClientRect();
        v.focus();v.setPointerCapture=()=>{};v.hasPointerCapture=()=>false;
        v.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width/2-10,clientY:r.top+r.height/2}));
        v.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width/2+20,clientY:r.top+r.height/2}));
        v.dispatchEvent(new KeyboardEvent('keydown',{key:'ş',code:'Semicolon',cancelable:true}));
        v.dispatchEvent(new KeyboardEvent('keyup',{key:'ş',code:'Semicolon',cancelable:true}));
        v.dispatchEvent(new KeyboardEvent('keydown',{key:'Control',code:'ControlLeft',ctrlKey:true,cancelable:true}));
        v.dispatchEvent(new KeyboardEvent('keydown',{key:'c',code:'KeyC',ctrlKey:true,cancelable:true}));
        v.dispatchEvent(new KeyboardEvent('keyup',{key:'c',code:'KeyC',ctrlKey:true,cancelable:true}));
        v.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
        v.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,button:0,clientX:r.left+r.width/2+50,clientY:r.top+r.height/2}));
        v.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:1}));
        v.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',code:'ControlLeft',cancelable:true}));
      `,
      );
      await delay(200);
      assert.ok(hostState.inputs.some((m) => m.type === 'text' && m.text === 'ş'));
      assert.ok(hostState.inputs.some((m) => m.type === 'key' && m.code === 'KeyC' && m.pressed));
      assert.equal(hostState.inputs.filter((m) => m.type === 'mouse-button').length, 2);
      const upIndex = hostState.inputs.findIndex((m) => m.type === 'mouse-button' && !m.pressed);
      const ctrlUp = hostState.inputs.findIndex(
        (m) => m.type === 'key' && m.code === 'ControlLeft' && !m.pressed,
      );
      assert.equal(
        hostState.inputs.slice(upIndex, ctrlUp).some((m) => m.type === 'release-input'),
        false,
      );
      await run(
        controller,
        `const v=document.getElementById('viewport'),r=document.getElementById('video-stage').getBoundingClientRect();v.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width/2,clientY:r.top+r.height/2}));v.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width/2+10,clientY:r.top+r.height/2}));`,
      );
      await delay(100);
      assert.ok(hostState.inputs.filter((m) => m.type === 'mouse-move').at(-1).x > 0.5);
      await run(
        controller,
        "document.getElementById('input-mode').value='view';document.getElementById('input-mode').dispatchEvent(new Event('change'));",
      );
      await delay(100);
      const beforePointer = hostState.inputs.length;
      await run(
        controller,
        "const v=document.getElementById('viewport'),r=document.getElementById('video-stage').getBoundingClientRect();v.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width/2,clientY:r.top+r.height/2}));",
      );
      for (let i = 0; i < 30 && !hostState.pointers.some((p) => p.visible); i++) await delay(20);
      assert.ok(hostState.pointers.some((p) => p.visible));
      assert.equal(
        hostState.inputs.length,
        beforePointer,
        'view-only pointer must not inject input',
      );
      assert.equal(hostState.session.remoteName, 'Enes');
      await wait(
        controller,
        "document.getElementById('session-state').textContent.includes('Yalnızca izleme')",
      );
      await run(
        host,
        "document.getElementById('host-input').checked=false;document.getElementById('host-input').dispatchEvent(new Event('change'));",
      );
      await wait(controller, "document.getElementById('input-mode').disabled");
      await run(
        host,
        "document.getElementById('host-input').checked=true;document.getElementById('host-input').dispatchEvent(new Event('change'));",
      );
      await wait(
        controller,
        "!document.getElementById('input-mode').disabled && document.getElementById('input-mode').value==='control'",
      );
      await run(
        controller,
        "document.getElementById('chat-input').value='Gerçek bağlantı mesajı';document.getElementById('chat-form').dispatchEvent(new Event('submit',{cancelable:true}));",
      );
      await wait(
        host,
        "document.getElementById('chat-messages').textContent.includes('Gerçek bağlantı mesajı')",
      );
      await wait(
        controller,
        "document.querySelector('.chat-delivery')?.textContent==='Teslim edildi'",
      );
      const sentId = await run(
        controller,
        "document.querySelector('.chat-bubble.mine').dataset.messageId",
      );
      await run(
        controller,
        `Object.values(testPeer.connections).flat().find(c=>c.type==='data'&&c.open).send({type:'chat',id:${JSON.stringify(sentId)},text:'Gerçek bağlantı mesajı'});`,
      );
      await delay(100);
      assert.equal(await run(host, "document.querySelectorAll('.chat-bubble').length"), 2);
      await run(
        controller,
        "document.getElementById('scale').value='original';document.getElementById('scale').dispatchEvent(new Event('change'));",
      );
      await delay(100);
      assert.ok(
        await run(
          controller,
          "Math.abs(document.getElementById('video-stage').getBoundingClientRect().width*devicePixelRatio-document.getElementById('remote-video').videoWidth)<2",
        ),
      );
      await run(
        controller,
        "document.getElementById('scale').value='fit';document.getElementById('scale').dispatchEvent(new Event('change'));",
      );
      await run(
        host,
        `const c=Object.values(testPeer.connections).flat().find(c=>c.type==='data'&&c.open);const original=c.send.bind(c);window.dropChatAck=true;c.send=m=>{if(m.type==='chat-ack'&&window.dropChatAck)return;original(m);};`,
      );
      await run(
        controller,
        "document.getElementById('chat-input').value='İlk satır\\nİkinci satır';document.getElementById('chat-form').dispatchEvent(new Event('submit',{cancelable:true}));",
      );
      await wait(
        host,
        "Array.from(document.querySelectorAll('.chat-text')).some(e=>e.textContent==='İlk satır\\nİkinci satır')",
      );
      await delay(10100);
      await wait(controller, "!document.querySelectorAll('.chat-retry')[1].hidden");
      await run(host, 'window.dropChatAck=false;');
      await run(controller, "document.querySelectorAll('.chat-retry')[1].click();");
      await wait(
        controller,
        "document.querySelectorAll('.chat-delivery')[1].textContent==='Teslim edildi'",
      );
      assert.equal(await run(host, "document.querySelectorAll('.chat-bubble').length"), 3);
      await delay(1600);
      assert.deepEqual(hostState.writes, []);
      assert.deepEqual(controllerState.writes, []);
      controllerState.clipboard = 'new loopback text';
      for (let i = 0; i < 60 && !hostState.writes.includes('new loopback text'); i++)
        await delay(100);
      assert.ok(hostState.writes.includes('new loopback text'));
      await run(controller, "document.getElementById('send-file').click();");
      await wait(host, "!document.getElementById('file-approval').hidden");
      assert.equal(hostState.receiver.active, null);
      // Change monitor while a file offer is pending; cancellation/failure must preserve the session.
      const oldVideoKey = hostState.session.videoKey;
      await run(host, "document.getElementById('host-screen').click();");
      await wait(host, "document.getElementById('switch-source').options.length===2");
      await run(host, "document.getElementById('switch-cancel').click();");
      assert.equal(hostState.session.videoKey, oldVideoKey);
      await run(host, "document.getElementById('host-screen').click();");
      await wait(host, "document.getElementById('switch-source').options.length===2");
      await run(
        host,
        "document.getElementById('switch-source').value='screen:2';document.getElementById('switch-source').dispatchEvent(new Event('change'));window.failCapture=true;",
      );
      await wait(host, "!document.getElementById('switch-confirm').disabled");
      await delay(180);
      await fs.writeFile(
        path.join(root, 'review', 'screen-switch.png'),
        (
          await host.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
        ).toPNG(),
      );
      await run(host, "document.getElementById('switch-confirm').click();");
      await wait(
        host,
        "document.getElementById('switch-error').textContent.includes('yakalanamadı')",
      );
      assert.equal(hostState.session.videoKey, oldVideoKey);
      assert.equal(
        await run(controller, "document.getElementById('remote-video').videoWidth"),
        640,
      );
      // Hold first-frame acknowledgement so input gating can be observed across the real data channel.
      await run(
        controller,
        `window.dataConnection=Object.values(testPeer.connections).flat().find(c=>c.type==='data');
        window.originalDataSend=dataConnection.send.bind(dataConnection);
        dataConnection.send=(m)=>{if(m.type==='video-visible'){window.heldVideoVisible=m;return;}originalDataSend(m);};`,
      );
      await run(
        host,
        "window.failCapture=false;document.getElementById('switch-confirm').click();",
      );
      await wait(
        controller,
        "document.getElementById('remote-video').videoWidth===800 && !!window.heldVideoVisible",
      );
      assert.equal(hostState.session.displayId, '2');
      assert.equal(hostState.session.inputPaused, true);
      const inputCount = hostState.inputs.length;
      await run(
        controller,
        `dataConnection.send({type:'key',code:'KeyQ',pressed:true,videoKey:${JSON.stringify(oldVideoKey)}});`,
      );
      await delay(100);
      assert.equal(hostState.inputs.length, inputCount);
      await run(
        controller,
        'dataConnection.send=originalDataSend;dataConnection.send(heldVideoVisible);',
      );
      await wait(host, "!document.getElementById('host-screen').disabled");
      assert.equal(hostState.session.inputPaused, false);
      await run(
        controller,
        `dataConnection.send({type:'key',code:'KeyQ',pressed:true,videoKey:${JSON.stringify(oldVideoKey)}});`,
      );
      await delay(100);
      assert.equal(hostState.inputs.length, inputCount);
      assert.equal(await run(host, "document.getElementById('screen-dialog').open"), false);
      assert.equal(
        await run(controller, "document.getElementById('stat-resolution').textContent"),
        '800 × 600',
      );
      assert.equal(await run(host, 'testStreams[0].getVideoTracks()[0].readyState'), 'ended');
      await run(host, "document.getElementById('accept-file').click();");
      await wait(
        controller,
        "document.getElementById('transfer-title').textContent==='Dosya gönderildi'",
      );
      assert.equal(hostState.saved.length, 1);
      assert.deepEqual(await fs.readFile(hostState.saved[0].path), controllerState.payload);
      await run(host, "document.getElementById('host-file').click();");
      await wait(controller, "!document.getElementById('file-approval').hidden");
      await run(controller, "document.getElementById('accept-file').click();");
      await wait(
        host,
        "document.getElementById('transfer-title').textContent==='Dosya gönderildi'",
      );
      assert.equal((await fs.stat(controllerState.saved[0].path)).size, 0);
      // Hidden Electron windows may return the previous compositor frame on the first capture.
      await controller.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
      await delay(200);
      await fs.writeFile(
        path.join(root, 'review', 'e2e-video.png'),
        (
          await controller.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
        ).toPNG(),
      );
      await run(host, "document.getElementById('host-screen').click();");
      await wait(host, "document.getElementById('switch-source').options.length===2");
      await run(
        host,
        "document.getElementById('switch-source').value='screen:1';document.getElementById('switch-source').dispatchEvent(new Event('change'));window.holdCapture=true;",
      );
      await wait(host, "!document.getElementById('switch-confirm').disabled");
      await run(host, "document.getElementById('switch-confirm').click();");
      await wait(host, "typeof window.finishCapture==='function'");
      const keyBeforeCancel = hostState.session.videoKey;
      await run(host, "document.getElementById('switch-cancel').click();");
      await wait(host, "!document.getElementById('screen-dialog').open");
      await run(host, 'window.finishCapture();window.finishCapture=null;');
      await wait(
        host,
        "testStreams.length===3 && testStreams[2].getVideoTracks()[0].readyState==='ended'",
      );
      assert.equal(hostState.session.videoKey, keyBeforeCancel);
      assert.equal(await run(host, 'testStreams[1].getVideoTracks()[0].readyState'), 'live');
      await run(host, "document.getElementById('host-screen').click();");
      await wait(
        host,
        "document.getElementById('screen-dialog').open && document.getElementById('switch-source').options.length===2",
      );
      await run(
        host,
        "document.getElementById('switch-source').value='screen:1';document.getElementById('switch-source').dispatchEvent(new Event('change'));",
      );
      await wait(host, "!document.getElementById('switch-confirm').disabled");
      await run(host, "document.getElementById('switch-confirm').click();");
      await wait(host, "typeof window.finishCapture==='function'");
      await run(controller, "document.getElementById('disconnect').click();");
      await wait(host, "document.getElementById('host-session').hidden");
      await run(host, 'window.finishCapture();');
      await wait(
        host,
        "testStreams.length===4 && testStreams[3].getVideoTracks()[0].readyState==='ended'",
      );
      assert.equal(hostState.session, null);
      assert.equal(controllerState.session, null);
      assert.deepEqual(errors, []);
      const result = {
        electron: process.versions.electron,
        video: '640x360 → 800x600 actual WebRTC',
        namedPeerCursor: true,
        responsiveCursorTelemetry: true,
        viewOnlyPointerNoInput: true,
        textEncoderHint: true,
        fluid60FpsSenderTarget: true,
        sourceAndSentResolution: true,
        syntheticTextPatternPsnrDb: patternPsnr,
        monitorSwitch: true,
        switchFailurePreservesSession: true,
        switchCancellation: true,
        pendingCaptureCancellation: true,
        inputPausedUntilNewFrame: true,
        staleVideoInputRejected: true,
        fileOfferSurvivesMonitorSwitch: true,
        disconnectedCaptureStopped: true,
        previousCaptureStopped: true,
        chat: true,
        chatDeliveryAndRetry: true,
        chatDeduplication: true,
        multilineChat: true,
        physicalPixelView: true,
        qualityAppliedAfterNegotiation: true,
        videoRefresh: true,
        adaptiveRealSenderWithSimulatedStats: true,
        automaticVideoRecovery: true,
        chatAndApprovalSurviveRecovery: true,
        keyboardTurkishAndShortcuts: true,
        dragPreservesModifiers: true,
        trailingMousePosition: true,
        controlStatusAndReapproval: true,
        clipboardBaselinePrivate: true,
        clipboardNewText: true,
        receivedBytes: 100123,
        reverseEmptyFile: true,
        approvalBeforeDiskWrite: true,
        disconnect: true,
        externalNetwork: false,
      };
      await fs.writeFile(
        path.join(root, 'review', 'e2e-results.json'),
        JSON.stringify(result, null, 2),
      );
      console.log('E2E PASS', JSON.stringify(result));
      clearTimeout(watchdog);
      for (const w of windows) w.destroy();
      for (const socket of peers.values()) socket.terminate();
      server.close();
      app.exit(0);
    } catch (error) {
      console.error(error);
      console.error(errors);
      app.exit(1);
    }
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
