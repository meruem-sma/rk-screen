// Only release formats produced by this project are eligible for deletion.
function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1, 4).map(Number);
  const beta = match[4] === undefined ? Infinity : Number(match[4]);
  return parts.every(Number.isSafeInteger) && (beta === Infinity || Number.isSafeInteger(beta))
    ? [...parts, beta]
    : null;
}
function isOlderProductRelease(directory, info, currentVersion) {
  const oldParts = parseVersion(directory),
    currentParts = parseVersion(currentVersion);
  if (
    !oldParts ||
    !currentParts ||
    !['menzil', 'rk-screen'].includes(info?.name) ||
    info.version !== directory
  )
    return false;
  for (let i = 0; i < 4; i++) {
    if (oldParts[i] !== currentParts[i]) return oldParts[i] < currentParts[i];
  }
  return false;
}
function isOlderDownloadRelease(release, current) {
  const version = release.tag_name?.replace(/^v/, '');
  return !release.draft && release.tag_name === 'v' + version &&
    isOlderProductRelease(version, { name: 'rk-screen', version }, current) &&
    release.assets?.some(a => ['Portable', 'Setup'].some(kind => a.name === `RK-Screen-${kind}-${version}.exe`));
}
module.exports = { isOlderProductRelease, parseVersion, isOlderDownloadRelease };
