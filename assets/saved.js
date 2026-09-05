/* Saved residences — reads what parity.js keeps on the device. */
(() => {
  'use strict';
  const A = window.Anjia || {};
  const grid = document.getElementById('savedGrid');
  if (!grid || !window.LISTINGS) return;

  function render() {
    const ids = A.saved ? A.saved() : [];
    const rows = window.LISTINGS.filter(r => ids.includes(String(r.id)));
    grid.innerHTML = rows.map((r, i) => A.card(r, i)).join('');
    document.getElementById('savedEmpty').hidden = rows.length > 0;
    document.getElementById('savedCount').textContent = rows.length
      ? `${rows.length} saved · ${rows.filter(r => r.tenure === 'Freehold' || r.tenure === 'Foreign quota').length} available to a foreign buyer outright`
      : '';
    document.getElementById('clearSaved').hidden = rows.length === 0;
    document.dispatchEvent(new CustomEvent('anjia:rendered'));
    window.revealAgain?.();
  }
  document.addEventListener('anjia:saved', render);
  document.getElementById('clearSaved')?.addEventListener('click', () => {
    A.store.set('saved', []); A.paintSaved(); render();
  });
  render();
})();
