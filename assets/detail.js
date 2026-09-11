/* Residence detail — the gallery: arrows, swipe, keys, counter, strip, the lightbox and the room tour. */
(() => {
  'use strict';
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const gal = $('.gallery'); if (!gal) return;
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

  let shots = [];
  try { shots = JSON.parse(gal.dataset.gallery || '[]'); } catch {}
  const main = $('#galMain'), view = $('.gallery__view') || $('.gallery__main'), count = $('#galCount');
  const thumbs = $$('.gallery__strip button');
  let i = 0, swapping = 0;

  const preload = k => { const s = shots[(k + shots.length) % shots.length]; if (s) { const im = new Image(); im.src = s; } };
  const paint = () => {
    thumbs.forEach((b, n) => b.setAttribute('aria-current', String(n === i)));
    thumbs[i]?.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    if (count) count.textContent = `${i + 1} / ${shots.length}`;
    view?.setAttribute('aria-label', `Photographs, ${i + 1} of ${shots.length}`);
  };
  const show = k => {
    if (!shots.length || !main) return;
    i = (k + shots.length) % shots.length;
    paint();
    const src = shots[i], token = ++swapping;
    const im = new Image(); im.src = src;
    const swap = () => {
      if (token !== swapping) return;
      main.removeAttribute('srcset'); main.src = src;
      view?.removeAttribute('data-swapping');
    };
    if (reduced) swap();
    else {
      view?.setAttribute('data-swapping', '');
      (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => setTimeout(swap, 120));
    }
    preload(i + 1); preload(i - 1);
  };
  thumbs.forEach((b, k) => b.addEventListener('click', () => show(k)));
  $('#galPrev')?.addEventListener('click', e => { e.stopPropagation(); show(i - 1); });
  $('#galNext')?.addEventListener('click', e => { e.stopPropagation(); show(i + 1); });
  $('#galZoom')?.addEventListener('click', () => window.Anjia?.lightbox(shots, i));
  $('#galTour')?.addEventListener('click', async e => {
    const base = document.body.dataset.base || '';
    const plans = $$('.unitThumb').map(a => ({ src: a.getAttribute('href'),
      name: (a.getAttribute('aria-label') || 'Layout').replace(/^Open /, '').replace(/ layout$/, '') }));
    const title = $('.detail__h')?.textContent.trim() || document.title;
    const subtitle = ($('.detail__loc')?.textContent || '').replace(/\s+/g, ' ').trim();
    try {
      const mod = await import(`${base}assets/tour.js`);
      mod.openTour({ title, subtitle, shots, plans, base, trigger: e.currentTarget });
    } catch (err) { window.Anjia?.lightbox(shots, i); }
  });

  // the photograph itself: swipe to move, tap to enlarge, arrow keys when focused
  if (view && main) {
    let t0 = null;
    view.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; t0 = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    view.addEventListener('pointerup', e => {
      if (!t0 || e.target.closest('button')) { t0 = null; return; }
      const dx = e.clientX - t0.x, dy = e.clientY - t0.y, dt = performance.now() - t0.t; t0 = null;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) { show(i + (dx < 0 ? 1 : -1)); return; }
      if (dt < 450 && Math.abs(dx) < 6 && Math.abs(dy) < 6) window.Anjia?.lightbox(shots, i);
    });
    view.addEventListener('pointercancel', () => { t0 = null; });
    view.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      else if (e.key === 'Enter') window.Anjia?.lightbox(shots, i);
    });
    main.style.cursor = 'zoom-in';
    main.draggable = false;
  }
  paint();
  preload(1);
})();
