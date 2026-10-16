(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenControl = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const states = ['ready', 'local', 'manual', 'permission', 'video', 'windows', 'busy'];
  function snapshot(session, now = Date.now()) {
    const state = !session.input
      ? 'permission'
      : session.inputPaused
        ? 'video'
        : session.controlPaused
          ? 'manual'
          : now < session.cursor.localUntil
            ? 'local'
            : session.inputError || 'ready';
    const pointerEnabled = session.pointerEnabled === true;
    const signature = state + ':' + pointerEnabled;
    if (session.controlSignature !== signature) {
      session.controlSignature = signature;
      session.controlRevision = (session.controlRevision || 0) + 1;
    }
    return { state, pointerEnabled, revision: session.controlRevision };
  }
  function validStatus(message) {
    return (
      !!message &&
      states.includes(message.state) &&
      typeof message.pointerEnabled === 'boolean' &&
      Number.isSafeInteger(message.revision) &&
      message.revision > 0
    );
  }
  return { states, snapshot, validStatus };
});
