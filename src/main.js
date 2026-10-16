const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  Menu,
  dialog,
  clipboard,
  safeStorage,
  powerSaveBlocker,
  shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { FileReceiver } = require('./core/file-store');
const { FileSender } = require('./core/file-sender');
const sender = new FileSender();
const { validMessage, inputTypes, validVideoKey } = require('./core/session');
const { cleanName, CursorOwnership } = require('./core/pointer');
const { CursorOverlay } = require('./cursor-overlay');
const { fitWindow } = require('./core/window');
const { snapshot: controlSnapshot } = require('./core/control');
const { applyInput } = require('./input/controller');
const pointerOverlay = new CursorOverlay();
const localPointerOverlay = new CursorOverlay();
// Keep existing installed users' local settings during the product rename.
const legacyProfile = path.join(app.getPath('appData'), 'Menzil');
if (app.isPackaged && fsSync.existsSync(legacyProfile)) app.setPath('userData', legacyProfile);
let win,
  session = null,
  injector = null,
  receiver;
let checkedUpdate = null,
  checkingUpdate = null;
let fileQueue = Promise.resolve();
let powerBlocker = null;
let fullscreenTarget = null,
  fullscreenTimer = null,
  fullscreenQueued = null;
function fullscreenState() {
  return {
    active: !!win && !win.isDestroyed() && win.isFullScreen(),
    changing: fullscreenTarget !== null,
  };
}
function notifyFullscreen() {
  if (win && !win.isDestroyed()) win.webContents.send('fullscreen-state', fullscreenState());
}
function setFullscreen(target) {
  if (!win || win.isDestroyed()) return { active: false, changing: false };
  if (fullscreenTarget !== null) {
    fullscreenQueued = target;
    return fullscreenState();
  }
  if (win.isFullScreen() === target) return fullscreenState();
  fullscreenTarget = target;
  notifyFullscreen();
  clearTimeout(fullscreenTimer);
  fullscreenTimer = setTimeout(finishFullscreen, 2000);
  try {
    win.setFullScreen(target);
  } catch (error) {
    clearTimeout(fullscreenTimer);
    fullscreenTarget = null;
    fullscreenQueued = null;
    notifyFullscreen();
    throw error;
  }
  return fullscreenState();
}
function finishFullscreen() {
  clearTimeout(fullscreenTimer);
  fullscreenTarget = null;
  const queued = fullscreenQueued;
  fullscreenQueued = null;
  if (queued !== null && win && !win.isDestroyed() && win.isFullScreen() !== queued) {
    setFullscreen(queued);
  } else notifyFullscreen();
}
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
let cursorFallbackReported = false;
function readHostCursor() {
  try {
    return injector?.position() || require('./input/injector').readCursorPosition();
  } catch {
    // A blocked native DLL must not also disable consented view-only sharing.
    if (!cursorFallbackReported)
      logEvent('native-cursor-unavailable: using view-only cursor fallback');
    cursorFallbackReported = true;
    return screen.dipToScreenPoint(screen.getCursorScreenPoint());
  }
}
async function closeFiles() {
  await receiver?.cancel();
  await sender.cancel();
}
function endSession() {
  pointerOverlay.close();
  localPointerOverlay.close();
  session = null;
  clearTimeout(fullscreenTimer);
  fullscreenTarget = null;
  fullscreenQueued = null;
  if (win && !win.isDestroyed() && win.isFullScreen()) setFullscreen(false);
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
    ...fitWindow(screen.getPrimaryDisplay().workArea),
    title: 'RK Screen',
    backgroundColor: '#17191b',
    icon: path.join(__dirname, '../assets/rk-screen.ico'),
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
  for (const event of ['enter-full-screen', 'leave-full-screen']) {
    win.on(event, finishFullscreen);
  }
  // Reserve local escape keys before DOM handlers, including while a dialog is open.
  win.webContents.on('before-input-event', (event, input) => {
    if (session?.role !== 'controller') return;
    const escape = input.control && input.alt && input.shift && input.code === 'Space';
    if (input.key !== 'F11' && !escape) return;
    event.preventDefault();
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    win.webContents.send('release-control', { escape });
    setFullscreen(escape ? false : !win.isFullScreen());
  });
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
function fitCurrentWindow() {
  if (!win || win.isDestroyed() || win.isFullScreen()) return;
  const current = win.getNormalBounds();
  const next = fitWindow(screen.getDisplayMatching(current).workArea, current);
  win.setMinimumSize(next.minWidth, next.minHeight);
  if (
    !win.isMaximized() &&
    !win.isMinimized() &&
    ['x', 'y', 'width', 'height'].some((key) => current[key] !== next[key])
  ) {
    win.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height });
  }
}
handle('app-info', () => ({
  name: require('node:os').hostname(),
  version: app.getVersion(),
  build: require('../package.json').rkScreenBuild,
  compatibility,
}));
handle('check-update', async () => {
  if (!checkingUpdate) {
    checkedUpdate = null;
    checkingUpdate = require('./core/updates')
      .checkUpdate({
        version: app.getVersion(),
        build: require('../package.json').rkScreenBuild,
      })
      .then((result) => (checkedUpdate = result))
      .finally(() => {
        checkingUpdate = null;
      });
  }
  return checkingUpdate;
});
handle('open-update', async () => {
  if (!checkedUpdate?.available) throw Error('Önce güncellemeleri kontrol edin.');
  await shell.openExternal(checkedUpdate.url);
});
handle('copy-text', async (text) => {
  if (typeof text !== 'string' || text.length > 4000) throw Error('Kopyalanacak metin çok uzun.');
  await clipboard.writeText(text);
});
handle('export-chat', async (messages) => {
  if (
    !session ||
    !Array.isArray(messages) ||
    messages.length > 200 ||
    messages.some(
      (m) =>
        !m ||
        typeof m.text !== 'string' ||
        m.text.length > 4000 ||
        typeof m.mine !== 'boolean' ||
        !Number.isFinite(m.time),
    )
  )
    throw Error('Geçersiz sohbet kaydı.');
  const result = await dialog.showSaveDialog(win, {
    title: 'Bu oturumun sohbetini kaydet',
    defaultPath: path.join(app.getPath('downloads'), 'RK-Screen-sohbet.txt'),
    filters: [{ name: 'Metin', extensions: ['txt'] }],
  });
  if (result.canceled || !result.filePath) return false;
  await fs.writeFile(
    result.filePath,
    messages
      .map(
        (m) =>
          `[${new Date(m.time).toLocaleString('tr-TR')}] ${m.mine ? 'Ben' : 'Karşı taraf'}: ${m.text}`,
      )
      .join('\n\n'),
    'utf8',
  );
  return true;
});
handle('compatibility', async (value) => {
  if (typeof value !== 'boolean') throw new Error('Geçersiz ayar.');
  await fs.mkdir(path.dirname(runtimeFile), { recursive: true });
  runtime.compatibility = value;
  await fs.writeFile(runtimeFile, JSON.stringify(runtime));
});
handle('connection-settings', () => ({
  url: runtime.relay?.url || '',
  username: runtime.relay?.username || '',
  hasPassword: !!runtime.relay?.encrypted,
}));
handle('connection-config', () => {
  const { directServers, validateRelay } = require('./core/ice');
  const base = { bundlePolicy: 'max-bundle', iceCandidatePoolSize: 1 };
  if (!runtime.relay) return { ...base, iceServers: directServers };
  const relay = validateRelay({
    ...runtime.relay,
    password: safeStorage.decryptString(Buffer.from(runtime.relay.encrypted, 'base64')),
  });
  return { ...base, iceServers: [...directServers, relay] };
});
handle('save-connection-settings', async (value) => {
  if (session) throw Error('Sunucu ayarını değiştirmek için oturumu bitirin.');
  const previous = runtime.relay;
  let password = value?.password;
  if (
    password === '' &&
    previous?.encrypted &&
    value.url?.trim() === previous.url &&
    value.username?.trim() === previous.username
  )
    password = safeStorage.decryptString(Buffer.from(previous.encrypted, 'base64'));
  const relay = require('./core/ice').validateRelay({ ...value, password });
  if (relay) {
    if (!safeStorage.isEncryptionAvailable())
      throw Error('Windows güvenli parola saklama hizmeti kullanılamıyor.');
    runtime.relay = {
      url: relay.urls.join(', '),
      username: relay.username,
      encrypted: safeStorage.encryptString(relay.credential).toString('base64'),
    };
  } else delete runtime.relay;
  await fs.mkdir(path.dirname(runtimeFile), { recursive: true });
  await fs.writeFile(runtimeFile, JSON.stringify(runtime));
  return true;
});
handle('save-diagnostics', async (events) => {
  const safe = require('./core/diagnostics').sanitizeEvents(events);
  const result = await dialog.showSaveDialog(win, {
    title: 'Bağlantı raporunu kaydet',
    defaultPath: path.join(app.getPath('downloads'), 'RK-Screen-baglanti-raporu.json'),
    filters: [{ name: 'Bağlantı raporu', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return false;
  await fs.writeFile(
    result.filePath,
    JSON.stringify(
      {
        version: app.getVersion(),
        build: require('../package.json').rkScreenBuild,
        electron: process.versions.electron,
        createdAt: new Date().toISOString(),
        events: safe,
      },
      null,
      2,
    ),
  );
  return true;
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
  // A failed release from the previous session must not carry into a new owner.
  injector?.releaseAll();
  const token = crypto.randomUUID();
  session = {
    token,
    role: options.role,
    remoteName: cleanName(options.remoteName),
    pointerEnabled: true,
    lastPointerTime: 0,
    cursor: new CursorOwnership(),
    input: options.role === 'host' && options.input === true,
    inputPaused: true,
    controlPaused: false,
    videoKey: null,
    clipboard: options.clipboard === true,
    display,
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
  localPointerOverlay.hide();
  injector?.releaseAll();
  const sameDisplay = s.display?.id === display.id;
  const changedVideoKey = s.videoKey !== options.videoKey;
  s.display = display;
  s.videoKey = options.videoKey;
  if (!sameDisplay) s.cursor = new CursorOwnership();
  if (changedVideoKey) s.cursor.sequence = 0;
  // Use the same native coordinate source as input injection. Mixing Electron
  // DIP round-trips with GetCursorPos can classify our own move as local input.
  s.cursor.observe(readHostCursor(), Date.now());
});
handle('pointer-enabled', (token, enabled) => {
  const s = authorized(token);
  if (s.role !== 'host' || typeof enabled !== 'boolean') throw new Error('Geçersiz işaretçi izni.');
  s.pointerEnabled = enabled;
  if (!enabled) {
    pointerOverlay.hide();
    localPointerOverlay.hide();
  }
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
  if (!data.pulse && now - s.lastPointerTime < 30) return false;
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
handle('pause-control', (token, paused) => {
  const s = authorized(token);
  if (s.role !== 'host' || typeof paused !== 'boolean') throw Error('Geçersiz kontrol isteği.');
  s.controlPaused = paused;
  if (paused) injector?.releaseAll();
});
handle('input-keepalive', (token) => {
  const s = authorized(token);
  if (
    s.role !== 'host' ||
    !s.input ||
    s.inputPaused ||
    s.controlPaused ||
    Date.now() < s.cursor.localUntil
  )
    return false;
  injector?.keepAlive();
  return true;
});
handle('input', (token, data) => {
  const s = authorized(token);
  if (
    s.role !== 'host' ||
    data?.videoKey !== s.videoKey ||
    !validMessage(data) ||
    !inputTypes.has(data.type)
  )
    return { accepted: false, reason: 'stale', ...controlSnapshot(s) };
  try {
    if (
      data.type !== 'release-input' &&
      !['permission', 'video', 'manual'].includes(controlSnapshot(s).state) &&
      !injector
    ) {
      const { InputInjector } = require('./input/injector');
      injector = new InputInjector();
    }
    return applyInput(s, data, injector, screen);
  } catch (error) {
    logEvent('input-failed: ' + error.message);
    s.inputError = 'windows';
    try {
      injector?.releaseAll();
    } catch {}
    return { accepted: false, reason: 'windows', ...controlSnapshot(s) };
  }
});
handle('cursor', (token) => {
  const s = authorized(token);
  if (s.role !== 'host') return null;
  const b = s.display.bounds;
  s.cursor.observe(readHostCursor(), Date.now());
  const control = s.controlPaused ? 'manual' : Date.now() < s.cursor.localUntil ? 'local' : 'none';
  if (control !== 'none') injector?.releaseAll();
  const p = s.cursor.local ? screen.screenToDipPoint(s.cursor.local) : null;
  if (!p) return { x: 0, y: 0, visible: false, control };
  const inside = p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
  const normalized = {
    x: (p.x - b.x) / Math.max(1, b.width - 1),
    y: (p.y - b.y) / Math.max(1, b.height - 1),
  };
  if (inside && s.pointerEnabled && !s.inputPaused)
    localPointerOverlay.update(b, normalized, require('node:os').hostname(), 'local');
  else localPointerOverlay.hide();
  return {
    ...controlSnapshot(s),
    control,
    x: Math.max(0, Math.min(1, normalized.x)),
    y: Math.max(0, Math.min(1, normalized.y)),
    visible: !s.inputPaused && inside,
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
handle('fullscreen-state', () => fullscreenState());
handle('fullscreen', (target) => {
  if (target !== undefined && typeof target !== 'boolean')
    throw Error('Geçersiz tam ekran isteği.');
  const next = target ?? !win.isFullScreen();
  if (next && session?.role !== 'controller')
    throw Error('Tam ekran için açık bir uzak ekran oturumu gerekli.');
  return setFullscreen(next);
});
async function pickFiles(token, droppedPaths, multiple) {
  authorized(token);
  const result =
    Array.isArray(droppedPaths) &&
    droppedPaths.length &&
    droppedPaths.every((p) => typeof p === 'string' && path.isAbsolute(p))
      ? { canceled: false, filePaths: droppedPaths }
      : await dialog.showOpenDialog(win, {
          title: 'Dosyaları kuyruğa ekle',
          properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        });
  if (result.canceled) return null;
  return serialized(async () => {
    authorized(token);
    if (!multiple && sender.active) throw Error('Bir dosya aktarımı zaten sürüyor.');
    const selected = await sender.enqueue(result.filePaths);
    return multiple ? selected : sender.open(selected[0].id);
  });
}
handle('file-select', (token, droppedPath) =>
  pickFiles(token, droppedPath ? [droppedPath] : null, false),
);
handle('file-pick', (token, droppedPaths) => pickFiles(token, droppedPaths, true));
handle('file-open', (token, id) =>
  serialized(() => {
    authorized(token);
    return sender.open(id);
  }),
);
handle('file-read', (token, id) =>
  serialized(async () => {
    authorized(token);
    return sender.read(id);
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
  screen.on('display-metrics-changed', fitCurrentWindow);
  screen.on('display-removed', fitCurrentWindow);
  // Independent of renderer/media health: never leave remotely held inputs stuck.
  let releaseFailed = false;
  const inputWatchdog = setInterval(() => {
    try {
      injector?.releaseExpired();
      releaseFailed = false;
    } catch (err) {
      if (!releaseFailed) logEvent('input-expiry-release-failed: ' + err.message);
      releaseFailed = true;
    }
  }, 500);
  inputWatchdog.unref();
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
