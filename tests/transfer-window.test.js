const test = require('node:test'),
  assert = require('node:assert/strict');
const { ChunkWindow } = require('../src/core/transfer');
const chunk = (index) => ({ type: 'file-chunk', id: 'file-a', index, data: 'AAAA' });
test('File chunks overlap within a bounded window and receipts cannot acknowledge another file', async () => {
  const sent = [];
  const w = new ChunkWindow('file-a', (m) => (sent.push(m), true));
  const p = [0, 1, 2].map((i) => w.send(chunk(i)));
  await assert.rejects(w.send(chunk(3)), /dolu/);
  assert.equal(sent.length, 3);
  w.acknowledge('other', 0);
  assert.equal(w.pending.size, 3);
  w.acknowledge('file-a', 1);
  await p[1];
  const next = w.send(chunk(3));
  assert.equal(w.pending.size, 3);
  for (const index of [0, 2, 3, 3]) w.acknowledge('file-a', index);
  await Promise.all([...p, next]);
  assert.equal(w.pending.size, 0);
  w.cancel();
  await assert.rejects(w.send(chunk(4)), /kapalı/);
});
test('Chunk cancellation, failed sends and missing receipts release every waiter', async () => {
  const w = new ChunkWindow('file-a', () => true, 5);
  await assert.rejects(w.send(chunk(0)), /zaman/);
  assert.equal(w.pending.size, 0);
  const p = w.send(chunk(1)),
    rejected = assert.rejects(p, /iptal/);
  w.cancel();
  await rejected;
  assert.equal(w.pending.size, 0);
  const failed = new ChunkWindow('file-a', () => false);
  await assert.rejects(failed.send(chunk(0)), /kesildi/);
  assert.equal(failed.pending.size, 0);
});
