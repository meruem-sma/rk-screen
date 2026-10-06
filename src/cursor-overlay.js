const { BrowserWindow } = require('electron');
const path = require('node:path');
const { cleanName, overlayGeometry } = require('./core/pointer');
class CursorOverlay {
  constructor() {
    this.win = null;
    this.pending = null;
    this.ready = false;
    this.timer = null;
  }
  update(bounds, point, name) {
    if (!this.win || this.win.isDestroyed()) {
      this.ready = false;
      const win = (this.win = new BrowserWindow({
        title: 'RK Screen işaretçi',
        width: 220,
        height: 62,
        frame: false,
        transparent: true,
        show: false,
        focusable: false,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        alwaysOnTop: true,
        webPreferences: {
          preload: path.join(__dirname, 'cursor-preload.js'),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      }));
      win.setIgnoreMouseEvents(true);
      win.setContentProtection(true);
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (e) => e.preventDefault());
      win
        .loadFile(path.join(__dirname, 'cursor-overlay.html'))
        .then(() => {
          if (this.win !== win || win.isDestroyed()) return;
          this.ready = true;
          this.render();
        })
        .catch(() => {
          if (this.win === win) this.close();
        });
    }
    this.pending = { ...overlayGeometry(bounds, point), name: cleanName(name) };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), 1500);
    this.render();
  }
  render() {
    if (!this.ready || !this.pending || this.win?.isDestroyed()) return;
    const { x, y, width, height } = this.pending;
    this.win.setBounds({ x, y, width, height }, false);
    this.win.webContents.send('cursor-position', this.pending);
    if (!this.win.isVisible()) this.win.showInactive();
  }
  hide() {
    clearTimeout(this.timer);
    this.pending = null;
    if (this.win && !this.win.isDestroyed()) this.win.hide();
  }
  close() {
    this.hide();
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
    this.ready = false;
  }
}
module.exports = { CursorOverlay };
