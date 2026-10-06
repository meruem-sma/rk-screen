(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenSession = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  class SessionGate {
    constructor() {
      this.reset();
    }
    reserve(connection, role) {
      if (!connection || this.connection || !['host', 'controller'].includes(role)) return false;
      this.connection = connection;
      this.role = role;
      return true;
    }
    approve(connection) {
      if (!connection || connection !== this.connection) return false;
      this.approved = true;
      return true;
    }
    allows(connection) {
      return this.approved && connection === this.connection;
    }
    reset() {
      this.connection = null;
      this.role = null;
      this.approved = false;
    }
  }
  const inputTypes = new Set([
    'mouse-move',
    'mouse-button',
    'mouse-wheel',
    'key',
    'text',
    'release-input',
  ]);
  const validVideoKey = (key) =>
    typeof key === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key);
  function validMessage(m) {
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return false;
    const unit = (n) => Number.isFinite(n) && n >= 0 && n <= 1;
    switch (m.type) {
      case 'mouse-move':
        return unit(m.x) && unit(m.y);
      case 'mouse-button':
        return (
          unit(m.x) &&
          unit(m.y) &&
          ['left', 'middle', 'right'].includes(m.button) &&
          typeof m.pressed === 'boolean'
        );
      case 'mouse-wheel':
        return (
          Number.isFinite(m.dx) &&
          Number.isFinite(m.dy) &&
          Math.abs(m.dx) <= 2000 &&
          Math.abs(m.dy) <= 2000
        );
      case 'key':
        return typeof m.code === 'string' && m.code.length <= 32 && typeof m.pressed === 'boolean';
      case 'text':
        return (
          typeof m.text === 'string' &&
          m.text.length > 0 &&
          m.text.length <= 16 &&
          !/[\x00-\x1f\x7f]/.test(m.text)
        );
      case 'chat':
        return (
          typeof m.id === 'string' &&
          /^[a-zA-Z0-9-]{1,64}$/.test(m.id) &&
          typeof m.text === 'string' &&
          m.text.length > 0 &&
          m.text.length <= 4000
        );
      case 'chat-ack':
        return typeof m.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(m.id);
      case 'clipboard':
        return typeof m.text === 'string' && m.text.length <= 100000;
      case 'cursor':
      case 'pointer':
        return (
          unit(m.x) && unit(m.y) && typeof m.visible === 'boolean' && validVideoKey(m.videoKey)
        );
      case 'video-info':
        return (
          (m.targetFps === undefined ||
            (Number.isFinite(m.targetFps) && m.targetFps > 0 && m.targetFps <= 120)) &&
          (m.maxBitrate === undefined ||
            (Number.isFinite(m.maxBitrate) && m.maxBitrate > 0 && m.maxBitrate <= 100000000)) &&
          validVideoKey(m.videoKey) &&
          [m.sourceWidth, m.sourceHeight, m.sentWidth, m.sentHeight].every(
            (n) => Number.isSafeInteger(n) && n >= 0 && n <= 32768,
          ) &&
          ['none', 'cpu', 'bandwidth', 'other', 'unknown'].includes(m.limitation)
        );
      case 'ping':
      case 'pong':
        return Number.isFinite(m.time);
      case 'quality':
        return ['balanced', 'detail', 'speed', 'fluid'].includes(m.value);
      case 'permissions':
        return typeof m.input === 'boolean' && typeof m.clipboard === 'boolean';
      case 'release-input':
      case 'bye':
      case 'input-error':
        return true;
      case 'ready':
      case 'video-visible':
      case 'video-interrupted':
      case 'refresh-video':
      case 'video-reset':
        return validVideoKey(m.videoKey);
      case 'file-offer':
        return (
          typeof m.id === 'string' &&
          /^[a-zA-Z0-9-]{1,64}$/.test(m.id) &&
          typeof m.name === 'string' &&
          m.name.length <= 240 &&
          Number.isSafeInteger(m.size) &&
          m.size >= 0 &&
          m.size <= 512 * 1024 * 1024
        );
      case 'file-chunk':
        return (
          typeof m.id === 'string' &&
          Number.isSafeInteger(m.index) &&
          m.index >= 0 &&
          typeof m.data === 'string' &&
          m.data.length <= 65536
        );
      case 'file-end':
        return typeof m.id === 'string' && /^[a-f0-9]{64}$/.test(m.hash || '');
      case 'file-reply':
        return (
          typeof m.id === 'string' &&
          ['accept', 'reject', 'chunk', 'saved', 'error', 'cancel'].includes(m.status)
        );
      default:
        return false;
    }
  }
  class RequestLimiter {
    constructor() {
      this.requests = [];
    }
    allow(peer, now = Date.now()) {
      this.requests = this.requests.filter((r) => now - r.time < 60000);
      if (this.requests.length >= 10 || this.requests.filter((r) => r.peer === peer).length >= 3)
        return false;
      this.requests.push({ peer, time: now });
      return true;
    }
  }
  return { SessionGate, validMessage, inputTypes, RequestLimiter, validVideoKey };
});
