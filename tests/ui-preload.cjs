const { contextBridge } = require('electron');
let session = null;
const state = { inputs: [], writes: [], readCount: 0 };
contextBridge.exposeInMainWorld('rkScreen', {
  info: async () => ({ name: 'Çalışma bilgisayarı', version: '1.0.0-beta.1' }),
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
  beginFile: async () => {},
  writeChunk: async () => 3,
  finishFile: async () => ({ name: 'test.txt' }),
  cancelFile: async () => {},
  testState: () => JSON.parse(JSON.stringify(state)),
});
