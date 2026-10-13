(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenDiagnostics = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const choices = {
    event: ['connection', 'video', 'receive', 'recovery', 'quality', 'relay-error'],
    state: ['online', 'offline', 'waiting', 'unsupported'],
    route: ['direct', 'relay', 'unknown'],
    limitation: ['none', 'bandwidth', 'cpu', 'other', 'unknown'],
    profile: ['balanced', 'detail', 'fluid', 'speed'],
  };
  const numbers = [
    'time',
    'rtt',
    'fps',
    'loss',
    'mbps',
    'targetFps',
    'maxBitrate',
    'available',
    'sourceWidth',
    'sourceHeight',
    'sentWidth',
    'sentHeight',
    'buffered',
    'code',
  ];
  function sanitizeEvents(entries) {
    if (!Array.isArray(entries) || entries.length > 120) throw Error('Geçersiz bağlantı raporu.');
    return entries
      .filter((e) => e && choices.event.includes(e.event))
      .map((e) => {
        const clean = {};
        for (const [key, allowed] of Object.entries(choices))
          if (allowed.includes(e[key])) clean[key] = e[key];
        for (const key of numbers)
          if (Number.isFinite(e[key]) && e[key] >= 0 && e[key] <= 1e15) clean[key] = e[key];
        return clean;
      });
  }
  class Diagnostics {
    constructor() {
      this.events = [];
    }
    record(event, data = {}) {
      const clean = sanitizeEvents([{ ...data, event, time: Date.now() }])[0];
      if (clean) {
        this.events.push(clean);
        if (this.events.length > 120) this.events.shift();
      }
    }
    snapshot() {
      return sanitizeEvents(this.events);
    }
  }
  return { Diagnostics, sanitizeEvents };
});
