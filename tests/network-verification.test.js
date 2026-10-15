const test = require('node:test'),
  assert = require('node:assert/strict');
const { fingerprint, verificationCode } = require('../src/core/verification');
const { checkNetwork } = require('../src/core/network-check');
const sdp = (byte) => 'v=0\r\na=fingerprint:sha-256 ' + Array(32).fill(byte).join(':') + '\r\n';
test('Session code matches at both ends and changes when a connection certificate changes', async () => {
  const a = { localDescription: { sdp: sdp('AB') }, remoteDescription: { sdp: sdp('CD') } };
  const code = await verificationCode(a);
  assert.match(code, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
  assert.equal(
    await verificationCode({
      localDescription: a.remoteDescription,
      remoteDescription: a.localDescription,
    }),
    code,
  );
  assert.notEqual(await verificationCode({ ...a, remoteDescription: { sdp: sdp('EF') } }), code);
  assert.equal(fingerprint(sdp('GG')), null);
  assert.equal(fingerprint(sdp('AB') + sdp('CD')), null);
  assert.equal(await verificationCode({}), null);
});
test('Network check reports candidate counts without IPs, SDP or credentials and always closes', async () => {
  let closed = false;
  const pc = {
    createDataChannel() {},
    async createOffer() {
      return { type: 'offer' };
    },
    async setLocalDescription() {
      for (const type of ['host', 'srflx', 'relay'])
        this.onicecandidate({ candidate: { type, address: 'private-ip' } });
      this.onicecandidateerror({ errorCode: 701, url: 'private-server' });
      this.onicecandidate({ candidate: null });
    },
    close() {
      closed = true;
    },
  };
  assert.deepEqual(
    await checkNetwork({ iceServers: [] }, { createPeerConnection: () => pc, timeoutMs: 20 }),
    { local: 1, public: 1, relay: 1, errors: [701], completed: true },
  );
  assert.equal(closed, true);
  assert.equal(pc.onicecandidate, null);
});
test('Network check times out and cleans up rejected offers without a hanging peer', async () => {
  let closed = 0;
  const pc = {
    createDataChannel() {},
    async createOffer() {
      return {};
    },
    async setLocalDescription() {},
    close() {
      closed++;
    },
  };
  const result = await checkNetwork({}, { createPeerConnection: () => pc, timeoutMs: 5 });
  assert.equal(result.completed, false);
  assert.equal(closed, 1);
  pc.createOffer = async () => {
    throw Error('offer failed');
  };
  await assert.rejects(
    checkNetwork({}, { createPeerConnection: () => pc, timeoutMs: 5 }),
    /offer failed/,
  );
  assert.equal(closed, 2);
});
