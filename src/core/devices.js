(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenDevices = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const clean = (v) =>
    String(v || '')
      .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '')
      .trim()
      .slice(0, 48);
  function normalize(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .filter((v) => {
        if (!v || !/^\d{9}$/.test(v.id) || seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      })
      .slice(0, 20)
      .map((v) => ({
        id: v.id,
        name: clean(v.name) || 'Uzak bilgisayar',
        alias: clean(v.alias),
        favorite: v.favorite === true,
        time: Number.isFinite(v.time) ? Math.max(0, v.time) : 0,
      }));
  }
  function remember(list, id, name, time = Date.now()) {
    const items = normalize(list),
      old = items.find((v) => v.id === id);
    // Keep favorites even when a new recent device is added to a full list.
    const rest = items
      .filter((v) => v.id !== id)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.time - a.time);
    if (!old && rest.length === 20 && rest.every((v) => v.favorite)) return items;
    return normalize([{ ...old, id, name, time }, ...rest].slice(0, 20));
  }
  return { normalize, remember };
});
