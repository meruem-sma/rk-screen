const test = require('node:test');
const assert = require('node:assert/strict');
const { keyPacket, textPackets, mousePacket } = require('../src/input/packets');
const { InputInjector } = require('../src/input/injector');
const { qualitySettings, coordinates } = require('../src/core/video');
const { validMessage } = require('../src/core/session');
test('Windows x64 input buffers encode extended keys, releases and signed wheels', () => {
  const arrow = keyPacket('ArrowLeft', false);
  assert.equal(arrow.length, 40);
  assert.equal(arrow.readUInt32LE(0), 1);
  assert.equal(arrow.readUInt16LE(10), 0x4b);
  assert.equal(arrow.readUInt32LE(12), 11);
  assert.equal(keyPacket('KeyA', true).readUInt16LE(10), 0x1e);
  assert.equal(keyPacket('Unknown', true), null);
  assert.equal(mousePacket(0x0800, -120).readInt32LE(16), -120);
});
test('Turkish characters use Unicode, including surrogate pairs', () => {
  const text = 'şİığçöü😀',
    packets = textPackets(text);
  assert.equal(packets.length, text.length * 2);
  let restored = '';
  for (let i = 0; i < packets.length; i += 2) {
    restored += String.fromCharCode(packets[i].readUInt16LE(10));
    assert.equal(packets[i].readUInt32LE(12), 4);
    assert.equal(packets[i + 1].readUInt32LE(12), 6);
  }
  assert.equal(restored, text);
  assert.equal(validMessage({ type: 'text', text }), true);
  assert.equal(validMessage({ type: 'text', text: '\n' }), false);
});
test('Drag release reaches final position and cleanup releases only owned inputs', () => {
  const packets = [],
    moves = [];
  const input = new InputInjector({
    send: (p) => (packets.push(...p), p.length),
    move: (x, y) => (moves.push([x, y]), true),
  });
  input.keyEvent('ControlLeft', true);
  input.keyEvent('KeyC', true);
  input.mouseButton('left', true, 50, 60);
  input.mouseButton('left', false, 100, 110);
  assert.deepEqual(moves, [
    [50, 60],
    [100, 110],
  ]);
  input.releaseAll();
  assert.equal(input.keys.size, 0);
  assert.equal(input.buttons.size, 0);
  const count = packets.length;
  input.releaseAll();
  input.keyEvent('ShiftLeft', false);
  assert.equal(packets.length, count);
});
test('Blocked Windows input is reported and failed releases remain retryable', () => {
  let blocked = false;
  const input = new InputInjector({ send: (p) => (blocked ? 0 : p.length), move: () => true });
  input.keyEvent('ControlLeft', true);
  blocked = true;
  assert.throws(() => input.releaseAll(), /Windows/);
  assert.equal(input.keys.size, 1);
  blocked = false;
  input.releaseAll();
  assert.equal(input.keys.size, 0);
});
test('AltGr Unicode temporarily releases and restores only remotely owned modifiers', () => {
  const packets = [];
  const input = new InputInjector({ send: (p) => (packets.push(...p), p.length) });
  input.keyEvent('ControlLeft', true);
  input.keyEvent('AltRight', true);
  input.keyEvent('KeyC', true);
  packets.length = 0;
  input.text('@ş');
  assert.deepEqual(
    packets.map((p) => [p.readUInt16LE(10), p.readUInt32LE(12)]),
    [
      [29, 10],
      [56, 11],
      [64, 4],
      [64, 6],
      [351, 4],
      [351, 6],
      [29, 8],
      [56, 9],
    ],
  );
  assert.deepEqual([...input.keys], ['KeyC', 'ControlLeft', 'AltRight']);
  packets.length = 0;
  input.releaseAll();
  input.text('İ');
  assert.deepEqual(
    packets.slice(-2).map((p) => p.readUInt32LE(12)),
    [4, 6],
  );
  assert.ok(!packets.some((p) => p.readUInt16LE(10) === 42));
});
test('Unicode failure restores modifiers and partial release failure restores earlier releases', () => {
  let fail = () => false;
  const input = new InputInjector({ send: (p) => (fail(p) ? 0 : p.length) });
  input.keyEvent('ControlLeft', true);
  input.keyEvent('AltRight', true);
  fail = (p) => p[0].readUInt32LE(12) === 4;
  assert.throws(() => input.text('@'), /Windows/);
  assert.deepEqual([...input.keys], ['ControlLeft', 'AltRight']);
  fail = (p) => p[0].readUInt32LE(12) === 11;
  assert.throws(() => input.text('@'), /Windows/);
  assert.equal(input.keys.has('ControlLeft'), true);
  assert.equal(input.keys.has('AltRight'), true);
  fail = () => false;
  input.releaseAll();
  assert.equal(input.keys.size, 0);
});
test('Lost connection releases held inputs; heartbeats keep legitimate long holds alive', () => {
  let now = 0,
    blocked = false;
  const packets = [];
  const input = new InputInjector(
    { send: (p) => (blocked ? 0 : (packets.push(...p), p.length)), move: () => true },
    () => now,
  );
  input.keyEvent('ShiftLeft', true);
  input.mouseButton('left', true);
  now = 5000;
  assert.equal(input.releaseExpired(), false);
  input.keepAlive();
  now = 10999;
  assert.equal(input.releaseExpired(), false);
  now = 11000;
  blocked = true;
  assert.throws(() => input.releaseExpired(), /Windows/);
  assert.equal(input.keys.size, 1);
  assert.equal(input.buttons.size, 1);
  blocked = false;
  assert.equal(input.releaseExpired(), true);
  assert.equal(input.keys.size + input.buttons.size, 0);
  assert.equal(packets.length, 4);
  now = 100000;
  assert.equal(input.releaseExpired(), false);
  assert.equal(packets.length, 4);
});
test('Fit, cropped fill, original scrolling and drag outside map to the correct pixels', () => {
  const rect = { left: 100, top: 100, width: 1000, height: 1000 };
  assert.equal(coordinates(rect, 1920, 1080, 'fit', 110, 110), null);
  assert.deepEqual(coordinates(rect, 1920, 1080, 'fit', 600, 600), { x: 0.5, y: 0.5 });
  const crop = coordinates(rect, 1920, 1080, 'fill', 100, 600);
  assert.ok(Math.abs(crop.x - 0.21875) < 0.001);
  assert.deepEqual(
    coordinates(
      { left: -100, top: -50, width: 1920, height: 1080 },
      1920,
      1080,
      'original',
      860,
      490,
    ),
    { x: 0.5, y: 0.5 },
  );
  assert.deepEqual(coordinates(rect, 1920, 1080, 'fit', 2000, 2000, true), { x: 1, y: 1 });
});
test('Text quality keeps resolution, scales bandwidth for 4K and bounds FPS', () => {
  assert.equal(qualitySettings('detail', 1920, 1080).bitrate, 20000000);
  assert.equal(qualitySettings('detail', 3840, 2160).bitrate, 40000000);
  assert.equal(qualitySettings('balanced').degradation, 'maintain-resolution');
  assert.equal(qualitySettings('detail').fps, 30);
  assert.equal(qualitySettings('speed').degradation, 'maintain-resolution');
});
