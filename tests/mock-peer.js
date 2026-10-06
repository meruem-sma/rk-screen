class Emitter {
  constructor() {
    this.events = {};
  }
  on(name, fn) {
    (this.events[name] ??= []).push(fn);
    return this;
  }
  emit(name, data) {
    for (const fn of this.events[name] || []) fn(data);
  }
  removeAllListeners() {
    this.events = {};
  }
}
class Connection extends Emitter {
  constructor(id, metadata) {
    super();
    this.peer = id;
    this.metadata = metadata;
    this.open = false;
    this.sent = [];
    this.dataChannel = { bufferedAmount: 0 };
  }
  send(data) {
    this.sent.push(data);
    if (data.type === 'ping')
      setTimeout(() => this.emit('data', { type: 'pong', time: data.time }), 10);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    this.emit('close');
  }
}
class Call extends Emitter {
  constructor(id) {
    super();
    this.peer = id;
    this.metadata = { version: 7 };
    this.peerConnection = {
      addEventListener() {},
      getSenders: () => [],
      getStats: async () => new Map(),
    };
  }
  answer() {}
  close() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
}
window.Peer = class extends Emitter {
  constructor(id) {
    super();
    this.id = id;
    this.calls = [];
    window.testPeer = this;
    setTimeout(() => this.emit('open'), 30);
  }
  connect(id, options) {
    const c = new Connection(id, options.metadata);
    window.testConnection = c;
    setTimeout(() => {
      c.open = true;
      c.emit('open');
    }, 20);
    return c;
  }
  incoming(name = 'Destek bilgisayarı') {
    const c = new Connection('rkscreen-v7-123456789', { version: 7, name });
    this.emit('connection', c);
    setTimeout(() => {
      c.open = true;
      c.emit('open');
    }, 20);
    return c;
  }
  call(id) {
    const call = new Call(id);
    this.calls.push(call);
    return call;
  }
  destroy() {
    this.destroyed = true;
  }
  reconnect() {
    this.emit('open');
  }
};
Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
  value: async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvas.getContext('2d').fillRect(0, 0, 1280, 720);
    return canvas.captureStream(1);
  },
});
