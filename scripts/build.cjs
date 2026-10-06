const path = require('node:path');
const { signingConfig } = require('./signing-config.cjs');
const pkg = require('../package.json');
const args = process.argv.slice(2);
const unsignedBeta = args.includes('--unsigned-beta');
const target = args.find(a => !a.startsWith('--'));
if (args.some(a => !['nsis', 'portable', '--unsigned-beta'].includes(a)) ||
    args.filter(a => !a.startsWith('--')).length > 1 || args.length > 2)
  throw Error('Usage: build.cjs [nsis|portable] [--unsigned-beta]');
if (unsignedBeta && target !== 'nsis') throw Error('Unsigned beta mode only builds the setup target.');
// Signed releases remain the default. Explicit unsigned beta candidates are
// isolated from the currently published package and never described as signed.
const signing = unsignedBeta ? require('./beta-setup-config.cjs').betaSetupConfig(pkg) : signingConfig(process.env);
if (!unsignedBeta) require('./signing-preflight.cjs').signingPreflight();
else {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  console.warn('UNSIGNED BETA SETUP: Windows may block this package. Current release retained until verification.');
}
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
build({
  config: signing,
  targets: Platform.WINDOWS.createTarget(target ? [target] : ['nsis'], Arch.x64),
  publish: 'never',
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
