const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { SessionGate, validMessage } = require('../src/core/session');
const { FileReceiver, safeName, MAX_FILE_SIZE } = require('../src/core/file-store');

test('Only the approved connection owns the session; other peers cannot replace it', () => {
  const gate = new SessionGate(),
    a = {},
    b = {};
  assert.equal(gate.approve(null), false);
  assert.equal(gate.reserve(null, 'host'), false);
  assert.equal(gate.reserve(a, 'host'), true);
  assert.equal(gate.allows(a), false);
  assert.equal(gate.reserve(b, 'host'), false);
  assert.equal(gate.approve(b), false);
  assert.equal(gate.allows(b), false);
  assert.equal(gate.approve(a), true);
  assert.equal(gate.allows(a), true);
  assert.equal(gate.allows(b), false);
  gate.reset();
  assert.equal(gate.allows(a), false);
  assert.equal(gate.reserve(b, 'controller'), true);
  assert.equal(gate.allows(b), false);
});
test('Malformed input, unbounded messages and unknown commands are rejected', () => {
  for (const packet of [
    null,
    {},
    { type: 'unknown' },
    { type: 'key', code: [], pressed: true },
    { type: 'mouse-move', x: Infinity, y: 0 },
    { type: 'mouse-button', x: 0, y: 1, button: 'left', pressed: 'true' },
    { type: 'chat', text: 'x'.repeat(2001) },
    { type: 'file-offer', id: 'x', name: 'x', size: MAX_FILE_SIZE + 1 },
    { type: 'file-end', id: 'x', hash: 'invalid' },
  ])
    assert.equal(validMessage(packet), false);
  assert.equal(validMessage({ type: 'mouse-move', x: 0, y: 1 }), true);
  assert.equal(validMessage({ type: 'key', code: 'Quote', pressed: false }), true);
});
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'menzil-test-'));
  const receiver = new FileReceiver(dir);
  t.after(async () => {
    await receiver.cancel();
    await fs.rm(dir, { recursive: true, force: true });
  });
  return { dir, receiver };
}
test('Complete files are verified and never overwrite existing files', async (t) => {
  const { dir, receiver } = await fixture(t),
    data = Buffer.from('RK Screen dosya aktarımı');
  await fs.writeFile(path.join(dir, 'not.txt'), 'existing');
  await receiver.begin({ id: 'one', name: '../../not.txt', size: data.length });
  await receiver.chunk('one', 0, data.toString('base64'));
  const result = await receiver.finish(
    'one',
    crypto.createHash('sha256').update(data).digest('hex'),
  );
  assert.equal(result.name, 'not (1).txt');
  assert.deepEqual(await fs.readFile(result.path), data);
  assert.equal(await fs.readFile(path.join(dir, 'not.txt'), 'utf8'), 'existing');
  assert.equal((await fs.readdir(dir)).filter((n) => n.endsWith('.part')).length, 0);
});
test('Out of order, wrong-id, oversized and incomplete file chunks fail', async (t) => {
  const { receiver } = await fixture(t);
  await receiver.begin({ id: 'one', name: 'x.txt', size: 3 });
  await assert.rejects(receiver.begin({ id: 'two', name: 'y.txt', size: 3 }));
  await assert.rejects(receiver.chunk('other', 0, 'YWJj'));
  await assert.rejects(receiver.chunk('one', 1, 'YWJj'));
  await assert.rejects(receiver.chunk('one', 0, 'YWJjZA=='));
  await assert.rejects(receiver.finish('one', '0'.repeat(64)));
  await receiver.chunk('one', 0, 'YWJj');
  await assert.rejects(receiver.finish('one', '0'.repeat(64)));
});
test('Cancellation removes partial files; empty files can be transferred', async (t) => {
  const { dir, receiver } = await fixture(t);
  await receiver.begin({ id: 'one', name: 'x', size: 3 });
  await receiver.chunk('one', 0, 'YWJj');
  await receiver.cancel();
  assert.deepEqual(await fs.readdir(dir), []);
  await receiver.begin({ id: 'two', name: 'empty.txt', size: 0 });
  const result = await receiver.finish('two', crypto.createHash('sha256').digest('hex'));
  assert.equal((await fs.stat(result.path)).size, 0);
});
test('Windows filenames and relative paths are sanitized', () => {
  assert.equal(safeName('..\\..\\name.txt'), 'name.txt');
  assert.equal(safeName('CON.txt'), 'dosya_CON.txt');
  assert.equal(safeName('x:secret.txt'), 'secret.txt');
  assert.equal(safeName('...'), 'dosya_adsiz');
  assert.equal(safeName('a'.repeat(179) + ' .txt'), 'a'.repeat(179));
});
