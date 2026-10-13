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
  constructor(backend = driver(), now = () => performance.now()) {
    this.backend = backend;
    this.now = now;
    this.lastActivity = now();
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
  keepAlive() {
    this.lastActivity = this.now();
  }
  releaseExpired() {
    if ((!this.keys.size && !this.buttons.size) || this.now() - this.lastActivity < 6000)
      return false;
    this.releaseAll();
    return true;
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
    if (pressed) {
      this.buttons.add(button);
      this.keepAlive();
    } else this.buttons.delete(button);
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
    if (pressed) {
      this.keys.add(code);
      this.keepAlive();
    } else this.keys.delete(code);
  }
  text(text) {
    const packets = textPackets(text);
    if (!packets.length) return;
    // Unicode carries the resulting character, not its keyboard-layout modifiers.
    // Touch only modifiers held by this remote session, never unowned local keys.
    const modifiers = [...this.keys].filter((code) =>
      /^(Control|Alt|Shift|Meta)(Left|Right)$/.test(code),
    );
    const released = [];
    let failure;
    try {
      for (const code of modifiers) {
        this.keyEvent(code, false);
        released.push(code);
      }
      this.send(packets);
    } catch (err) {
      failure = err;
    } finally {
      for (const code of released) {
        try {
          this.keyEvent(code, true);
        } catch (err) {
          failure ??= err;
        }
      }
    }
    if (failure) throw failure;
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
