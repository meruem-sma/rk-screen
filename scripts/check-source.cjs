// Syntax validation only; this is not a functional or hardware acceptance test.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : /\.(c?js)$/.test(entry.name) ? [full] : [];
  });
}
const sources = ['src', 'scripts'].flatMap((dir) => files(path.join(root, dir)));
for (const file of sources) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  `Syntax verified: ${sources.length} JavaScript files. Functional tests are not included.`,
);
