const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const unsignedBeta = process.argv[2] === '--unsigned-beta';
if (process.argv.slice(2).some(a => a !== '--unsigned-beta')) throw Error('Unknown package check option');
const output = unsignedBeta ? require('./beta-setup-config.cjs').betaSetupConfig(pkg).directories.output : pkg.build.directories.output;
const archive = path.join(root, output, 'win-unpacked/resources/app.asar');
const files = asar.listPackage(archive).map((file) => file.replaceAll('\\', '/'));
const forbidden = files.filter(
  (file) =>
    /\.(pfx|p12|pem|key|ps1|zip)$/i.test(file) || /^\/(certs|scripts|tests|review)\//.test(file),
);
assert.deepEqual(forbidden, [], 'Sensitive or development files were packaged');
const requiredFiles = ['index.html', 'assets/blank.ico', 'src/cursor-overlay.html', 'LICENSE', 'THIRD-PARTY-NOTICES.txt'];
function collectSource(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = directory + '/' + entry.name;
    if (entry.isDirectory()) collectSource(relative);
    else if (/\.(js|css)$/.test(relative)) requiredFiles.push(relative);
  }
}
collectSource('src');
for (const file of requiredFiles)
  assert.ok(files.includes('/' + file), 'Missing packaged file: ' + file);
let checked = 0;
for (const file of files) {
  if (!/^\/(src|assets)\//.test(file) && !['/index.html', '/LICENSE', '/THIRD-PARTY-NOTICES.txt'].includes(file)) continue;
  const relative = file.slice(1);
  if (!fs.statSync(path.join(root, relative)).isFile()) continue;
  assert.ok(
    fs
      .readFileSync(path.join(root, relative))
      .equals(asar.extractFile(archive, path.normalize(relative))),
    'Stale packaged file: ' + relative,
  );
  checked++;
}
assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, pkg.version);
console.log(
  'Package verified: ' +
    checked +
    ' current application files; no certificates, keys, scripts or test artifacts.',
);
