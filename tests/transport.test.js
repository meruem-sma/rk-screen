const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectedRoute,
  receiveSample,
  AdaptiveQuality,
  RecoveryBudget,
  RealtimeLane,
  RetryBackoff,
} = require('../src/core/transport');
const { isOlderProductRelease } = require('../scripts/release-policy.cjs');
const { validMessage } = require('../src/core/session');
const profile = { bitrate: 12000000, fps: 60 };

test('Transport estimates cannot ratchet the encoder ceiling down on a healthy or constrained link', () => {
  const a = new AdaptiveQuality();
  const bad = { available: 2000000, limitation: 'bandwidth' };
  assert.equal(a.update(profile, bad), false);
  assert.equal(a.update(profile, bad), false);
  assert.equal(a.limits(profile).bitrate, profile.bitrate);
  for (let i = 0; i < 20; i++) a.update(profile, bad);
  assert.equal(a.limits(profile).bitrate, profile.bitrate);
  assert.equal(a.limits(profile).fps, 8);
  const good = { available: 750000, limitation: 'none' };
  for (let i = 0; i < 4; i++) a.update(profile, good);
  assert.equal(a.limits(profile).fps, 8);
  a.update(profile, good);
  assert.equal(a.limits(profile).fps, 15);
  for (let i = 0; i < 5; i++) a.update(profile, good);
  assert.equal(a.limits(profile).fps, 30);
  for (let i = 0; i < 5; i++) a.update(profile, good);
  assert.equal(a.limits(profile).fps, 60);
  for (const available of [null, undefined, NaN, -1, 0]) a.update(profile, { available });
  assert.equal(a.limits(profile).bitrate, profile.bitrate);
  a.reset();
  assert.deepEqual(a.limits(profile), profile);
});
test('Sustained weak links reduce frames before scaling; text mode keeps full resolution', () => {
  const { qualitySettings } = require('../src/core/video');
  const a = new AdaptiveQuality(),
    auto = qualitySettings('auto', 1920, 1080);
  for (let i = 0; i < 5; i++) a.update(auto, { limitation: 'bandwidth' });
  assert.equal(a.limits(auto).fps, 30);
  assert.equal(a.limits(auto).scale, 1);
  for (let i = 0; i < 5; i++) a.update(auto, { limitation: 'bandwidth' });
  assert.equal(a.limits(auto).fps, 15);
  assert.equal(a.limits(auto).scale, 1.5);
  assert.equal(a.limits(qualitySettings('detail')).scale, 1);
  for (let i = 0; i < 10; i++) a.update(auto, { limitation: 'bandwidth' });
  assert.equal(a.limits(auto).fps, 8);
  for (let i = 0; i < 20; i++) a.update(auto, {});
  assert.equal(a.limits(auto).fps, 8, 'missing stats cannot claim recovery');
  for (let i = 0; i < 15; i++) a.update(auto, { limitation: 'none' });
  assert.equal(a.limits(auto).fps, 60);
  assert.equal(a.limits(auto).scale, 1);
  assert.equal(a.limits(auto).bitrate, 16000000);
});

test('Real-time lane keeps PeerJS control channel, discards old motion and cannot inject reliable commands', () => {
  let originalEvents = 0;
  const channel = {
    label: 'rk-screen-live-v8',
    ordered: false,
    maxRetransmits: 0,
    readyState: 'open',
    bufferedAmount: 0,
    messages: [],
    send(m) {
      this.messages.push(m);
    },
    close() {
      this.closed = true;
    },
  };
  const pc = {
    ondatachannel() {
      originalEvents++;
    },
    createDataChannel() {
      return channel;
    },
  };
  const received = [];
  const lane = new RealtimeLane(pc, (m) => received.push(m));
  pc.ondatachannel({ channel: { label: 'peerjs-control' } });
  assert.equal(originalEvents, 1);
  lane.start();
  assert.equal(lane.send({ type: 'pointer', x: 0.1, y: 0.2 }), true);
  channel.bufferedAmount = 10000;
  lane.send({ type: 'pointer', x: 0.9, y: 0.9 });
  assert.equal(channel.messages.length, 1, 'congested lane must not queue stale motion');
  for (const m of [
    { type: 'cursor', liveSequence: 2 },
    { type: 'cursor', liveSequence: 1 },
    { type: 'key', liveSequence: 3 },
    { type: 'pointer', liveSequence: 1 },
  ])
    channel.onmessage({ data: JSON.stringify(m) });
  assert.deepEqual(
    received.map((m) => m.type),
    ['cursor', 'pointer'],
  );
  lane.close();
  pc.ondatachannel({ channel: { label: 'peerjs-control' } });
  assert.equal(originalEvents, 2);
  assert.equal(channel.closed, true);
});

test('Signaling retries back off to a bounded interval and reset after reconnecting', () => {
  const b = new RetryBackoff();
  assert.deepEqual(
    Array.from({ length: 8 }, () => b.next()),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000],
  );
  b.reset();
  assert.equal(b.next(), 1000);
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
