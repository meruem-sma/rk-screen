const test = require('node:test'),
  assert = require('node:assert/strict');
const { directServers, validateRelay } = require('../src/core/ice');
test('default connection servers exclude retired relay credentials; custom relay must be explicit and bounded', () => {
  assert.equal(JSON.stringify(directServers).includes('openrelay'), false);
  assert.equal(validateRelay({ url: '', username: '', password: '' }), null);
  assert.deepEqual(
    validateRelay({
      url: 'turns:relay.example.com:443?transport=tcp',
      username: 'user',
      password: 'secret',
    }),
    { urls: ['turns:relay.example.com:443?transport=tcp'], username: 'user', credential: 'secret' },
  );
  for (const url of [
    'https://example.com',
    'file:///etc/passwd',
    'turn:host:0',
    'turn:host:99999',
    'turn:user:secret@host:443',
  ])
    assert.throws(() => validateRelay({ url, username: 'u', password: 'p' }));
  assert.throws(() => validateRelay({ url: 'turn:host:443', username: 'u', password: '' }));
  assert.deepEqual(
    validateRelay({
      url: 'turn:relay.example.com:3478, turns:relay.example.com:443?transport=tcp',
      username: 'u',
      password: 'p',
    }).urls,
    ['turn:relay.example.com:3478', 'turns:relay.example.com:443?transport=tcp'],
  );
  assert.throws(() =>
    validateRelay({ url: Array(5).fill('turn:host:443').join(','), username: 'u', password: 'p' }),
  );
});
