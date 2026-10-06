const test = require('node:test');
const assert = require('node:assert/strict');
const { signingConfig } = require('../scripts/signing-config.cjs');
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
