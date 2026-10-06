const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const names = ['koffi', 'peerjs', '@msgpack/msgpack', 'eventemitter3', 'peerjs-js-binarypack', 'webrtc-adapter', 'sdp', 'electron'];
const sections = ['Third-party notices for RK Screen\nGenerated from installed, locked dependency license files.\nElectron also distributes LICENSES.chromium.html with its runtime.\n'];
for (const name of names) {
  const dir = path.join(root, 'node_modules', name);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const license = ['LICENSE', 'LICENSE.txt', 'LICENSE.md'].find(n => fs.existsSync(path.join(dir, n)));
  if (!license) throw Error('Missing license text: ' + name);
  sections.push(`${name} ${pkg.version} (${pkg.license})\n${'-'.repeat(72)}\n${fs.readFileSync(path.join(dir, license), 'utf8')}`);
}
fs.writeFileSync(path.join(root, 'THIRD-PARTY-NOTICES.txt'), sections.join('\n\n') + '\n');
console.log('Third-party notices refreshed: ' + names.length + ' components');
