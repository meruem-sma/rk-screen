const { contextBridge } = require('electron');
let session = null;
let heldFileBegin = null;
const state = { inputs: [], writes: [], readCount: 0, reports: [], exports: [], copied: [] };
contextBridge.exposeInMainWorld('rkScreen', {
  info: async () => ({
    name: 'Çalışma bilgisayarı',
    version: localStorage.getItem('test-product-version') || '1.0.0-beta.1',
    build: '20261016.1',
  }),
  checkUpdate: async () => ({ available: true, build: '20261016.1', signed: false }),
  openUpdate: async () => {},
  copyText: async (text) => state.copied.push(text),
  exportChat: async (messages) => {
    state.exports.push(messages);
    return true;
  },
  pauseControl: async (_t, paused) => {
    session.controlPaused = paused;
  },
  connectionConfig: async () => ({ iceServers: [] }),
  saveDiagnostics: async (events) => {
    state.reports.push(events);
    return true;
  },
  sources: async () => [
    {
      id: 'screen:1',
      displayId: '1',
      name: 'Ekran 1',
      thumbnail:
        'data:image/svg+xml;base64,' +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="135"><rect width="240" height="135" fill="#29342b"/><rect x="20" y="20" width="200" height="95" rx="3" fill="#566e51"/></svg>',
        ),
    },
  ],
  begin: async (options) => {
    if (session) throw Error('Another session');
    session = { ...options, token: 'test-token' };
    return session.token;
  },
  end: async () => {
    session = null;
  },
  permissions: async (_t, p) => Object.assign(session, p),
  videoState: async (_t, p) => Object.assign(session, p, { inputPaused: true }),
  videoReady: async (_t, key) => {
    if (key !== session.videoKey) return false;
    session.inputPaused = false;
    return true;
  },
  input: async (t, p) => {
    if (
      session?.role === 'host' &&
      session.input &&
      !session.inputPaused &&
      p.videoKey === session.videoKey &&
      t === session.token
    )
      state.inputs.push(p);
  },
  inputKeepAlive: async (t) => session?.role === 'host' && session.input && t === session.token,
  cursor: async () => ({ x: 0.5, y: 0.5, visible: true }),
  pointer: async () => true,
  pointerEnabled: async () => {},
  clipboardRead: async () => {
    state.readCount++;
    return 'existing private text';
  },
  clipboardWrite: async (_t, text) => state.writes.push(text),
  clipboardPermission: async (_t, p) => {
    session.clipboard = p;
  },
  copyId: async () => {},
  fullscreen: async () => true,
  selectFile: async () => null,
  readFile: async () => null,
  beginFile: async () => {
    if (state.holdFileBegin)
      return new Promise((_resolve, reject) => {
        heldFileBegin = reject;
        state.fileBeginHeld = true;
      });
  },
  writeChunk: async () => 3,
  finishFile: async () => ({ name: 'test.txt' }),
  cancelFile: async () => {
    state.fileCancels = (state.fileCancels || 0) + 1;
  },
  testHoldFileBegin: () => {
    state.holdFileBegin = true;
  },
  testFailHeldFileBegin: () => {
    state.holdFileBegin = false;
    state.fileBeginHeld = false;
    heldFileBegin?.(Error('Test: eski aktarım sonradan başarısız oldu'));
    heldFileBegin = null;
  },
  testState: () => JSON.parse(JSON.stringify(state)),
});
