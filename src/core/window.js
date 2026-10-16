// Electron work areas use DIP already; multiplying by scaleFactor clips high-DPI desktops.
function fitWindow(area, desired = {}) {
  const width = Math.max(1, Math.floor(area.width));
  const height = Math.max(1, Math.floor(area.height));
  const minWidth = Math.min(860, width);
  const minHeight = Math.min(640, height);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const nextWidth = clamp(desired.width ?? 1160, minWidth, width);
  const nextHeight = clamp(desired.height ?? 790, minHeight, height);
  return {
    width: nextWidth,
    height: nextHeight,
    minWidth,
    minHeight,
    x: Math.round(
      clamp(desired.x ?? area.x + (width - nextWidth) / 2, area.x, area.x + width - nextWidth),
    ),
    y: Math.round(
      clamp(desired.y ?? area.y + (height - nextHeight) / 2, area.y, area.y + height - nextHeight),
    ),
  };
}
module.exports = { fitWindow };
