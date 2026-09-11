/* ===========================================================================
   ANJIA — depth, on every page.
   Cards lean toward the pointer with a warm sheen; the home photograph answers
   the pointer and carries a little sun dust; saving a residence celebrates.
   Fine pointers only for the tilt and the parallax; nothing under
   prefers-reduced-motion. No dependencies.
   ======================================================================== */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const BASE = document.body.dataset.base || '';
  const A = () => window.Anjia || {};

  /* ---- tilt --------------------------------------------------------- */
  if (fine && !reduced) {
    const SEL = '.res, .homeProperty';
    const arm = el => {
      if (el.dataset.tilt) return;
      el.dataset.tilt = '1';
      const sheen = document.createElement('i'); sheen.className = 'sheen'; sheen.setAttribute('aria-hidden', 'true');
      el.appendChild(sheen);
    };
    const armAll = () => $$(SEL).forEach(arm);
    armAll();
    document.addEventListener('anjia:rendered', armAll);
    let cur = null, px = 0, py = 0, raf = 0;
    const leave = el => {
      el.style.transform = ''; el.style.transition = '';
      el.style.removeProperty('--mx'); el.style.removeProperty('--my');
    };
    const paint = () => {
      raf = 0; if (!cur) return;
      const r = cur.getBoundingClientRect(); if (!r.width) return;
      const x = (px - r.left) / r.width, y = (py - r.top) / r.height;
      const rx = (0.5 - y) * 6.5, ry = (x - 0.5) * 8.5;
      cur.style.transform = `perspective(1100px) translateY(-6px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.012)`;
      cur.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`); cur.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };
    document.addEventListener('pointermove', e => {
      const el = e.target.closest ? e.target.closest('[data-tilt]') : null;
      if (el !== cur) {
        if (cur) leave(cur);
        cur = el;
        if (cur) cur.style.transition = 'transform .14s ease-out, box-shadow .35s var(--ease), border-color .35s var(--ease)';
      }
      if (!cur) return;
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (cur) { leave(cur); cur = null; } });
  }

  /* ---- the home photograph ---------------------------------------- */
  const hero = $('.originHero');
  if (hero && !reduced) {
    const media = $('.originHero__media', hero);
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

    // sun dust
    const c = document.createElement('canvas'); c.className = 'heroDust'; c.setAttribute('aria-hidden', 'true');
    hero.appendChild(c);
    const g = c.getContext('2d');
    const motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.4,
      v: 0.02 + Math.random() * 0.05, w: Math.random() * Math.PI * 2, a: 0.18 + Math.random() * 0.4 }));
    let W = 0, H = 0, last = 0;
    const size = () => { const r = hero.getBoundingClientRect(); W = c.width = Math.round(r.width); H = c.height = Math.round(r.height); };
    size(); addEventListener('resize', size);
    // the photograph leans toward the pointer
    let tx = 0, ty = 0, cx = 0, cy = 0;
    if (fine) {
      hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - .5) * -16; ty = ((e.clientY - r.top) / r.height - .5) * -10; });
      hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
    }
    const tick = now => {
      requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (fine && media) { cx += (tx - cx) * 0.05; cy += (ty - cy) * 0.05;
        media.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) scale(1.05)`; }
      g.clearRect(0, 0, W, H);
      for (const m of motes) {
        m.y -= m.v * dt * 0.35; m.w += dt * 0.9; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        const x = (m.x + Math.sin(m.w) * 0.012) * W, y = m.y * H;
        const a = m.a * (0.6 + 0.4 * Math.sin(m.w * 1.3));
        g.beginPath(); g.fillStyle = `rgba(255,214,166,${a.toFixed(3)})`; g.arc(x, y, m.r, 0, Math.PI * 2); g.fill();
      }
    };
    requestAnimationFrame(tick);
  }

  /* ---- a saved residence celebrates ------------------------------- */
  let lastFav = null, toast = null, toastT = 0;
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.fav[data-id]'); if (b) lastFav = b; }, true);
  const burst = b => {
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span'); s.className = 'spark'; s.setAttribute('aria-hidden', 'true');
      s.style.left = `${cx - 3.5}px`; s.style.top = `${cy - 3.5}px`;
      document.body.appendChild(s);
      const a = (i / 14) * Math.PI * 2 + Math.random() * .5, d = 30 + Math.random() * 46;
      const anim = s.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${(Math.cos(a) * d).toFixed(1)}px, ${(Math.sin(a) * d - 12).toFixed(1)}px) scale(.15)`, opacity: 0 },
      ], { duration: 600 + Math.random() * 320, easing: 'cubic-bezier(.2,.8,.3,1)' });
      anim.onfinish = () => s.remove();
    }
  };
  const showToast = () => {
    if (/saved\.html$/.test(location.pathname)) return;
    const n = (A().saved ? A().saved() : []).length;
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast3d'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.innerHTML = `<span>Saved<b> · ${n} in your collection</b></span><a href="${BASE}saved.html">View</a>`;
    toast.setAttribute('data-on', '');
    clearTimeout(toastT); toastT = setTimeout(() => toast.removeAttribute('data-on'), 2800);
  };
  document.addEventListener('anjia:saved', e => {
    if (!e.detail || !e.detail.on) return;
    if (lastFav && !reduced && 'animate' in Element.prototype) burst(lastFav);
    showToast();
  });
})();
