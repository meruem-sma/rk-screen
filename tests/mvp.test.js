const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { validateRelease, checkUpdate } = require('../src/core/updates');
const { FileSender } = require('../src/core/file-sender');
const { normalize, remember } = require('../src/core/devices');
const { SessionTraffic, validMessage } = require('../src/core/session');
const { remoteLoss, receiveSample, AdaptiveQuality } = require('../src/core/transport');
const { paceChunk } = require('../src/core/transfer');
const { explain } = require('../src/core/errors');
const current = { version: '1.0.0-beta.1', build: '20261015.1' };
const release = () => ({
  ...current,
  build: '20261015.2',
  signed: false,
  files: {
    setup: {
      url: 'https://github.com/meruem-sma/rk-screen-downloads/releases/download/v1.0.0-beta.1/RK-Screen-Setup-1.0.0-beta.1.exe',
      sha256: 'a'.repeat(64),
      bytes: 100,
    },
  },
});

test('Update checks compare Beta 1 builds and reject foreign or corrupted downloads', async () => {
  assert.equal(validateRelease(release(), current).available, true);
  assert.equal(validateRelease(release(), { ...current, build: '20261015.2' }).available, false);
  assert.equal(validateRelease(release(), { ...current, version: '1.0.0' }).available, false);
  for (const bad of [
    'http://github.com/x.exe',
    'https://evil.invalid/x.exe',
    release().files.setup.url + '?x=1',
  ]) {
    const value = release();
    value.files.setup.url = bad;
    assert.throws(() => validateRelease(value, current));
  }
  const bad = release();
  bad.files.setup.sha256 = 'wrong';
  assert.throws(() => validateRelease(bad, current));
  const result = await checkUpdate(current, async (url, options) => {
    assert.ok(
      url.startsWith(
        'https://raw.githubusercontent.com/meruem-sma/rk-screen-downloads/main/release.json?',
      ),
    );
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(release()));
  });
  assert.equal(result.available, true);
  await assert.rejects(
    checkUpdate(current, async () => new Response('x'.repeat(17000))),
    /büyük/,
  );
  await assert.rejects(
    checkUpdate(current, async () => new Response('', { status: 503 })),
    /ulaşılamadı/,
  );
});

test('Device names stay text, favorites survive recent updates and the list stays bounded', () => {
  const list = normalize([
    { id: '123456789', name: 'Enes\u202e', alias: 'Arkadaşım', favorite: true },
    { id: '123456789', name: 'duplicate' },
    { id: 'invalid', name: 'bad' },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Enes');
  const updated = remember(list, '123456789', 'ENES-PC', 100);
  assert.equal(updated[0].favorite, true);
  assert.equal(updated[0].alias, 'Arkadaşım');
  const full = Array.from({ length: 20 }, (_, i) => ({
    id: String(100000000 + i),
    name: 'PC',
    favorite: i === 19,
    time: i,
  }));
  assert.equal(remember(full, '999999999', 'New').length, 20);
  assert.ok(remember(full, '999999999', 'New').some((v) => v.id === '100000019'));
});

test('Multi-file selection is bounded, hides paths, streams in order and cancels selected tickets', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'rk-queue-'));
  const sender = new FileSender();
  try {
    const first = path.join(folder, 'one.txt'),
      empty = path.join(folder, 'empty.txt');
    await fs.writeFile(first, 'Türkçe dosya');
    await fs.writeFile(empty, '');
    const files = await sender.enqueue([first, empty]);
    assert.equal('path' in files[0], false);
    await assert.rejects(sender.enqueue(Array(20).fill(first)), /20/);
    await assert.rejects(sender.enqueue([first, folder]));
    assert.equal(sender.pending.size, 2, 'bad selections must not partially enter the queue');
    await sender.open(files[0].id);
    await assert.rejects(sender.open(files[1].id), /sürüyor/);
    const chunk = await sender.read(files[0].id);
    assert.equal(Buffer.from(chunk.data, 'base64').toString(), 'Türkçe dosya');
    const end = await sender.read(files[0].id);
    assert.equal(end.hash, crypto.createHash('sha256').update('Türkçe dosya').digest('hex'));
    await sender.open(files[1].id);
    assert.equal((await sender.read(files[1].id)).done, true);
    const [changed] = await sender.enqueue([first]);
    await fs.writeFile(first, 'changed size');
    await assert.rejects(sender.open(changed.id), /değişti/);
    await sender.cancel();
    assert.equal(sender.pending.size, 0);
    await assert.rejects(sender.open(changed.id));
  } finally {
    await sender.cancel();
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test('Traffic limits bound floods without preventing release or unrelated chat', () => {
  const guard = new SessionTraffic();
  for (let i = 0; i < 240; i++) assert.equal(guard.allow('mouse-move', 0), true);
  assert.equal(guard.allow('mouse-move', 0), false);
  assert.equal(guard.allow('text', 0), true);
  assert.equal(guard.allow('release-input', 0), true);
  assert.equal(guard.allow('chat', 0), true);
  assert.equal(guard.allow('mouse-move', 1000), true);
  assert.equal(validMessage({ type: 'file-reply', id: 'x', status: 'chunk', index: -1 }), false);
});

test('Continuous motion cannot starve keyboard releases or discard fractional rate credits', () => {
  const guard = new SessionTraffic();
  for (let i = 0; i < 1000 && guard.allow('mouse-move', 0); i++) {}
  assert.equal(guard.allow('key', 0), true, 'keyboard must have a separate budget');
  for (let i = 0; i < 1000 && guard.allow('key', 0); i++) {}
  assert.equal(guard.allow({ type: 'key', pressed: false }, 0), true);
  assert.equal(guard.allow({ type: 'mouse-button', pressed: false }, 0), true);
  let admitted = 0;
  for (let time = 1; time <= 1000; time++) if (guard.allow('mouse-move', time)) admitted++;
  assert.ok(admitted >= 170 && admitted <= 181, `continuous motion admitted ${admitted}`);
});

test('Legitimate fast file bursts preserve every chunk and receipt without starving control', () => {
  const guard = new SessionTraffic();
  for (let i = 0; i < 100; i++) {
    assert.equal(guard.allow({ type: 'file-chunk' }, 0), true);
    assert.equal(guard.allow({ type: 'file-reply', status: 'chunk' }, 0), true);
  }
  assert.equal(guard.allow('key', 0), true);
  assert.equal(guard.allow('chat', 0), true);
  for (let i = 100; i < 128; i++) assert.equal(guard.allow({ type: 'file-chunk' }, 0), true);
  assert.equal(guard.allow({ type: 'file-chunk' }, 0), false);
});

test('Loss with delay lowers the frame budget without ratcheting bitrate; freeze telemetry handles reset', () => {
  const profile = { bitrate: 16000000, fps: 60 };
  const a = new AdaptiveQuality();
  for (let i = 0; i < 5; i++) a.update(profile, { limitation: 'none', loss: 5, rtt: 300 });
  assert.equal(a.limits(profile).fps, 30);
  assert.equal(a.limits(profile).bitrate, 16000000);
  assert.equal(remoteLoss({ fractionLost: 0.05 }), 5);
  assert.equal(remoteLoss({ fractionLost: 4 }), null);
  a.reset();
  for (let i = 0; i < 10; i++) a.update(profile, { limitation: 'none', loss: 0, rtt: 800 });
  assert.equal(a.limits(profile).fps, 60, 'delay alone does not prove congestion');
  const before = { id: 'video', timestamp: 1, freezeCount: 1, totalFreezesDuration: 0.5 };
  const after = receiveSample(
    { ...before, timestamp: 1001, freezeCount: 2, totalFreezesDuration: 0.8 },
    before,
  );
  assert.equal(after.freezes, 1);
  assert.ok(Math.abs(after.freezeMs - 300) < 0.0001);
  assert.equal(
    receiveSample({ ...before, timestamp: 1001, freezeCount: 0, totalFreezesDuration: 0 }, before)
      .freezeMs,
    null,
  );
});

test('File pacing can be interrupted immediately and connection errors suggest a concrete action', async () => {
  const abort = new AbortController();
  const pending = paceChunk(32768, 64000, abort.signal);
  abort.abort();
  await assert.rejects(pending, /iptal/);
  await assert.rejects(paceChunk(32768, 64000, abort.signal), /iptal/);
  assert.match(explain('timeout'), /aktarma/);
  assert.match(explain({ type: 'peer-unavailable' }), /yapı/);
  assert.match(explain('unknown', false), /İnternet/);
});
