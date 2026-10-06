const cleanName = (value) =>
  String(value || 'Uzak bilgisayar')
    .replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '')
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
module.exports = { cleanName, overlayGeometry };
