(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenVerification = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function fingerprint(sdp) {
    if (typeof sdp !== 'string' || sdp.length > 100000) return null;
    const values = [...sdp.matchAll(/^a=fingerprint:sha-256 ([a-f0-9:]+)\r?$/gim)].map((m) =>
      m[1].replaceAll(':', '').toUpperCase(),
    );
    if (
      !values.length ||
      values.some((v) => !/^[A-F0-9]{64}$/.test(v)) ||
      new Set(values).size !== 1
    )
      return null;
    return values[0];
  }
  async function verificationCode(pc) {
    const local = fingerprint(pc?.localDescription?.sdp),
      remote = fingerprint(pc?.remoteDescription?.sdp);
    if (!local || !remote) return null;
    const value = 'RK Screen session v1\n' + [local, remote].sort().join('\n');
    const hash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    );
    return [...hash.slice(0, 8)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .match(/.{4}/g)
      .join('-');
  }
  return { fingerprint, verificationCode };
});
