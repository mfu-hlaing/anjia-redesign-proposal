/* Residence detail — gallery strip, and the lightbox the live site has. */
(() => {
  'use strict';
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const gal = $('.gallery'); if (!gal) return;

  let shots = [];
  try { shots = JSON.parse(gal.dataset.gallery || '[]'); } catch {}
  const main = $('#galMain');
  let i = 0;

  const select = k => {
    i = k;
    $$('.gallery__strip button').forEach((b, n) => b.setAttribute('aria-current', String(n === k)));
    const b = $$('.gallery__strip button')[k];
    if (!b || !main) return;
    main.removeAttribute('srcset');
    main.src = shots[k] || main.src;
  };
  $$('.gallery__strip button').forEach((b, k) => b.addEventListener('click', () => select(k)));
  $('#galZoom')?.addEventListener('click', () => window.Anjia?.lightbox(shots, i));
  main?.addEventListener('click', () => window.Anjia?.lightbox(shots, i));
  if (main) { main.style.cursor = 'zoom-in'; }
})();
