const { snapshot } = require('../core/control');

// Call only after checking the local session token, packet shape and video key.
// Never queue rejected input: it must not execute later at a different target.
function applyInput(session, data, injector, screen, now = Date.now()) {
  const result = (accepted, reason) => ({ accepted, reason, ...snapshot(session, now) });
  if (data.type === 'release-input') {
    injector?.releaseAll();
    return result(true, 'released');
  }
  const state = snapshot(session, now).state;
  if (['permission', 'video', 'manual'].includes(state)) return result(false, state);
  session.cursor.observe(injector.position(), now);
  if (now < session.cursor.localUntil) {
    injector.releaseAll();
    return result(false, 'local');
  }
  const bounds = session.display.bounds;
  const physical = screen.dipToScreenPoint({
    x: bounds.x + Math.round((bounds.width - 1) * (data.x || 0)),
    y: bounds.y + Math.round((bounds.height - 1) * (data.y || 0)),
  });
  if (data.type === 'mouse-move') {
    if (!session.cursor.acceptMove(data.sequence)) return result(false, 'stale');
    injector.moveMouse(physical.x, physical.y);
    session.cursor.recordInjected(injector.position() || physical);
  } else if (data.type === 'mouse-button') {
    session.cursor.recordButton(data.sequence);
    injector.mouseButton(data.button, data.pressed, physical.x, physical.y);
    session.cursor.recordInjected(injector.position() || physical);
  } else if (data.type === 'mouse-wheel') injector.mouseWheel(data.dx, data.dy);
  else if (data.type === 'key') injector.keyEvent(data.code, data.pressed);
  else if (data.type === 'text') injector.text(data.text);
  injector.keepAlive();
  session.inputError = null;
  return result(true, 'applied');
}
module.exports = { applyInput };
