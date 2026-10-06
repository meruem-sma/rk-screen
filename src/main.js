const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  Menu,
  dialog,
  clipboard,
  powerSaveBlocker,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { FileReceiver, MAX_FILE_SIZE } = require('./core/file-store');
const { validMessage, inputTypes, validVideoKey } = require('./core/session');
const { cleanName } = require('./core/pointer');
const { CursorOverlay } = require('./cursor-overlay');
const pointerOverlay = new CursorOverlay();
// Keep existing installed users' local settings during the product rename.
const legacyProfile = path.join(app.getPath('appData'), 'Menzil');
if (app.isPackaged && fsSync.existsSync(legacyProfile)) app.setPath('userData', legacyProfile);
let win,
  session = null,
  injector = null,
  receiver,
  outbound = null;
let fileQueue = Promise.resolve();
let powerBlocker = null;
const runtimeFile = path.join(app.getPath('userData'), 'runtime.json');
let runtime = {};
try {
  runtime = JSON.parse(fsSync.readFileSync(runtimeFile, 'utf8')) || {};
} catch {}
const compatibility = runtime.compatibility === true || process.argv.includes('--safe-mode');
if (compatibility) app.disableHardwareAcceleration();
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
function logEvent(message) {
  try {
    const directory = path.join(app.getPath('userData'), 'logs');
    fsSync.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'startup.log');
    if (fsSync.existsSync(file) && fsSync.statSync(file).size > 512 * 1024)
      fsSync.writeFileSync(file, '');
    fsSync.appendFileSync(file, new Date().toISOString() + ' ' + message + '\n');
  } catch {}
}
app.on('second-instance', () => {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
const page = path.join(__dirname, '..', 'index.html');
const serialized = (work) => {
  const next = fileQueue.then(work);
  fileQueue = next.catch(() => {});
  return next;
};
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (
      !win ||
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== pathToFileURL(page).href
    )
      throw new Error('Geçersiz uygulama isteği.');
    return fn(...args);
  });
}
function authorized(token) {
  if (!session || token !== session.token) throw new Error('Etkin oturum bulunamadı.');
  return session;
}
async function closeFiles() {
  await receiver?.cancel();
  if (outbound) {
    const previous = outbound;
    outbound = null;
    await previous.handle.close().catch(() => {});
  }
}
function endSession() {
  pointerOverlay.close();
  session = null;
  if (win && !win.isDestroyed() && win.isFullScreen()) win.setFullScreen(false);
  try {
    injector?.releaseAll();
  } catch (error) {
    logEvent('input-release-failed: ' + error.message);
  }
  if (powerBlocker !== null && powerSaveBlocker.isStarted(powerBlocker))
    powerSaveBlocker.stop(powerBlocker);
  powerBlocker = null;
  return serialized(closeFiles);
}
function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1160,
    height: 790,
    minWidth: 860,
    minHeight: 640,
    title: 'RK Screen',
    backgroundColor: '#17191b',
    icon: path.join(__dirname, '../assets/blank.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  let recoveries = 0;
  win.webContents.on('render-process-gone', (_event, details) => {
    logEvent('renderer-exit: ' + details.reason);
    endSession().finally(() => {
      if (!win || win.isDestroyed() || quitting) return;
      if (recoveries++ === 0) win.reload();
      else
        dialog.showErrorBox(
          'RK Screen görüntüyü açamadı',
          'Uygulamayı --safe-mode seçeneğiyle başlatın veya Ayarlar’dan Windows uyumluluk modunu açın.',
        );
    });
  });
  const mediaAllowed = (wc, permission, details) =>
    permission === 'media' &&
    wc === win?.webContents &&
    !!session &&
    session.role === 'host' &&
    details.isMainFrame === true &&
    details.requestingUrl === pathToFileURL(page).href;
  win.webContents.session.setPermissionRequestHandler((wc, permission, callback, details) =>
    callback(mediaAllowed(wc, permission, details)),
  );
  win.webContents.session.setPermissionCheckHandler((wc, permission, _origin, details) =>
    mediaAllowed(wc, permission, details),
  );
  win.loadFile(page).catch((error) => {
    logEvent('page-load-failed: ' + error.message);
    dialog.showErrorBox(
      'RK Screen açılamadı',
      'Uygulama dosyaları yüklenemedi. Güncel kurulumu yeniden çalıştırın.',
    );
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    endSession();
    win = null;
  });
}
handle('app-info', () => ({
  name: require('node:os').hostname(),
  version: app.getVersion(),
  compatibility,
}));
handle('compatibility', async (value) => {
  if (typeof value !== 'boolean') throw new Error('Geçersiz ayar.');
  await fs.mkdir(path.dirname(runtimeFile), { recursive: true });
  await fs.writeFile(runtimeFile, JSON.stringify({ compatibility: value }));
});
handle('sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 240, height: 135 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    displayId: s.display_id,
    width: Math.round(
      (screen.getAllDisplays().find((d) => String(d.id) === s.display_id)?.size.width || 0) *
        (screen.getAllDisplays().find((d) => String(d.id) === s.display_id)?.scaleFactor || 1),
    ),
    height: Math.round(
      (screen.getAllDisplays().find((d) => String(d.id) === s.display_id)?.size.height || 0) *
        (screen.getAllDisplays().find((d) => String(d.id) === s.display_id)?.scaleFactor || 1),
    ),
    thumbnail: s.thumbnail.toDataURL(),
  }));
});
handle('session-begin', async (options) => {
  if (session || !['host', 'controller'].includes(options?.role))
    throw new Error('Başka bir oturum açık.');
  let display = null;
  if (options.role === 'host') {
    display = screen.getAllDisplays().find((d) => String(d.id) === options.displayId);
    if (!display) throw new Error('Seçili ekran bulunamadı.');
  }
  const token = crypto.randomUUID();
  session = {
    token,
    role: options.role,
    remoteName: cleanName(options.remoteName),
    pointerEnabled: true,
    lastPointerTime: 0,
    cursorOwner: 'host',
    input: options.role === 'host' && options.input === true,
    inputPaused: true,
    videoKey: null,
    clipboard: options.clipboard === true,
    display,
    lastCursor: null,
    injected: null,
    localUntil: 0,
  };
  powerBlocker = powerSaveBlocker.start('prevent-display-sleep');
  return token;
});
handle('session-end', (token) => {
  authorized(token);
  return endSession();
});
handle('video-state', (token, options) => {
  const s = authorized(token);
  if (s.role !== 'host' || !validVideoKey(options?.videoKey))
    throw new Error('Geçersiz görüntü oturumu.');
  const display = screen.getAllDisplays().find((d) => String(d.id) === options.displayId);
  if (!display) throw new Error('Seçili ekran artık bağlı değil.');
  // Block input before releasing keys or changing the coordinate target.
  s.inputPaused = true;
  pointerOverlay.hide();
  injector?.releaseAll();
  s.display = display;
  s.videoKey = options.videoKey;
  s.lastCursor = null;
  s.injected = null;
  s.localUntil = 0;
  s.cursorOwner = 'host';
});
handle('pointer-enabled', (token, enabled) => {
  const s = authorized(token);
  if (s.role !== 'host' || typeof enabled !== 'boolean') throw new Error('Geçersiz işaretçi izni.');
  s.pointerEnabled = enabled;
  if (!enabled) pointerOverlay.hide();
});
handle('pointer', (token, data) => {
  const s = authorized(token);
  if (
    s.role !== 'host' ||
    !s.pointerEnabled ||
    s.inputPaused ||
    !validMessage(data) ||
    data.type !== 'pointer' ||
    data.videoKey !== s.videoKey
  )
    return false;
  if (!data.visible) {
    pointerOverlay.hide();
    return true;
  }
  const now = Date.now();
  if (now - s.lastPointerTime < 30) return false;
  s.lastPointerTime = now;
  pointerOverlay.update(s.display.bounds, data, s.remoteName);
  return true;
});
handle('video-ready', (token, videoKey) => {
  const s = authorized(token);
  if (s.role !== 'host' || !validVideoKey(videoKey) || videoKey !== s.videoKey) return false;
  s.inputPaused = false;
  return true;
});
handle('permissions', (token, permissions) => {
  const s = authorized(token);
  if (s.role !== 'host') throw new Error('Paylaşım oturumu gerekli.');
  s.input = permissions.input === true;
  s.clipboard = permissions.clipboard === true;
  if (!s.input) injector?.releaseAll();
});
handle('input', (token, data) => {
  const s = authorized(token);
  if (
    s.role !== 'host' ||
    !s.input ||
    s.inputPaused ||
    data?.videoKey !== s.videoKey ||
    !validMessage(data) ||
    !inputTypes.has(data.type)
  )
    return false;
  if (!injector) {
    const { InputInjector } = require('./input/injector');
    injector = new InputInjector();
  }
  if (data.type === 'release-input') {
    injector.releaseAll();
    return true;
  }
  const pt = injector.position();
  if (
    pt &&
    s.lastCursor &&
    (pt.x !== s.lastCursor.x || pt.y !== s.lastCursor.y) &&
    (!s.injected || Math.abs(pt.x - s.injected.x) > 4 || Math.abs(pt.y - s.injected.y) > 4)
  )
    s.localUntil = Date.now() + 350;
  s.lastCursor = pt;
  const b = s.display.bounds;
  const dip = {
    x: b.x + Math.round((b.width - 1) * (data.x || 0)),
    y: b.y + Math.round((b.height - 1) * (data.y || 0)),
  };
  const physical = screen.dipToScreenPoint(dip);
  if (data.type === 'mouse-move') {
    if (Date.now() < s.localUntil) return false;
    injector.moveMouse(physical.x, physical.y);
    s.injected = injector.position() || physical;
    s.lastCursor = s.injected;
    s.cursorOwner = 'controller';
  } else if (data.type === 'mouse-button') {
    if (data.pressed && Date.now() < s.localUntil) return false;
    const localActive = Date.now() < s.localUntil;
    injector.mouseButton(
      data.button,
      data.pressed,
      localActive ? undefined : physical.x,
      localActive ? undefined : physical.y,
    );
    s.injected = injector.position() || physical;
    s.lastCursor = s.injected;
    if (!localActive) s.cursorOwner = 'controller';
  } else if (data.type === 'mouse-wheel') injector.mouseWheel(data.dx, data.dy);
  else if (data.type === 'key') injector.keyEvent(data.code, data.pressed);
  else if (data.type === 'text') injector.text(data.text);
  return true;
});
handle('cursor', (token) => {
  const s = authorized(token);
  if (s.role !== 'host') return null;
  const p = screen.getCursorScreenPoint(),
    b = s.display.bounds;
  const physical = screen.dipToScreenPoint(p);
  if (
    s.lastCursor &&
    (Math.abs(physical.x - s.lastCursor.x) > 4 || Math.abs(physical.y - s.lastCursor.y) > 4) &&
    (!s.injected ||
      Math.abs(physical.x - s.injected.x) > 4 ||
      Math.abs(physical.y - s.injected.y) > 4)
  ) {
    s.localUntil = Date.now() + 350;
    s.cursorOwner = 'host';
  }
  s.lastCursor = physical;
  return {
    x: Math.max(0, Math.min(1, (p.x - b.x) / b.width)),
    y: Math.max(0, Math.min(1, (p.y - b.y) / b.height)),
    visible:
      !s.inputPaused &&
      s.cursorOwner === 'host' &&
      p.x >= b.x &&
      p.y >= b.y &&
      p.x < b.x + b.width &&
      p.y < b.y + b.height,
  };
});
handle('clipboard-read', async (token) => {
  if (!authorized(token).clipboard) return null;
  const text = await clipboard.readText();
  return authorized(token).clipboard ? text.slice(0, 100000) : null;
});
handle('clipboard-write', async (token, text) => {
  if (authorized(token).clipboard && typeof text === 'string' && text.length <= 100000)
    await clipboard.writeText(text);
});
handle('clipboard-permission', (token, value) => {
  authorized(token).clipboard = value === true;
});
handle('copy-id', async (value) => {
  if (/^\d{3} \d{3} \d{3}$/.test(value)) await clipboard.writeText(value);
});
handle('fullscreen', () => {
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});
handle('file-select', async (token, droppedPath) => {
  authorized(token);
  const result =
    typeof droppedPath === 'string' && path.isAbsolute(droppedPath)
      ? { canceled: false, filePaths: [droppedPath] }
      : await dialog.showOpenDialog(win, { title: 'Dosya gönder', properties: ['openFile'] });
  if (result.canceled) return null;
  return serialized(async () => {
    authorized(token);
    if (outbound) throw new Error('Bir dosya aktarımı zaten sürüyor.');
    const handle = await fs.open(result.filePaths[0], 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_FILE_SIZE)
        throw new Error('En fazla 512 MB boyutunda bir dosya seçin.');
      outbound = {
        id: crypto.randomUUID(),
        handle,
        size: stat.size,
        offset: 0,
        hash: crypto.createHash('sha256'),
      };
      return { id: outbound.id, name: path.basename(result.filePaths[0]), size: stat.size };
    } catch (err) {
      await handle.close();
      throw err;
    }
  });
});
handle('file-read', (token, id) =>
  serialized(async () => {
    authorized(token);
    const f = outbound;
    if (!f || f.id !== id) throw new Error('Dosya aktarımı kapandı.');
    if (f.offset === f.size) {
      const hash = f.hash.digest('hex');
      await f.handle.close();
      outbound = null;
      return { done: true, hash };
    }
    const buffer = Buffer.alloc(Math.min(32768, f.size - f.offset));
    const { bytesRead } = await f.handle.read(buffer, 0, buffer.length, f.offset);
    if (!bytesRead) throw new Error('Dosya okunamadı.');
    f.offset += bytesRead;
    const bytes = buffer.subarray(0, bytesRead);
    f.hash.update(bytes);
    return { data: bytes.toString('base64'), bytes: f.offset };
  }),
);
handle('file-begin', (token, meta) =>
  serialized(async () => {
    authorized(token);
    if (!validMessage({ ...meta, type: 'file-offer' })) throw new Error('Geçersiz dosya.');
    await receiver.begin(meta);
  }),
);
handle('file-chunk', (token, id, index, data) =>
  serialized(async () => {
    authorized(token);
    return receiver.chunk(id, index, data);
  }),
);
handle('file-end', (token, id, hash) =>
  serialized(async () => {
    authorized(token);
    return receiver.finish(id, hash);
  }),
);
handle('file-cancel', (token) =>
  serialized(async () => {
    authorized(token);
    await closeFiles();
  }),
);
app.whenReady().then(() => {
  if (!primaryInstance) return;
  logEvent(
    'start ' +
      app.getVersion() +
      ' electron=' +
      process.versions.electron +
      ' compatibility=' +
      compatibility,
  );
  receiver = new FileReceiver(app.getPath('downloads'));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('child-process-gone', (_event, details) =>
  logEvent('child-exit: ' + details.type + ' ' + details.reason),
);
let quitting = false;
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  endSession().finally(() => app.quit());
});
