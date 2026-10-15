const { app, clipboard, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.setVersion(require('../package.json').version);
app.setPath('userData', path.join(root, 'review', 'native-test-profile'));
// Exercise the asynchronous Electron clipboard API without reading or replacing the user's clipboard.
let testClipboard = 'native test text';
clipboard.readText = async () => testClipboard;
clipboard.writeText = async (text) => {
  testClipboard = text;
};
const { InputInjector } = require('../src/input/injector');
const nativeInput = new InputInjector();
assert.ok(Number.isFinite(nativeInput.position().x));
nativeInput.releaseAll();
app.on('browser-window-created', (_event, win) => {
  if (win.getTitle() === 'RK Screen işaretçi') {
    win.showInactive = () => {};
    return;
  }
  win.show = () => {};
  win.webContents.once('did-finish-load', async () => {
    try {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: path.join(root, 'review/native-diagnostics.json'),
      });
      const relayChecks = await win.webContents.executeJavaScript(`(async()=>{
        const value={url:'turns:relay.example.invalid:443?transport=tcp',username:'native-test',password:'test-only-relay-password'};
        await rkScreen.saveConnectionSettings(value);
        const masked=await rkScreen.connectionSettings();
        const config=await rkScreen.connectionConfig();
        const encryptedRoundTrip=config.iceServers.at(-1).credential===value.password;
        const passwordMasked=masked.hasPassword===true&&!('password' in masked)&&!('encrypted' in masked);
        await rkScreen.compatibility(false);
        const preferencePreserved=(await rkScreen.connectionSettings()).url===value.url;
        await rkScreen.saveConnectionSettings({...value,password:''});
        return {encryptedRoundTrip,passwordMasked,preferencePreserved};
      })()`);
      assert.deepEqual(relayChecks, {
        encryptedRoundTrip: true,
        passwordMasked: true,
        preferencePreserved: true,
      });
      const runtimeText = await fs.readFile(
        path.join(root, 'review/native-test-profile/runtime.json'),
        'utf8',
      );
      assert.equal(
        runtimeText.includes('test-only-relay-password'),
        false,
        'relay password must not be stored in plaintext',
      );
      await win.webContents.executeJavaScript(
        "rkScreen.saveConnectionSettings({url:'',username:'',password:''})",
      );
      await win.webContents.executeJavaScript(
        "rkScreen.saveDiagnostics([{event:'receive',fps:30,ip:'192.0.2.1',name:'private-device',credential:'private-credential',chat:'private-chat'}])",
      );
      const diagnosticText = await fs.readFile(
        path.join(root, 'review/native-diagnostics.json'),
        'utf8',
      );
      for (const privateValue of [
        '192.0.2.1',
        'private-device',
        'private-credential',
        'private-chat',
      ])
        assert.equal(diagnosticText.includes(privateValue), false);
      const result = await win.webContents.executeJavaScript(`(async()=>{
        const info=await rkScreen.info();
        const sources=await rkScreen.sources();
        if(!sources.length)throw Error('No display sources');
        let denied=false;
        try{await rkScreen.input('invalid',{type:'key',code:'KeyA',pressed:true});}catch{denied=true;}
        const token=await rkScreen.begin({role:'host',displayId:sources[0].displayId,input:false,clipboard:false,remoteName:'Enes'});
        const inputBlocked=await rkScreen.input(token,{type:'key',code:'KeyA',pressed:true})===false;
        const viewOnlyKeepAliveBlocked=await rkScreen.inputKeepAlive(token)===false;
        const key1='11111111-1111-4111-8111-111111111111',key2='22222222-2222-4222-8222-222222222222';
        await rkScreen.permissions(token,{input:true,clipboard:false});
        await rkScreen.videoState(token,{videoKey:key1,displayId:sources[0].displayId});
        const transitionInputBlocked=await rkScreen.input(token,{type:'key',code:'KeyA',pressed:true,videoKey:key1})===false;
        const pausedKeepAliveBlocked=await rkScreen.inputKeepAlive(token)===false;
        const wrongReadyBlocked=await rkScreen.videoReady(token,key2)===false;
        const currentReadyAccepted=await rkScreen.videoReady(token,key1)===true;
        const readyKeepAliveAccepted=await rkScreen.inputKeepAlive(token)===true;
        await rkScreen.pauseControl(token,true);
        const manualPauseInputBlocked=await rkScreen.input(token,{type:'text',text:'do not type',videoKey:key1})===false;
        const manualPauseKeepAliveBlocked=await rkScreen.inputKeepAlive(token)===false;
        const manualPauseReported=(await rkScreen.cursor(token)).control==='manual';
        await rkScreen.pauseControl(token,false);
        const staleInputBlocked=await rkScreen.input(token,{type:'key',code:'KeyA',pressed:true,videoKey:key2})===false;
        await rkScreen.videoState(token,{videoKey:key2,displayId:sources.at(-1).displayId});
        const staleReadyBlocked=await rkScreen.videoReady(token,key1)===false;
        let missingScreenBlocked=false;
        try{await rkScreen.videoState(token,{videoKey:key1,displayId:'not-a-display'});}catch{missingScreenBlocked=true;}
        await rkScreen.permissions(token,{input:false,clipboard:false});
        const pointer={type:'pointer',x:0.5,y:0.5,visible:true,videoKey:key2};
        const pausedPointerBlocked=await rkScreen.pointer(token,pointer)===false;
        await rkScreen.videoReady(token,key2);
        const oldPointerBlocked=await rkScreen.pointer(token,{...pointer,videoKey:key1})===false;
        await rkScreen.pointerEnabled(token,false);
        const disabledPointerBlocked=await rkScreen.pointer(token,pointer)===false;
        await rkScreen.pointerEnabled(token,true);
        const viewOnlyPointerAccepted=await rkScreen.pointer(token,pointer)===true;
        await rkScreen.pointer(token,{...pointer,visible:false});
        const clipboardBlocked=await rkScreen.clipboardRead(token)===null;
        await rkScreen.clipboardPermission(token,true);
        const clipboardAsyncRead=await rkScreen.clipboardRead(token)==='native test text';
        await rkScreen.clipboardWrite(token,'native roundtrip');
        const clipboardAsyncWrite=await rkScreen.clipboardRead(token)==='native roundtrip';
        await rkScreen.clipboardPermission(token,false);
        const video=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:sources[0].id,minWidth:sources[0].width,maxWidth:sources[0].width,minHeight:sources[0].height,maxHeight:sources[0].height,maxFrameRate:30}}});
        const settings=video.getVideoTracks()[0].getSettings();video.getTracks().forEach(t=>t.stop());
        await rkScreen.end(token);
        const controller=await rkScreen.begin({role:'controller',clipboard:false});
        const controllerKeepAliveBlocked=await rkScreen.inputKeepAlive(controller)===false;
        let controllerSwitchBlocked=false;
        try{await rkScreen.videoState(controller,{videoKey:key1,displayId:sources[0].displayId});}catch{controllerSwitchBlocked=true;}
        await rkScreen.end(controller);
        return {version:info.version,compatibility:info.compatibility,sources:sources.length,denied,inputBlocked,viewOnlyKeepAliveBlocked,pausedKeepAliveBlocked,readyKeepAliveAccepted,manualPauseInputBlocked,manualPauseKeepAliveBlocked,manualPauseReported,controllerKeepAliveBlocked,transitionInputBlocked,wrongReadyBlocked,currentReadyAccepted,staleInputBlocked,staleReadyBlocked,missingScreenBlocked,controllerSwitchBlocked,pausedPointerBlocked,oldPointerBlocked,disabledPointerBlocked,viewOnlyPointerAccepted,clipboardBlocked,clipboardAsyncRead,clipboardAsyncWrite,width:settings.width,height:settings.height};
      })()`);
      assert.equal(result.denied, true);
      assert.equal(result.inputBlocked, true);
      for (const key of [
        'viewOnlyKeepAliveBlocked',
        'pausedKeepAliveBlocked',
        'readyKeepAliveAccepted',
        'manualPauseInputBlocked',
        'manualPauseKeepAliveBlocked',
        'manualPauseReported',
        'controllerKeepAliveBlocked',
        'transitionInputBlocked',
        'wrongReadyBlocked',
        'currentReadyAccepted',
        'staleInputBlocked',
        'staleReadyBlocked',
        'missingScreenBlocked',
        'controllerSwitchBlocked',
        'pausedPointerBlocked',
        'oldPointerBlocked',
        'disabledPointerBlocked',
        'viewOnlyPointerAccepted',
      ])
        assert.equal(result[key], true, key);
      assert.equal(result.clipboardBlocked, true);
      assert.equal(result.clipboardAsyncRead, true);
      assert.equal(result.clipboardAsyncWrite, true);
      assert.ok(result.width > 0);
      await fs.writeFile(
        path.join(root, 'review', 'native-results.json'),
        JSON.stringify(result, null, 2),
      );
      console.log('NATIVE PASS', JSON.stringify({ ...result, ...relayChecks }));
      app.exit(0);
    } catch (err) {
      console.error(err);
      app.exit(1);
    }
  });
});
require('../src/main');
setTimeout(() => {
  console.error('Native smoke timed out');
  app.exit(1);
}, 20000);
