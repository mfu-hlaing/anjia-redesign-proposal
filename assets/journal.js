/* Journal — keyword search and the category tabs the live site has. */
(() => {
  'use strict';
  const $$ = s => [...document.querySelectorAll(s)];
  const grid = document.getElementById('journalGrid');
  if (!grid) return;
  const cards = $$('#journalGrid .entry');
  const q = document.getElementById('jq');
  let cat = '';

  function apply() {
    const t = (q?.value || '').trim().toLowerCase();
    let n = 0;
    cards.forEach(c => {
      const okCat = !cat || c.dataset.cat === cat;
      const okQ = !t || c.textContent.toLowerCase().includes(t);
      const on = okCat && okQ;
      c.hidden = !on; if (on) n++;
    });
    document.getElementById('jEmpty').hidden = n > 0;
  }
  q?.addEventListener('input', apply);
  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    cat = b.dataset.cat; apply();
  }));
})();
