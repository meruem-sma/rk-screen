// Windows x64 INPUT ABI: 40 bytes, union at offset 8.
const scanCodes = {
  Escape: 1,
  Digit1: 2,
  Digit2: 3,
  Digit3: 4,
  Digit4: 5,
  Digit5: 6,
  Digit6: 7,
  Digit7: 8,
  Digit8: 9,
  Digit9: 10,
  Digit0: 11,
  Minus: 12,
  Equal: 13,
  Backspace: 14,
  Tab: 15,
  KeyQ: 16,
  KeyW: 17,
  KeyE: 18,
  KeyR: 19,
  KeyT: 20,
  KeyY: 21,
  KeyU: 22,
  KeyI: 23,
  KeyO: 24,
  KeyP: 25,
  BracketLeft: 26,
  BracketRight: 27,
  Enter: 28,
  ControlLeft: 29,
  KeyA: 30,
  KeyS: 31,
  KeyD: 32,
  KeyF: 33,
  KeyG: 34,
  KeyH: 35,
  KeyJ: 36,
  KeyK: 37,
  KeyL: 38,
  Semicolon: 39,
  Quote: 40,
  Backquote: 41,
  ShiftLeft: 42,
  Backslash: 43,
  KeyZ: 44,
  KeyX: 45,
  KeyC: 46,
  KeyV: 47,
  KeyB: 48,
  KeyN: 49,
  KeyM: 50,
  Comma: 51,
  Period: 52,
  Slash: 53,
  ShiftRight: 54,
  NumpadMultiply: 55,
  AltLeft: 56,
  Space: 57,
  CapsLock: 58,
  NumLock: 0x145,
  ScrollLock: 70,
  Numpad7: 71,
  Numpad8: 72,
  Numpad9: 73,
  NumpadSubtract: 74,
  Numpad4: 75,
  Numpad5: 76,
  Numpad6: 77,
  NumpadAdd: 78,
  Numpad1: 79,
  Numpad2: 80,
  Numpad3: 81,
  Numpad0: 82,
  NumpadDecimal: 83,
  IntlBackslash: 86,
  NumpadEnter: 0x11c,
  ControlRight: 0x11d,
  NumpadDivide: 0x135,
  PrintScreen: 0x137,
  AltRight: 0x138,
  Home: 0x147,
  ArrowUp: 0x148,
  PageUp: 0x149,
  ArrowLeft: 0x14b,
  ArrowRight: 0x14d,
  End: 0x14f,
  ArrowDown: 0x150,
  PageDown: 0x151,
  Insert: 0x152,
  Delete: 0x153,
  MetaLeft: 0x15b,
  MetaRight: 0x15c,
  ContextMenu: 0x15d,
};
for (let n = 1; n <= 10; n++) scanCodes['F' + n] = 0x3a + n;
scanCodes.F11 = 0x57;
scanCodes.F12 = 0x58;
function keyboard(scan, flags, vk = 0) {
  const b = Buffer.alloc(40);
  b.writeUInt32LE(1, 0);
  b.writeUInt16LE(vk, 8);
  b.writeUInt16LE(scan, 10);
  b.writeUInt32LE(flags, 12);
  return b;
}
function keyPacket(code, pressed) {
  if (code === 'Pause') return keyboard(0, pressed ? 0 : 2, 0x13);
  const scan = scanCodes[code];
  return scan ? keyboard(scan & 255, 8 | (scan > 255 ? 1 : 0) | (pressed ? 0 : 2)) : null;
}
function textPackets(text) {
  const packets = [];
  for (let i = 0; i < text.length; i++)
    packets.push(keyboard(text.charCodeAt(i), 4), keyboard(text.charCodeAt(i), 6));
  return packets;
}
function mousePacket(flags, data = 0) {
  const b = Buffer.alloc(40);
  b.writeUInt32LE(data >>> 0, 16);
  b.writeUInt32LE(flags, 20);
  return b;
}
module.exports = { keyPacket, textPackets, mousePacket };
