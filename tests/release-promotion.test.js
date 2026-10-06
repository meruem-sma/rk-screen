const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isOlderDownloadRelease: obsolete } = require('../scripts/release-policy.cjs');
test('cleanup retains current, newer, draft and unrelated releases', () => {
  const release = (version, extra = {}) => ({ tag_name: 'v' + version, draft: false, assets: [{name: `RK-Screen-Portable-${version}.exe`}], ...extra });
  assert.equal(obsolete(release('1.0.0-beta.1'), '1.0.0-beta.2'), true);
  assert.equal(obsolete(release('1.0.0-beta.2'), '1.0.0-beta.2'), false);
  assert.equal(obsolete(release('1.0.0'), '1.0.0-beta.2'), false);
  assert.equal(obsolete(release('1.0.0-beta.1', {draft:true}), '1.0.0-beta.2'), false);
  assert.equal(obsolete(release('1.0.0-beta.1', {assets:[]}), '1.0.0-beta.2'), false);
  assert.equal(obsolete(release('unrelated'), '1.0.0-beta.2'), false);
});
