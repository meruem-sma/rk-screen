const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.setPath('userData', path.join(root, 'review', 'startup-test-profile'));
const secondary = process.argv.includes('--secondary');
if (!secondary) {
  const timeout = setTimeout(() => {
    console.error('STARTUP timeout');
    app.exit(1);
  }, 20000);
  app.on('browser-window-created', (_event, win) => {
    win.show = () => {};
    win.focus = () => {};
    win.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (_details, callback) => callback({ cancel: true }),
    );
    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win.webContents.executeJavaScript('rkScreen.info()');
        const second = new Promise((resolve) => app.once('second-instance', resolve));
        const child = spawn(process.execPath, [__filename, '--secondary'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        const exit = new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('exit', (code) =>
            code === 0 ? resolve() : reject(Error('Secondary exit ' + code)),
          );
        });
        await Promise.all([second, exit]);
        const reloaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
        win.webContents.forcefullyCrashRenderer();
        await reloaded;
        const after = await win.webContents.executeJavaScript('rkScreen.info()');
        assert.equal(after.name, result.name);
        await fs.writeFile(
          path.join(root, 'review', 'startup-results.json'),
          JSON.stringify(
            { singleInstance: true, rendererRecovered: true, compatibility: after.compatibility },
            null,
            2,
          ),
        );
        console.log('STARTUP PASS: duplicate launch and renderer crash recovery');
        clearTimeout(timeout);
        app.exit(0);
      } catch (e) {
        console.error(e);
        app.exit(1);
      }
    });
  });
}
require('../src/main');
