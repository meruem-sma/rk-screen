(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenPointer = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const cleanName = (value) =>
    String(value || 'Uzak bilgisayar')
      .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '')
      .slice(0, 48);
  function overlayGeometry(bounds, point) {
    const width = Math.min(220, bounds.width),
      height = Math.min(62, bounds.height);
    const px = bounds.x + Math.round(point.x * (bounds.width - 1));
    const py = bounds.y + Math.round(point.y * (bounds.height - 1));
    const x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, px - 4));
    const y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - height, py - 4));
    return { x, y, width, height, tipX: px - x, tipY: py - y };
  }
  class CursorOwnership {
    constructor() {
      this.physical = null;
      this.injected = null;
      this.local = null;
      this.localUntil = 0;
      this.sequence = 0;
    }
    observe(point, now) {
      if (!point) return;
      const moved = !this.physical || point.x !== this.physical.x || point.y !== this.physical.y;
      const injected =
        this.injected &&
        Math.abs(point.x - this.injected.x) <= 1 &&
        Math.abs(point.y - this.injected.y) <= 1;
      if (moved && !injected) {
        this.local = { ...point };
        if (this.physical) this.localUntil = now + 350;
      }
      this.physical = { ...point };
    }
    recordInjected(point) {
      this.physical = this.injected = { ...point };
    }
    acceptMove(sequence) {
      if (!Number.isSafeInteger(sequence) || sequence <= this.sequence) return false;
      this.sequence = sequence;
      return true;
    }
    recordButton(sequence) {
      if (Number.isSafeInteger(sequence)) this.sequence = Math.max(this.sequence, sequence);
    }
  }
  return { cleanName, overlayGeometry, CursorOwnership };
});
