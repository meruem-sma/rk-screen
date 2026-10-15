(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenNetworkCheck = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  async function checkNetwork(
    config,
    { createPeerConnection = (value) => new RTCPeerConnection(value), timeoutMs = 10000 } = {},
  ) {
    const pc = createPeerConnection({
      ...config,
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 0,
    });
    const result = { local: 0, public: 0, relay: 0, errors: [], completed: false };
    const errors = new Set();
    let timer, done;
    const finished = new Promise((resolve) => {
      done = resolve;
      timer = setTimeout(resolve, timeoutMs);
    });
    pc.onicecandidate = (event) => {
      const type = event.candidate?.type;
      if (type === 'host') result.local++;
      if (type === 'srflx') result.public++;
      if (type === 'relay') result.relay++;
      if (!event.candidate) {
        result.completed = true;
        done();
      }
    };
    pc.onicecandidateerror = (event) => {
      if (Number.isSafeInteger(event.errorCode)) errors.add(event.errorCode);
    };
    try {
      pc.createDataChannel('rk-network-check');
      await pc.setLocalDescription(await pc.createOffer());
      await finished;
      result.errors = [...errors].slice(0, 8);
      return result;
    } finally {
      clearTimeout(timer);
      pc.onicecandidate = pc.onicecandidateerror = null;
      pc.close();
    }
  }
  return { checkNetwork };
});
