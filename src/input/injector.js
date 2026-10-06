const { keyPacket, textPackets, mousePacket } = require('./packets');
let nativeDriver;
function driver() {
  if (nativeDriver) return nativeDriver;
  if (process.arch !== 'x64') throw new Error('Bu sürüm 64 bit Windows gerektirir.');
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const send = user32.func(
    'uint32 __stdcall SendInput(uint32 count, const void *inputs, int size)',
  );
  const cursor = user32.func('bool __stdcall SetCursorPos(int x, int y)');
  const getCursor = user32.func('bool __stdcall GetCursorPos(_Out_ void *point)');
  nativeDriver = {
    send: (packets) => send(packets.length, Buffer.concat(packets), 40),
    move: (x, y) => cursor(Math.round(x), Math.round(y)),
    position: () => {
      const b = Buffer.alloc(8);
      if (!getCursor(b)) return null;
      return { x: b.readInt32LE(0), y: b.readInt32LE(4) };
    },
  };
  return nativeDriver;
}
class InputInjector {
  constructor(backend = driver()) {
    this.backend = backend;
    this.keys = new Set();
    this.buttons = new Set();
  }
  send(packets) {
    if (packets.length && this.backend.send(packets) !== packets.length)
      throw new Error(
        'Windows girdiyi kabul etmedi. Yönetici uygulamaları ve güvenli masaüstü uzaktan kontrolü sınırlar.',
      );
  }
  position() {
    return this.backend.position();
  }
  moveMouse(x, y) {
    if (Number.isFinite(x) && Number.isFinite(y) && !this.backend.move(x, y))
      throw new Error('Windows imleci hareket ettiremedi.');
  }
  mouseButton(button, pressed, x, y) {
    const flags = { left: [2, 4], right: [8, 16], middle: [32, 64] }[button];
    if (!flags || (!pressed && !this.buttons.has(button))) return;
    if (Number.isFinite(x) && Number.isFinite(y)) this.moveMouse(x, y);
    this.send([mousePacket(flags[pressed ? 0 : 1])]);
    if (pressed) this.buttons.add(button);
    else this.buttons.delete(button);
  }
  mouseWheel(dx, dy) {
    const packets = [];
    if (dy)
      packets.push(
        mousePacket(0x0800, -Math.sign(dy) * Math.min(1200, Math.max(1, Math.round(Math.abs(dy))))),
      );
    if (dx)
      packets.push(
        mousePacket(0x1000, Math.sign(dx) * Math.min(1200, Math.max(1, Math.round(Math.abs(dx))))),
      );
    this.send(packets);
  }
  keyEvent(code, pressed) {
    const packet = keyPacket(code, pressed);
    if (!packet || (!pressed && !this.keys.has(code))) return;
    this.send([packet]);
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
  }
  text(text) {
    this.send(textPackets(text));
  }
  releaseAll() {
    let failure;
    for (const code of [...this.keys]) {
      try {
        this.keyEvent(code, false);
      } catch (e) {
        failure = e;
      }
    }
    for (const button of [...this.buttons]) {
      try {
        this.mouseButton(button, false);
      } catch (e) {
        failure = e;
      }
    }
    if (failure) throw failure;
  }
}
module.exports = { InputInjector };
