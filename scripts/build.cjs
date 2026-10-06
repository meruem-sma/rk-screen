const path = require('node:path');
const { signingConfig } = require('./signing-config.cjs');
// Fail before loading the builder or replacing an existing release.
const signing = signingConfig(process.env);
require('./signing-preflight.cjs').signingPreflight();
const { build, Platform, Arch } = require('electron-builder');
const { WineVmManager } = require('app-builder-lib/out/vm/WineVm');
const { UninstallerReader } = require('app-builder-lib/out/targets/nsis/nsisUtil');
const { productName } = require('../package.json').build;
const originalExec = WineVmManager.prototype.execWine;
// Read the generated NSIS uninstaller with electron-builder's own parser.
// This avoids executing its intermediate installer stub during the build.
// Scoped to this product's NSIS stub; other builder commands are unchanged.
WineVmManager.prototype.execWine = function (request) {
  const { file, options } = request;
  if (
    process.platform === 'win32' &&
    options?.env?.__COMPAT_LAYER === 'RunAsInvoker' &&
    path.basename(file).startsWith(productName.replaceAll(' ', '-') + '-Setup-')
  ) {
    return UninstallerReader.exec(
      file,
      path.join(path.dirname(file), path.basename(file, 'exe') + '__uninstaller.exe'),
    );
  }
  return originalExec.call(this, request);
};
const target = process.argv[2];
if (target && !['nsis', 'portable'].includes(target)) throw new Error('Unknown build target');
build({
  config: signing,
  targets: Platform.WINDOWS.createTarget(target ? [target] : ['nsis', 'portable'], Arch.x64),
  publish: 'never',
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
