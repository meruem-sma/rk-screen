const { contextBridge, ipcRenderer, webUtils } = require('electron');
const invoke =
  (channel) =>
  (...args) =>
    ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('rkScreen', {
  info: invoke('app-info'),
  compatibility: invoke('compatibility'),
  sources: invoke('sources'),
  begin: invoke('session-begin'),
  end: invoke('session-end'),
  videoState: invoke('video-state'),
  videoReady: invoke('video-ready'),
  permissions: invoke('permissions'),
  input: invoke('input'),
  cursor: invoke('cursor'),
  pointer: invoke('pointer'),
  pointerEnabled: invoke('pointer-enabled'),
  clipboardRead: invoke('clipboard-read'),
  clipboardWrite: invoke('clipboard-write'),
  clipboardPermission: invoke('clipboard-permission'),
  copyId: invoke('copy-id'),
  fullscreen: invoke('fullscreen'),
  selectFile: invoke('file-select'),
  droppedFile: (token, file) =>
    ipcRenderer.invoke('file-select', token, webUtils.getPathForFile(file)),
  readFile: invoke('file-read'),
  beginFile: invoke('file-begin'),
  writeChunk: invoke('file-chunk'),
  finishFile: invoke('file-end'),
  cancelFile: invoke('file-cancel'),
});
