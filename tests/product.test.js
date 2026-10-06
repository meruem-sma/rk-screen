const test = require('node:test');
const assert = require('node:assert/strict');
const { RequestLimiter, validMessage } = require('../src/core/session');
const { geometry, coordinates } = require('../src/core/video');
const { isOlderProductRelease } = require('../scripts/release-policy.cjs');
test('Video handshake rejects missing and malformed stream capabilities', () => {
  for (const type of ['ready', 'video-visible', 'video-reset', 'refresh-video']) {
    assert.equal(validMessage({ type, videoKey: '11111111-1111-4111-8111-111111111111' }), true);
    for (const videoKey of [undefined, null, '', 'old-session', 123, {}, 'x'.repeat(10000)])
      assert.equal(validMessage({ type, videoKey }), false);
  }
});
test('Connection request limits bound per-peer and global attempts, then recover', () => {
  const limiter = new RequestLimiter();
  for (let i = 0; i < 3; i++) assert.equal(limiter.allow('one', 1000), true);
  assert.equal(limiter.allow('one', 1000), false);
  for (let i = 0; i < 7; i++) assert.equal(limiter.allow('peer-' + i, 1000), true);
  assert.equal(limiter.allow('other', 1000), false);
  assert.equal(limiter.requests.length, 10);
  assert.equal(limiter.allow('one', 61000), true);
});
test('Chat IDs and delivery receipts are bounded; multiline content is accepted', () => {
  assert.equal(validMessage({ type: 'chat', id: 'one', text: 'Merhaba\nİkinci satır' }), true);
  assert.equal(validMessage({ type: 'chat', text: 'no id' }), false);
  assert.equal(validMessage({ type: 'chat', id: 'one', text: 'x'.repeat(4001) }), false);
  assert.equal(validMessage({ type: 'chat-ack', id: 'one' }), true);
  assert.equal(validMessage({ type: 'chat-ack', id: 'x'.repeat(65) }), false);
});
test('One-to-one video pixels respect Windows 100/125/150/200 percent scaling', () => {
  for (const dpr of [1, 1.25, 1.5, 2]) {
    const rect = { left: 20, top: 30, width: 1920 / dpr, height: 1080 / dpr };
    const box = geometry(rect, 1920, 1080, 'original', dpr);
    assert.equal(box.width * dpr, 1920);
    assert.equal(box.height * dpr, 1080);
    const p = coordinates(rect, 1920, 1080, 'original', 20 + 960 / dpr, 30 + 540 / dpr, false, dpr);
    assert.deepEqual(p, { x: 0.5, y: 0.5 });
  }
});
test('Release cleanup only accepts older identified product builds', () => {
  assert.equal(isOlderProductRelease('0.4.0', { name: 'menzil', version: '0.4.0' }, '0.5.0'), true);
  for (const [folder, info] of [
    ['0.5.0', { name: 'rk-screen', version: '0.5.0' }],
    ['0.6.0', { name: 'rk-screen', version: '0.6.0' }],
    ['0.4.0', { name: 'other-project', version: '0.4.0' }],
    ['../0.4.0', { name: 'rk-screen', version: '../0.4.0' }],
    ['0.4.0', { name: 'rk-screen', version: '0.3.0' }],
  ])
    assert.equal(isOlderProductRelease(folder, info, '0.5.0'), false);
});
