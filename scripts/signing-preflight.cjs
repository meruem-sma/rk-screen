const path = require('node:path');
const { execFileSync } = require('node:child_process');
function signingPreflight(env = process.env) {
  if (!env.RKSCREEN_SIGN_THUMBPRINT) return;
  if (process.platform !== 'win32') throw Error('Windows certificate-store signing requires Windows.');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'check-signing-store.ps1')], { env, stdio: 'inherit' });
}
module.exports = { signingPreflight };
