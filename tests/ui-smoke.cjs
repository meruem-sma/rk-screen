const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.setPath('userData', path.join(root, 'review', 'ui-test-profile'));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  await fs.mkdir(path.join(root, 'review'), { recursive: true });
  const html = (await fs.readFile(path.join(root, 'index.html'), 'utf8'))
    .replace('src/peerjs.min.js', 'tests/mock-peer.js')
    .replaceAll('src="src/', 'src="../src/')
    .replaceAll('href="src/', 'href="../src/')
    .replaceAll('src="assets/', 'src="../assets/')
    .replace('src="tests/', 'src="../tests/');
  await fs.writeFile(path.join(root, 'review', 'ui-fixture.html'), html);
  const win = new BrowserWindow({
    show: false,
    width: 1160,
    height: 790,
    webPreferences: {
      preload: path.join(__dirname, 'ui-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  const errors = [];
  win.webContents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  const run = (code) =>
    win.webContents.executeJavaScript(code + (code.trim().endsWith(';') ? '\nvoid 0;' : ''));
  const wait = async (code, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await run(code)) return;
      await delay(50);
    }
    throw Error('Timed out: ' + code);
  };
  try {
    await win.loadFile(path.join(root, 'review', 'ui-fixture.html'));
    await wait("document.getElementById('network-label').textContent==='Bağlantıya hazır'");
    await run("testPeer.disconnected=true;testPeer.emit('disconnected');");
    await wait("document.getElementById('network-label').textContent==='Bağlantıya hazır'");
    await delay(150);
    await fs.writeFile(
      path.join(root, 'review', 'dashboard.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    assert.equal(await run('document.documentElement.scrollWidth > window.innerWidth'), false);
    await run("document.getElementById('nav-settings').click()");
    await wait("!document.getElementById('settings-page').hidden");
    await run(
      "window.RKScreenNetworkCheck.checkNetwork=async()=>({local:1,public:1,relay:0,errors:[],completed:true});document.getElementById('network-check').click();",
    );
    await wait(
      "document.getElementById('network-check-result').textContent.includes('Aktarma sunucusu ayarlı değil')",
    );
    await delay(150);
    await fs.writeFile(
      path.join(root, 'review', 'settings.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    await run("document.getElementById('nav-home').click(); window.incoming=testPeer.incoming();");
    await wait(
      "document.getElementById('incoming-dialog').open && !document.getElementById('accept').disabled",
    );
    await run(
      "incoming.emit('data',{type:'key',code:'KeyA',pressed:true});incoming.emit('data',{type:'clipboard',text:'unauthorized'});",
    );
    assert.deepEqual(await run('window.rkScreen.testState().inputs'), []);
    assert.deepEqual(await run('window.rkScreen.testState().writes'), []);
    assert.equal(await run("document.getElementById('allow-input').checked"), false);
    await delay(150);
    await fs.writeFile(
      path.join(root, 'review', 'approval.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    await run(
      "document.getElementById('allow-input').checked=true;document.getElementById('accept').click();",
    );
    await wait("!document.getElementById('host-session').hidden");
    await run("document.getElementById('nav-settings').click();");
    await wait("!document.getElementById('settings-page').hidden");
    assert.equal(
      await run(
        "document.getElementById('host-stop').getBoundingClientRect().bottom < innerHeight",
      ),
      true,
    );
    await run("document.getElementById('nav-home').click();");
    await run(
      "window.sessionPeer=testPeer;window.sessionId=document.getElementById('device-id').textContent;testPeer.disconnected=true;testPeer.emit('error',{type:'unavailable-id'});testPeer.emit('disconnected');",
    );
    assert.equal(await run('incoming.closed===true'), false);
    assert.equal(await run("document.getElementById('host-session').hidden"), false);
    assert.equal(await run("document.getElementById('device-id').textContent===sessionId"), true);
    await wait("document.getElementById('network-label').textContent==='Bağlantıya hazır'");
    assert.equal(await run('testPeer===sessionPeer'), true);
    assert.equal(await run('testPeer.calls.length'), 0);
    await run(
      "incoming.emit('data',{type:'ready',videoKey:incoming.sent.find(m=>m.type==='granted').videoKey});",
    );
    await wait('testPeer.calls.length===1');
    await run(
      "incoming.emit('data',{type:'ready',videoKey:incoming.sent.find(m=>m.type==='granted').videoKey});",
    );
    assert.equal(await run('testPeer.calls.length'), 1);
    await run(
      "incoming.emit('data',{type:'video-visible',videoKey:incoming.sent.find(m=>m.type==='granted').videoKey});",
    );
    await delay(100);
    await run(
      "incoming.emit('data',{type:'key',code:'KeyA',pressed:true,videoKey:incoming.sent.find(m=>m.type==='granted').videoKey});",
    );
    await delay(100);
    assert.equal(await run('window.rkScreen.testState().inputs.length'), 1);
    await run("document.getElementById('host-screen').click();");
    await wait(
      "document.getElementById('screen-dialog').open && document.getElementById('switch-source').options.length===1",
    );
    assert.equal(await run("document.getElementById('switch-confirm').disabled"), true);
    assert.equal(
      await run(
        "(()=>{const d=document.getElementById('screen-dialog'),r=d.getBoundingClientRect();return d.matches(':modal') && getComputedStyle(d).display!=='none' && r.width>0 && r.top>=0 && r.bottom<=innerHeight;})()",
      ),
      true,
    );
    await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    await delay(200);
    await fs.writeFile(
      path.join(root, 'review', 'screen-picker.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    await run("document.getElementById('switch-cancel').click();");
    await wait("!document.getElementById('screen-dialog').open");
    await run("window.second=testPeer.incoming('İkinci cihaz');");
    await delay(150);
    assert.equal(await run("document.getElementById('host-session').hidden"), false);
    assert.equal(await run("second.sent.some(m=>m.type==='denied')"), true);
    await run(
      "document.getElementById('host-input').checked=false;document.getElementById('host-input').dispatchEvent(new Event('change'));",
    );
    await delay(100);
    await run("incoming.emit('data',{type:'key',code:'KeyB',pressed:true});");
    await delay(100);
    assert.equal(await run('window.rkScreen.testState().inputs.length'), 1);
    await run(
      "incoming.emit('data',{type:'chat',id:'test-chat',text:'<img src=x onerror=alert(1)>'});document.getElementById('host-chat').click();",
    );
    await delay(100);
    assert.equal(await run("document.querySelectorAll('#chat-messages img').length"), 0);
    await run(
      "document.getElementById('chat-search').value='bulunmayan';document.getElementById('chat-search').dispatchEvent(new Event('input'));",
    );
    assert.equal(await run("document.querySelector('.chat-bubble').hidden"), true);
    await run(
      "document.getElementById('chat-search').value='';document.getElementById('chat-search').dispatchEvent(new Event('input'));document.getElementById('chat-export').click();document.querySelector('.chat-copy').click();",
    );
    await wait('rkScreen.testState().exports.length===1 && rkScreen.testState().copied.length===1');
    assert.equal(
      await run('rkScreen.testState().exports[0][0].text'),
      '<img src=x onerror=alert(1)>',
    );
    await delay(150);
    await fs.writeFile(
      path.join(root, 'review', 'host-session.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    // A late failure from a cancelled approval must not cancel a newer offer.
    await run(
      "rkScreen.testHoldFileBegin();incoming.emit('data',{type:'file-offer',id:'old-file',name:'old.txt',size:1});",
    );
    await wait("!document.getElementById('file-approval').hidden");
    await run("document.getElementById('accept-file').click();");
    await wait('rkScreen.testState().fileBeginHeld===true');
    await run("document.getElementById('cancel-file').click();");
    await wait("document.getElementById('transfer-panel').hidden");
    await run("incoming.emit('data',{type:'file-offer',id:'new-file',name:'new.txt',size:1});");
    await wait(
      "document.getElementById('transfer-name').textContent==='new.txt' && !document.getElementById('file-approval').hidden",
    );
    const cancelsBeforeLateFailure = await run('rkScreen.testState().fileCancels');
    await run('rkScreen.testFailHeldFileBegin();');
    await delay(100);
    assert.equal(await run("document.getElementById('transfer-panel').hidden"), false);
    assert.equal(await run('rkScreen.testState().fileCancels'), cancelsBeforeLateFailure);
    await run("document.getElementById('cancel-file').click();");
    // A destroyed signaling service cannot be recreated until the approved session ends.
    await run("testPeer.destroyed=true;testPeer.disconnected=true;testPeer.emit('disconnected');");
    await delay(1200);
    assert.equal(await run('testPeer===sessionPeer'), true);
    assert.equal(await run('incoming.closed===true'), false);
    await run("document.getElementById('host-stop').click()");
    await wait("document.getElementById('host-session').hidden");
    // Registration deliberately backs off up to 30 seconds after signaling loss.
    await wait("document.getElementById('network-label').textContent==='Bağlantıya hazır'", 35000);
    assert.equal(await run('testPeer!==sessionPeer'), true);
    await run(
      "window.collisionId=document.getElementById('device-id').textContent;testPeer.disconnected=true;testPeer.emit('error',{type:'unavailable-id'});",
    );
    await wait("document.getElementById('network-label').textContent==='Bağlantıya hazır'");
    assert.equal(await run("document.getElementById('device-id').textContent!==collisionId"), true);
    await run(
      "document.getElementById('remote-id').value='123 456 789';document.getElementById('connect-form').dispatchEvent(new Event('submit',{cancelable:true}));",
    );
    await wait('window.testConnection?.open===true');
    await run(
      "testConnection.emit('data',{type:'granted',version:9,videoKey:'11111111-1111-4111-8111-111111111111',name:'Tasarım bilgisayarı',input:true,clipboard:false});",
    );
    await wait("!document.getElementById('remote-session').hidden");
    await run("document.getElementById('report-session').click();");
    await wait('rkScreen.testState().reports.length===1');
    assert.ok(
      (await run('rkScreen.testState().reports[0]')).every((e) => !('ip' in e) && !('name' in e)),
    );
    assert.equal(await run("testConnection.sent.some(m=>m.type==='ready')"), true);
    await run(
      "window.wrongCall=new Call(testConnection.peer);wrongCall.metadata={version:9,videoKey:'22222222-2222-4222-8222-222222222222'};testPeer.emit('call',wrongCall);",
    );
    assert.equal(await run('wrongCall.closed'), true);
    await run(
      "window.foreignCall=new Call('other-device');foreignCall.metadata={version:9,videoKey:'11111111-1111-4111-8111-111111111111'};testPeer.emit('call',foreignCall);",
    );
    assert.equal(await run('foreignCall.closed'), true);
    await delay(150);
    await fs.writeFile(
      path.join(root, 'review', 'remote-session.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    await run("document.getElementById('disconnect').click()");
    await wait("document.getElementById('remote-session').hidden");
    win.setSize(880, 660);
    await delay(150);
    assert.equal(await run('document.documentElement.scrollWidth > window.innerWidth'), false);
    await delay(150);
    await fs.writeFile(
      path.join(root, 'review', 'compact.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    assert.deepEqual(errors, []);
    assert.equal(await run("document.querySelector('.brand-icon').naturalWidth>0"), true);
    assert.equal(
      await run("document.querySelector('.brand').textContent.includes('RK Screen')"),
      true,
    );
    await run(
      "document.getElementById('allow-requests').checked=false;document.getElementById('allow-requests').dispatchEvent(new Event('change'));",
    );
    await wait("document.getElementById('network-label').textContent==='Gelen istekler kapalı'");
    await run("window.blockedRequest=testPeer.incoming('Kapalı istek');");
    await delay(100);
    assert.equal(await run("document.getElementById('incoming-dialog').open"), false);
    assert.equal(await run("blockedRequest.sent.some(m=>m.type==='denied')"), true);
    await run(
      "document.getElementById('allow-requests').checked=true;document.getElementById('allow-requests').dispatchEvent(new Event('change'));",
    );
    await run(
      "localStorage.setItem('menzil_recents',JSON.stringify([{id:'987654321',name:'Arkadaşım',time:1}]));",
    );
    await win.loadFile(path.join(root, 'review', 'ui-fixture.html'));
    await wait("document.querySelector('.favorite-button')!==null");
    await run(
      "document.querySelector('.favorite-button').click();document.querySelector('.recent-actions button:nth-child(2)').click();",
    );
    await wait("document.getElementById('device-dialog').open");
    await run(
      "document.getElementById('device-alias').value='Enes’in bilgisayarı';document.getElementById('device-form').dispatchEvent(new Event('submit',{cancelable:true}));",
    );
    await wait("document.getElementById('recents').textContent.includes('Enes’in bilgisayarı')");
    assert.equal(await run("JSON.parse(localStorage.getItem('menzil_recents'))[0].favorite"), true);
    await run(
      "document.getElementById('nav-settings').click();document.getElementById('check-update').click();",
    );
    await wait("!document.getElementById('download-update').hidden");
    assert.ok(
      await run("document.getElementById('update-result').textContent.includes('20261016.1')"),
    );
    await run("document.getElementById('clear-recents').click();");
    assert.equal(await run("JSON.parse(localStorage.getItem('menzil_recents')).length"), 1);
    await run("localStorage.setItem('test-product-version','1.0.0');");
    await win.loadFile(path.join(root, 'review', 'ui-fixture.html'));
    await wait("document.getElementById('app-version').textContent==='Sürüm 1.0.0 · 20261016.1'");
    assert.equal(
      await run("document.getElementById('about-version').textContent"),
      'Sürüm 1.0.0 · 20261016.1',
    );
    await run("localStorage.removeItem('test-product-version');");
    // Valid JSON can still have the wrong shape or name an inherited object property.
    for (const prefs of [42, 'broken', [], { quality: 'constructor', clipboard: 'true' }]) {
      await run(
        `localStorage.setItem('menzil_preferences_v3', ${JSON.stringify(JSON.stringify(prefs))});`,
      );
      await win.loadFile(path.join(root, 'review', 'ui-fixture.html'));
      await wait("document.getElementById('network-label').textContent==='Bağlantıya hazır'");
    }
    assert.deepEqual(errors, []);
    console.log(
      'UI PASS: dashboard, settings, approval, input revocation, session isolation, stale file approval failure isolation, chat, favorites, update control, stable version labels and compact layout.',
    );
    win.destroy();
    app.exit(0);
  } catch (err) {
    console.error(err);
    console.error(errors);
    win.destroy();
    app.exit(1);
  }
});
