const { ipcRenderer, contextBridge } = require('electron');
contextBridge.exposeInMainWorld('cursorView', {
  subscribe: (callback) =>
    ipcRenderer.on('cursor-position', (_event, position) => callback(position)),
});
