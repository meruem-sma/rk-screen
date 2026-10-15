window.cursorView.subscribe((p) => {
  const arrow = document.getElementById('arrow'),
    label = document.getElementById('label');
  arrow.style.left = p.tipX - 3 + 'px';
  arrow.style.top = p.tipY - 3 + 'px';
  label.textContent = p.name;
  document.body.classList.toggle('local', p.owner === 'local');
  if (p.pulse) {
    arrow.classList.add('pulse');
    clearTimeout(window.pulseTimer);
    window.pulseTimer = setTimeout(() => arrow.classList.remove('pulse'), 900);
  }
  label.style.left = Math.max(0, Math.min(p.width - label.offsetWidth, p.tipX + 16)) + 'px';
  label.style.top = (p.tipY + 26 < p.height ? p.tipY + 24 : Math.max(0, p.tipY - 28)) + 'px';
});
