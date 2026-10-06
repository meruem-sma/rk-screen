const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanName, overlayGeometry } = require('../src/core/pointer');
const { qualitySettings } = require('../src/core/video');
const { validMessage } = require('../src/core/session');
test('Named pointer fits negative-position and scaled display bounds at every corner', () => {
  for (const bounds of [
    { x: -1536, y: -120, width: 1536, height: 864 },
    { x: 1920, y: 0, width: 1280, height: 720 },
  ])
    for (const x of [0, 0.5, 1])
      for (const y of [0, 0.5, 1]) {
        const g = overlayGeometry(bounds, { x, y });
        assert.ok(g.x >= bounds.x && g.y >= bounds.y);
        assert.ok(
          g.x + g.width <= bounds.x + bounds.width && g.y + g.height <= bounds.y + bounds.height,
        );
        assert.equal(g.x + g.tipX, bounds.x + Math.round(x * (bounds.width - 1)));
        assert.equal(g.y + g.tipY, bounds.y + Math.round(y * (bounds.height - 1)));
      }
  assert.equal(cleanName('Enes\n\u202eRK'), 'EnesRK');
  assert.equal(cleanName('a'.repeat(100)).length, 48);
});
test('Pointer and video telemetry require the current format and bounded dimensions', () => {
  const videoKey = '11111111-1111-4111-8111-111111111111';
  const p = { type: 'pointer', x: 0.5, y: 0.3, visible: true, videoKey };
  assert.equal(validMessage(p), true);
  for (const bad of [{ videoKey: undefined }, { visible: 'yes' }, { x: NaN }, { y: 2 }])
    assert.equal(validMessage({ ...p, ...bad }), false);
  const v = {
    type: 'video-info',
    videoKey,
    sourceWidth: 3840,
    sourceHeight: 2160,
    sentWidth: 1920,
    sentHeight: 1080,
    limitation: 'bandwidth',
  };
  assert.equal(validMessage(v), true);
  assert.equal(validMessage({ ...v, sourceWidth: Infinity }), false);
  assert.equal(validMessage({ ...v, limitation: '<img>' }), false);
});
test('Text and fluid profiles express different encoder priorities with bounded budgets', () => {
  assert.equal(qualitySettings('detail').hint, 'text');
  assert.equal(qualitySettings('fluid').hint, 'motion');
  assert.equal(qualitySettings('fluid').fps, 60);
  assert.equal(qualitySettings('fluid', 7680, 4320).bitrate, 48000000);
  assert.equal(qualitySettings('detail').degradation, 'maintain-resolution');
});
