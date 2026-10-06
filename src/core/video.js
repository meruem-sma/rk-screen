(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenVideo = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const profiles = {
    balanced: { bitrate: 12000000, fps: 30, hint: 'detail' },
    detail: { bitrate: 20000000, fps: 30, hint: 'text' },
    speed: { bitrate: 2500000, fps: 24, hint: 'motion' },
    fluid: { bitrate: 24000000, fps: 60, hint: 'motion' },
  };
  function qualitySettings(name, width = 1920, height = 1080) {
    const p = profiles[name] || profiles.balanced;
    const factor = Math.max(1, Math.min(2, (width * height) / (1920 * 1080)));
    return {
      ...p,
      bitrate: Math.round(p.bitrate * factor),
      degradation:
        name === 'speed' || name === 'fluid' ? 'maintain-framerate' : 'maintain-resolution',
    };
  }
  function geometry(rect, width, height, mode, pixelRatio = 1) {
    if (!width || !height || !rect.width || !rect.height) return null;
    const factor =
      mode === 'fill'
        ? Math.max(rect.width / width, rect.height / height)
        : mode === 'original'
          ? 1 / Math.max(1, pixelRatio)
          : Math.min(rect.width / width, rect.height / height);
    return {
      left: rect.left + (rect.width - width * factor) / 2,
      top: rect.top + (rect.height - height * factor) / 2,
      width: width * factor,
      height: height * factor,
    };
  }
  function coordinates(rect, width, height, mode, x, y, clamp = false, pixelRatio = 1) {
    const g = geometry(rect, width, height, mode, pixelRatio);
    if (!g) return null;
    const px = (x - g.left) / g.width,
      py = (y - g.top) / g.height;
    if (!clamp && (px < 0 || px > 1 || py < 0 || py > 1)) return null;
    return { x: Math.max(0, Math.min(1, px)), y: Math.max(0, Math.min(1, py)) };
  }
  return { profiles, qualitySettings, geometry, coordinates };
});
