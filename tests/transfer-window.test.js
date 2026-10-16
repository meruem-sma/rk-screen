const test = require('node:test'),
  assert = require('node:assert/strict');
const { ChunkWindow, FilePacer, paceChunk, WINDOW_SIZE } = require('../src/core/transfer');
const chunk = (index) => ({ type: 'file-chunk', id: 'file-a', index, data: 'AAAA' });
test('File chunks overlap within a bounded window and receipts cannot acknowledge another file', async () => {
  const sent = [];
  const w = new ChunkWindow('file-a', (m) => (sent.push(m), true));
  const p = Array.from({ length: WINDOW_SIZE }, (_, i) => w.send(chunk(i)));
  await assert.rejects(w.send(chunk(WINDOW_SIZE)), /dolu/);
  assert.equal(sent.length, WINDOW_SIZE);
  w.acknowledge('other', 0);
  assert.equal(w.pending.size, WINDOW_SIZE);
  w.acknowledge('file-a', 1);
  await p[1];
  const next = w.send(chunk(WINDOW_SIZE));
  assert.equal(w.pending.size, WINDOW_SIZE);
  for (const index of [...Array(WINDOW_SIZE).keys(), WINDOW_SIZE, WINDOW_SIZE])
    w.acknowledge('file-a', index);
  await Promise.all([...p, next]);
  assert.equal(w.pending.size, 0);
  w.cancel();
  await assert.rejects(w.send(chunk(4)), /kapalı/);
});
test('Chunk cancellation, failed sends and missing receipts release every waiter', async () => {
  const w = new ChunkWindow('file-a', () => true, 5);
  await assert.rejects(w.send(chunk(0)), /zaman/);
  assert.equal(w.pending.size, 0);
  assert.equal(w.closed, true);
  const fresh = new ChunkWindow('file-a', () => true);
  const p = fresh.send(chunk(1)),
    rejected = assert.rejects(p, /iptal/);
  fresh.cancel();
  await rejected;
  assert.equal(fresh.pending.size, 0);
  const failed = new ChunkWindow('file-a', () => false);
  await assert.rejects(failed.send(chunk(0)), /kesildi/);
  assert.equal(failed.pending.size, 0);
});

test('Progress keeps a slow file alive; inactivity rejects the whole bounded window', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const w = new ChunkWindow('file-a', () => true, 100);
  const pending = [0, 1, 2].map((i) => w.send(chunk(i)));
  for (const index of [0, 1, 2]) {
    t.mock.timers.tick(80);
    w.acknowledge('other', index); // Wrong receipts must not refresh the deadline.
    w.acknowledge('file-a', index);
  }
  await Promise.all(pending);
  const stalled = Promise.all([w.send(chunk(3)), w.send(chunk(4))]);
  const failed = assert.rejects(stalled, /zaman/);
  t.mock.timers.tick(101);
  await failed;
  assert.equal(w.pending.size, 0);
  assert.equal(w.closed, true);
});

test('File upload ignores receive-only RTP estimates, probes healthy ACKs and reserves video capacity', () => {
  const rate = new FilePacer();
  rate.updateMedia({ available: 300000, videoBitrate: 0 }, 0);
  assert.equal(rate.budget(0), 4000000, 'receiving video must not cap uploads at 75 kbit/s');
  for (let now = 1000; now <= 10000; now += 1000) rate.acknowledge(20, now);
  assert.equal(rate.budget(10000), 16000000);
  rate.acknowledge(2000, 11000);
  assert.ok(rate.budget(11000) < 16000000);
  rate.reset(true);
  rate.updateMedia({ available: 20000000, videoBitrate: 17000000, limitation: 'none', loss: 0 }, 0);
  assert.equal(rate.budget(0), 2100000);
  rate.updateMedia(
    { available: 500000, videoBitrate: 480000, limitation: 'bandwidth', loss: 5 },
    0,
  );
  assert.equal(rate.budget(0), 64000);
  assert.equal(rate.budget(7000), 2000000, 'stale media estimates expire');
});

test('Pacing budgets encoded wire bytes rather than undercounting base64 on weak uplinks', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let complete = false;
  const pending = paceChunk(43692 + 256, 64000).then(() => {
    complete = true;
  });
  t.mock.timers.tick(4096);
  await Promise.resolve();
  assert.equal(complete, false, '32 KiB raw content is larger on the wire');
  t.mock.timers.tick(1400);
  await pending;
  assert.equal(complete, true);
});
