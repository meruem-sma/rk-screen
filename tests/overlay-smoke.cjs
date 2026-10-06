const { app, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { CursorOverlay } = require('../src/cursor-overlay');
const root = path.resolve(__dirname, '..');
app.setPath('userData', path.join(root, 'review', 'overlay-test-profile'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ignored = false,
  shownInactive = false;
app.on('browser-window-created', (_e, win) => {
  const original = win.setIgnoreMouseEvents.bind(win);
  win.setIgnoreMouseEvents = (value) => {
    ignored = value;
    original(value);
  };
  win.showInactive = () => {
    shownInactive = true;
  };
});
app.whenReady().then(async () => {
  const overlay = new CursorOverlay();
  try {
    const bounds = screen.getPrimaryDisplay().bounds;
    overlay.update(bounds, { x: 0.9, y: 0.9 }, 'Enes <img src=x>');
    for (let i = 0; i < 100 && !overlay.ready; i++) await delay(25);
    assert.equal(overlay.ready, true);
    overlay.update(bounds, { x: 0.9, y: 0.9 }, 'Enes <img src=x>');
    await delay(100);
    const win = overlay.win;
    assert.equal(ignored, true);
    assert.equal(shownInactive, true);
    assert.equal(win.isFocusable(), false);
    assert.equal(win.isAlwaysOnTop(), true);
    assert.equal(win.isContentProtected(), true);
    assert.equal(
      await win.webContents.executeJavaScript("document.getElementById('label').textContent"),
      'Enes <img src=x>',
    );
    assert.equal(
      await win.webContents.executeJavaScript('document.querySelectorAll("img").length'),
      0,
    );
    // Production remains protected; disable it only for this isolated visual fixture.
    win.setContentProtection(false);
    await delay(200);
    await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    await delay(100);
    await fs.writeFile(
      path.join(root, 'review', 'named-pointer.png'),
      (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
    );
    await delay(1500);
    assert.equal(overlay.pending, null);
    overlay.close();
    assert.equal(win.isDestroyed(), true);
    // Closing before the page loads must not let an asynchronous load reopen it.
    overlay.update(bounds, { x: 0, y: 0 }, 'Enes');
    overlay.close();
    await delay(100);
    assert.equal(overlay.win, null);
    console.log(
      'OVERLAY PASS: literal name, click-through, no focus, content protection, idle expiry and cleanup.',
    );
    app.exit(0);
  } catch (err) {
    console.error(err);
    overlay.close();
    app.exit(1);
  }
});
app.on('window-all-closed', () => {});
setTimeout(() => app.exit(1), 15000);
