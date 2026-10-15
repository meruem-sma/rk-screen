const FEED = 'https://raw.githubusercontent.com/meruem-sma/rk-screen-downloads/main/release.json';
function versionParts(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(value || '');
  if (
    !match ||
    value.length > 48 ||
    match.slice(1).some((v) => v && !Number.isSafeInteger(Number(v)))
  )
    throw Error('Geçersiz sürüm kaydı.');
  return [...match.slice(1, 4).map(Number), match[4] ? Number(match[4]) : Number.MAX_SAFE_INTEGER];
}
function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
function buildParts(value) {
  if (!/^\d{8}\.\d{1,6}$/.test(value || '')) throw Error('Geçersiz yapı kaydı.');
  return value.split('.').map(Number);
}
function validateRelease(feed, current) {
  if (!feed || typeof feed !== 'object') throw Error('Güncelleme kaydı okunamadı.');
  const version = versionParts(feed.version),
    build = buildParts(feed.build);
  const setup = feed.files?.setup;
  const expected = `https://github.com/meruem-sma/rk-screen-downloads/releases/download/v${feed.version}/RK-Screen-Setup-${feed.version}.exe`;
  if (
    !setup ||
    setup.url !== expected ||
    !/^[a-f0-9]{64}$/.test(setup.sha256 || '') ||
    !Number.isSafeInteger(setup.bytes) ||
    setup.bytes <= 0 ||
    setup.bytes > 1024 ** 3 ||
    typeof feed.signed !== 'boolean'
  )
    throw Error('Güvenilir güncelleme adresi doğrulanamadı.');
  const order = compare(version, versionParts(current.version));
  return {
    version: feed.version,
    build: feed.build,
    signed: feed.signed,
    available: order > 0 || (order === 0 && compare(build, buildParts(current.build)) > 0),
    url: expected + '?rk=' + setup.sha256.slice(0, 16),
  };
}
async function checkUpdate(current, fetcher = fetch) {
  const response = await fetcher(FEED + '?t=' + Date.now(), {
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });
  if (!response.ok || !response.body)
    throw Error('Güncelleme hizmetine ulaşılamadı. Daha sonra yeniden deneyin.');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 16384) throw Error('Güncelleme kaydı beklenenden büyük.');
    chunks.push(Buffer.from(chunk));
  }
  return validateRelease(JSON.parse(Buffer.concat(chunks).toString('utf8')), current);
}
module.exports = { validateRelease, checkUpdate };
