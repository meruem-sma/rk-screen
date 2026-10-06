const test = require('node:test');
const assert = require('node:assert/strict');
const { signingConfig } = require('../scripts/signing-config.cjs');
const { betaSetupConfig } = require('../scripts/beta-setup-config.cjs');

test('unsigned setup requires a beta version and cannot replace the current release output', () => {
  for (const version of ['1.0.0', '../1.0.0-beta.1', 'unknown'])
    assert.throws(() => betaSetupConfig({ version }), /restricted/);
  const config = betaSetupConfig({ version: '1.0.0-beta.1' });
  assert.equal(config.forceCodeSigning, false);
  assert.equal(config.win.signExecutable, false);
  assert.ok(config.directories.output.replaceAll('\\', '/').startsWith('review/setup-candidate/'));
  assert.throws(() => signingConfig({}), /Public release blocked/);
});
test('public build stops without a signing identity', () => {
  assert.throws(() => signingConfig({}), /Public release blocked/);
  assert.throws(() => signingConfig({ RKSCREEN_SIGN_PASSWORD: 'test-only' }), /Public release blocked/);
});
test('ambiguous or malformed signing identities are rejected', () => {
  assert.throws(() => signingConfig({ CSC_LINK: 'a.pfx', RKSCREEN_SIGN_CERT: 'b.pfx' }), /Conflicting/);
  assert.throws(() => signingConfig({ RKSCREEN_SIGN_THUMBPRINT: 'invalid' }), /40-character/);
  assert.throws(() => signingConfig({ CSC_LINK: 'a.pfx', RKSCREEN_SIGN_THUMBPRINT: 'a'.repeat(40) }), /either/);
});
test('certificate config reaches builder before payload signing', () => {
  const env = { RKSCREEN_SIGN_CERT: 'test-only.pfx', RKSCREEN_SIGN_PASSWORD: 'test-only' };
  const config = signingConfig(env);
  assert.equal(env.CSC_LINK, 'test-only.pfx');
  assert.equal(env.CSC_KEY_PASSWORD, 'test-only');
  assert.equal(config.forceCodeSigning, true);
  assert.deepEqual(config.win.signExts, ['.dll', '.node']);
  assert.equal(config.win.signtoolOptions.publisherName, null);
});
test('hardware/store identity does not require exporting private keys', () => {
  const env = { RKSCREEN_SIGN_THUMBPRINT: 'a'.repeat(40) };
  assert.equal(signingConfig(env).win.signtoolOptions.certificateSha1, env.RKSCREEN_SIGN_THUMBPRINT);
  assert.equal(env.CSC_LINK, undefined);
});
