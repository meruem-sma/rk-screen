const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const pkg = require('../package.json');
const { isOlderProductRelease, parseVersion } = require('./release-policy.cjs');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const current = path.resolve(root, pkg.build.directories.output);
if (path.dirname(current) !== dist || path.basename(current) !== pkg.version)
  throw Error('Unexpected release directory');
const executables = fs
  .readdirSync(current)
  .filter((n) =>
    ['Setup', 'Portable'].some((kind) => n === `RK-Screen-${kind}-${pkg.version}.exe`),
  );
if (!executables.length) throw Error('No release executables');
const sums = executables.map(
  (name) =>
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(current, name)))
      .digest('hex') +
    '  ' +
    name,
);
fs.writeFileSync(path.join(current, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
// The package check and signing step run before this script. Only identified
// product build directories are eligible; never remove source or user data.
const removed = [];
for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === pkg.version || !parseVersion(entry.name)) continue;
  const target = path.join(dist, entry.name);
  if (fs.realpathSync(target) !== target || path.dirname(path.resolve(target)) !== dist) continue;
  try {
    const old = JSON.parse(
      asar.extractFile(path.join(target, 'win-unpacked/resources/app.asar'), 'package.json'),
    );
    if (!isOlderProductRelease(entry.name, old, pkg.version)) continue;
  } catch {
    continue;
  }
  fs.rmSync(target, { recursive: true, force: false });
  removed.push(entry.name);
}
fs.writeFileSync(
  path.join(current, 'release.json'),
  JSON.stringify(
    {
      product: 'RK Screen',
      version: pkg.version,
      artifacts: executables,
      removedVersions: removed,
    },
    null,
    2,
  ),
);
console.log(
  'Release ready: ' +
    pkg.version +
    '. Removed older verified builds: ' +
    (removed.join(', ') || 'none'),
);
