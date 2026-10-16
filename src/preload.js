const { contextBridge, ipcRenderer, webUtils } = require('electron');
const invoke =
  (channel) =>
  (...args) =>
    ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('rkScreen', {
  info: invoke('app-info'),
  checkUpdate: invoke('check-update'),
  openUpdate: invoke('open-update'),
  copyText: invoke('copy-text'),
  exportChat: invoke('export-chat'),
  compatibility: invoke('compatibility'),
  saveDiagnostics: invoke('save-diagnostics'),
  connectionConfig: invoke('connection-config'),
  connectionSettings: invoke('connection-settings'),
  saveConnectionSettings: invoke('save-connection-settings'),
  sources: invoke('sources'),
  begin: invoke('session-begin'),
  end: invoke('session-end'),
  videoState: invoke('video-state'),
  videoReady: invoke('video-ready'),
  permissions: invoke('permissions'),
  pauseControl: invoke('pause-control'),
  input: invoke('input'),
  inputKeepAlive: invoke('input-keepalive'),
  cursor: invoke('cursor'),
  pointer: invoke('pointer'),
  pointerEnabled: invoke('pointer-enabled'),
  clipboardRead: invoke('clipboard-read'),
  clipboardWrite: invoke('clipboard-write'),
  clipboardPermission: invoke('clipboard-permission'),
  copyId: invoke('copy-id'),
  fullscreen: invoke('fullscreen'),
  fullscreenState: invoke('fullscreen-state'),
  onFullscreen: (callback) => {
    if (typeof callback !== 'function') return;
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('fullscreen-state', listener);
    return () => ipcRenderer.removeListener('fullscreen-state', listener);
  },
  onReleaseControl: (callback) => {
    if (typeof callback !== 'function') return;
    const listener = (_event, options) => callback({ escape: options?.escape === true });
    ipcRenderer.on('release-control', listener);
    return () => ipcRenderer.removeListener('release-control', listener);
  },
  selectFile: invoke('file-select'),
  pickFiles: (token, files) =>
    ipcRenderer.invoke(
      'file-pick',
      token,
      files ? Array.from(files).map((file) => webUtils.getPathForFile(file)) : null,
    ),
  openFile: invoke('file-open'),
  droppedFile: (token, file) =>
    ipcRenderer.invoke('file-select', token, webUtils.getPathForFile(file)),
  readFile: invoke('file-read'),
  beginFile: invoke('file-begin'),
  writeChunk: invoke('file-chunk'),
  finishFile: invoke('file-end'),
  cancelFile: invoke('file-cancel'),
});
