const path = require('node:path');
const { parseVersion } = require('./release-policy.cjs');
function betaSetupConfig(pkg) {
  if (!parseVersion(pkg.version) || !/-beta\.\d+$/.test(pkg.version))
    throw Error('Unsigned setup is restricted to explicitly requested beta releases.');
  return {
    forceCodeSigning: false,
    directories: { output: path.join('review', 'setup-candidate', pkg.version) },
    win: { signExecutable: false },
  };
}
module.exports = { betaSetupConfig };
