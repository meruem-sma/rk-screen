const { contextBridge, ipcRenderer } = require('electron');
const methods = [
  'info',
  'sources',
  'begin',
  'end',
  'permissions',
  'videoState',
  'videoReady',
  'input',
  'cursor',
  'pointer',
  'pointerEnabled',
  'clipboardRead',
  'clipboardWrite',
  'clipboardPermission',
  'copyId',
  'fullscreen',
  'selectFile',
  'readFile',
  'beginFile',
  'writeChunk',
  'finishFile',
  'cancelFile',
];
contextBridge.exposeInMainWorld(
  'rkScreen',
  Object.fromEntries(
    methods.map((method) => [method, (...args) => ipcRenderer.invoke('e2e-api', method, ...args)]),
  ),
);
