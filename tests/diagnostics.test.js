const test = require('node:test');
const assert = require('node:assert/strict');
const { Diagnostics, sanitizeEvents } = require('../src/core/diagnostics');
test('diagnostics are bounded and exclude session contents, names, credentials and IPs', () => {
  const d = new Diagnostics();
  for (let i = 0; i < 150; i++)
    d.record('video', {
      fps: i,
      name: 'private',
      ip: '192.0.2.1',
      credential: 'secret',
      chat: 'message',
      sourceWidth: 1920,
      limitation: 'bandwidth',
    });
  const report = d.snapshot();
  assert.equal(report.length, 120);
  assert.equal(report[0].fps, 30);
  const text = JSON.stringify(report);
  for (const word of ['private', 'secret', '192.0.2.1', 'message'])
    assert.equal(text.includes(word), false);
  assert.equal(
    sanitizeEvents([{ event: 'receive', fps: NaN, rtt: Infinity, chat: 'no' }])[0].fps,
    undefined,
  );
  assert.throws(() => sanitizeEvents({ events: [] }), /Geçersiz/);
  assert.throws(() => sanitizeEvents(Array(121).fill({ event: 'video' })), /Geçersiz/);
});
