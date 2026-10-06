const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectedRoute,
  receiveSample,
  AdaptiveQuality,
  RecoveryBudget,
} = require('../src/core/transport');
const { isOlderProductRelease } = require('../scripts/release-policy.cjs');
const { validMessage } = require('../src/core/session');
const profile = { bitrate: 12000000, fps: 60 };

test('Adaptive bitrate needs sustained evidence and recovers slowly without oscillating', () => {
  const a = new AdaptiveQuality();
  const bad = { available: 2000000, limitation: 'bandwidth' };
  assert.equal(a.update(profile, bad), false);
  assert.equal(a.update(profile, bad), true);
  assert.equal(a.limits(profile).bitrate, 1700000);
  for (let i = 0; i < 20; i++) a.update(profile, bad);
  assert.equal(a.limits(profile).bitrate, 1700000);
  const good = { available: 20000000, limitation: 'none' };
  for (let i = 0; i < 4; i++) a.update(profile, good);
  assert.equal(a.limits(profile).bitrate, 1700000);
  a.update(profile, good);
  assert.equal(a.limits(profile).bitrate, 1955000);
  for (const available of [null, undefined, NaN, -1, 0]) a.update(profile, { available });
  assert.equal(a.limits(profile).bitrate, 1955000);
  a.reset();
  assert.deepEqual(a.limits(profile), profile);
});
test('CPU pressure reduces frame target; missing or bandwidth measurements do not claim CPU recovery', () => {
  const a = new AdaptiveQuality();
  a.update(profile, { limitation: 'cpu' });
  assert.equal(a.limits(profile).fps, 60);
  a.update(profile, { limitation: 'cpu' });
  assert.equal(a.limits(profile).fps, 30);
  for (let i = 0; i < 10; i++) a.update(profile, {});
  assert.equal(a.limits(profile).fps, 30);
  for (let i = 0; i < 5; i++) a.update(profile, { limitation: 'none' });
  assert.equal(a.limits(profile).fps, 60);
});
test('Stats use selected ICE transport, not an unrelated successful candidate pair', () => {
  const stats = new Map([
    [
      'unused',
      { type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 9 },
    ],
    ['transport', { type: 'transport', selectedCandidatePairId: 'selected' }],
    [
      'selected',
      {
        type: 'candidate-pair',
        availableOutgoingBitrate: 5000000,
        currentRoundTripTime: 0.045,
        localCandidateId: 'l',
        remoteCandidateId: 'r',
      },
    ],
    ['l', { candidateType: 'host' }],
    ['r', { candidateType: 'relay' }],
  ]);
  assert.deepEqual(selectedRoute(stats), { available: 5000000, rtt: 45, route: 'relay' });
  assert.deepEqual(selectedRoute(new Map()), { available: null, rtt: null, route: null });
});

test('Recovery reaches the original bitrate and sustained CPU pressure steps down to 15 then back gradually', () => {
  const a = new AdaptiveQuality();
  for (let i = 0; i < 2; i++) a.update(profile, { available: 2000000, limitation: 'cpu' });
  for (let i = 0; i < 2; i++) a.update(profile, { limitation: 'cpu' });
  assert.equal(a.limits(profile).fps, 15);
  for (let i = 0; i < 5; i++) a.update(profile, { available: 20000000, limitation: 'none' });
  assert.equal(a.limits(profile).fps, 30);
  for (let i = 0; i < 100; i++) a.update(profile, { available: 20000000, limitation: 'none' });
  assert.equal(a.limits(profile).bitrate, profile.bitrate);
  assert.equal(a.limits(profile).fps, profile.fps);
});
test('Receive counters reject resets and other streams; static frames are valid zero FPS', () => {
  const first = {
    id: 'v1',
    timestamp: 1000,
    bytesReceived: 1000,
    framesDecoded: 20,
    packetsReceived: 90,
    packetsLost: 1,
  };
  const next = {
    id: 'v1',
    timestamp: 3000,
    bytesReceived: 1001000,
    framesDecoded: 80,
    packetsReceived: 189,
    packetsLost: 2,
  };
  const sample = receiveSample(next, first);
  assert.equal(sample.fps, 30);
  assert.equal(sample.mbps, 4);
  assert.equal(sample.loss, 1);
  assert.equal(receiveSample({ ...next, id: 'v2' }, first).mbps, null);
  assert.equal(receiveSample({ ...next, bytesReceived: 1 }, first).mbps, null);
  assert.equal(receiveSample({ ...next, framesDecoded: 20 }, first).fps, 0);
  assert.equal(receiveSample(next, null).fps, null);
});
test('Recovery attempts are bounded and reset after the rolling minute', () => {
  const budget = new RecoveryBudget();
  assert.equal(budget.take(1000), true);
  assert.equal(budget.take(5000), true);
  assert.equal(budget.take(9000), false);
  assert.equal(budget.take(61000), true);
});
test('Beta cleanup respects beta ordering, stable precedence, and product identity', () => {
  const older = (v, current) =>
    isOlderProductRelease(v, { name: 'rk-screen', version: v }, current);
  assert.equal(older('0.7.0', '1.0.0-beta.1'), true);
  assert.equal(older('1.0.0-beta.2', '1.0.0-beta.10'), true);
  assert.equal(older('1.0.0', '1.0.0-beta.10'), false);
  assert.equal(older('1.0.0-beta.10', '1.0.0'), true);
  assert.equal(older('1.0.0-beta.1', '1.0.0-beta.1'), false);
  assert.equal(older('../0.7.0', '1.0.0-beta.1'), false);
  assert.equal(older('0.7.0', 'invalid'), false);
});
test('Recovery requests and optional quality metrics are bounded by the protocol', () => {
  assert.equal(validMessage({ type: 'video-interrupted', videoKey: 'old' }), false);
  const packet = {
    type: 'video-info',
    videoKey: '11111111-1111-4111-8111-111111111111',
    sourceWidth: 1920,
    sourceHeight: 1080,
    sentWidth: 1920,
    sentHeight: 1080,
    limitation: 'none',
    targetFps: 60,
    maxBitrate: 24000000,
  };
  assert.equal(validMessage(packet), true);
  assert.equal(validMessage({ ...packet, targetFps: Infinity }), false);
  assert.equal(validMessage({ ...packet, maxBitrate: -1 }), false);
});
