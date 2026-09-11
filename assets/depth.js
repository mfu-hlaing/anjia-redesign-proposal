/* ===========================================================================
   ANJIA — depth, on every page.
   Cards lean toward the pointer with a warm sheen and show their second
   photograph; page heads carry ambient light and sun dust; the home
   photograph answers the pointer; dark ground lights up under the pointer;
   the enquiry photograph moves with the scroll; saving a residence
   celebrates. Fine pointers only for the pointer effects; nothing under
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
  const dark = () => document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);

  /* ---- tilt --------------------------------------------------------- */
  if (fine && !reduced) {
    const SEL = '.res, .homeProperty, .advisor, .entry, .voice, .contactCard, .gallery__view';
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
      const big = r.width > 700;                       // wide blocks lean less
      const rx = (0.5 - y) * (big ? 2.2 : 6.5), ry = (x - 0.5) * (big ? 3 : 8.5);
      cur.style.transform = `perspective(1100px) translateY(${big ? -2 : -6}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${big ? 1.004 : 1.012})`;
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

  /* ---- the second photograph, on hover ------------------------------ */
  if (fine && !reduced) {
    const idOf = card => card.querySelector('.fav[data-id]')?.dataset.id
      || (card.querySelector('a[href*="residence/"]')?.getAttribute('href') || '').match(/residence\/([^./]+)\.html/)?.[1];
    document.addEventListener('pointerover', e => {
      const card = e.target.closest ? e.target.closest('.res, .homeProperty') : null;
      if (!card || card.dataset.peeked) return;
      card.dataset.peeked = '1';
      const media = card.querySelector('.res__media, .homeProperty__media'); if (!media) return;
      const r = (window.LISTINGS || []).find(x => x.id === idOf(card));
      const second = r && (r.gallery || [])[0]; if (!second) return;
      const img = document.createElement('img');
      img.className = 'peek'; img.alt = ''; img.decoding = 'async';
      img.src = `${BASE}assets/img/${second}-600.jpg`;
      img.addEventListener('load', () => { if (card.matches(':hover')) media.setAttribute('data-peek', ''); });
      media.appendChild(img);
      card.addEventListener('pointerenter', () => { if (img.complete && img.naturalWidth) media.setAttribute('data-peek', ''); });
      card.addEventListener('pointerleave', () => media.removeAttribute('data-peek'));
    }, { passive: true });
  }

  /* ---- ambient light: page heads, the home photograph -------------- */
  const motesOn = (host, opts) => {
    if (reduced) return;
    const c = document.createElement('canvas'); c.className = opts.cls; c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    const g = c.getContext('2d'); if (!g) return;
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
    const motes = Array.from({ length: opts.motes }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.2,
      v: 0.02 + Math.random() * 0.05, w: Math.random() * Math.PI * 2, a: 0.16 + Math.random() * 0.36 }));
    const glows = opts.glows ? [
      { x: 0.18, y: 0.35, r: 0.55, s: 0.07, p: 0 }, { x: 0.78, y: 0.7, r: 0.5, s: 0.05, p: 2.1 }, { x: 0.55, y: -0.1, r: 0.45, s: 0.06, p: 4 },
    ] : [];
    let W = 0, H = 0, last = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const size = () => { const r = host.getBoundingClientRect(); W = c.width = Math.max(1, Math.round(r.width)); H = c.height = Math.max(1, Math.round(r.height)); };
    size(); addEventListener('resize', size);
    if (fine) {
      host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - .5); ty = ((e.clientY - r.top) / r.height - .5); }, { passive: true });
      host.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
    }
    const tick = now => {
      requestAnimationFrame(tick);
      if (!visible || document.hidden || now - last < 33) return;
      const dt = Math.min((now - last) / 1000, 0.06); last = now;
      cx += (tx - cx) * 0.05; cy += (ty - cy) * 0.05;
      if (opts.onFrame) opts.onFrame(cx, cy);
      g.clearRect(0, 0, W, H);
      const T = now / 1000;
      const isDark = dark();
      for (const gl of glows) {
        const x = (gl.x + Math.sin(T * gl.s + gl.p) * 0.06 + cx * 0.06) * W, y = (gl.y + Math.cos(T * gl.s * 1.3 + gl.p) * 0.08 + cy * 0.08) * H;
        const rad = gl.r * Math.max(W, H);
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, isDark ? 'rgba(254,125,5,.20)' : 'rgba(254,165,82,.22)');
        grd.addColorStop(0.5, isDark ? 'rgba(254,125,5,.06)' : 'rgba(254,165,82,.07)');
        grd.addColorStop(1, 'rgba(254,125,5,0)');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
      }
      for (const m of motes) {
        m.y -= m.v * dt * 0.35; m.w += dt * 0.9; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        const x = (m.x + Math.sin(m.w) * 0.012) * W, y = m.y * H;
        const a = m.a * (0.6 + 0.4 * Math.sin(m.w * 1.3)) * (opts.moteAlpha || 1);
        g.beginPath(); g.fillStyle = isDark ? `rgba(255,178,87,${a.toFixed(3)})` : `rgba(254,125,5,${(a * 0.6).toFixed(3)})`; g.arc(x, y, m.r, 0, Math.PI * 2); g.fill();
      }
    };
    requestAnimationFrame(tick);
  };

  const hero = $('.originHero');
  if (hero) {
    const media = $('.originHero__media', hero);
    motesOn(hero, { cls: 'heroDust', motes: 46, glows: false, onFrame: (cx, cy) => {
      if (fine && media) media.style.transform = `translate3d(${(cx * -16).toFixed(2)}px, ${(cy * -10).toFixed(2)}px, 0) scale(1.05)`;
    } });
    // the hero's own motes are warm white on a photograph
    const c = $('.heroDust', hero); if (c) c.style.mixBlendMode = 'screen';
  }
  $$('.pageHead, .quickContactHead').forEach(head => motesOn(head, { cls: 'ambient', motes: 22, glows: true, moteAlpha: 0.9 }));

  /* ---- a warm spotlight on dark ground ------------------------------ */
  if (fine && !reduced) {
    $$('.enquiry, .ftr').forEach(sec => {
      const spot = document.createElement('i'); spot.className = 'spot'; spot.setAttribute('aria-hidden', 'true');
      sec.prepend(spot);
      sec.addEventListener('pointermove', e => { const r = sec.getBoundingClientRect();
        sec.style.setProperty('--px', `${(e.clientX - r.left).toFixed(0)}px`); sec.style.setProperty('--py', `${(e.clientY - r.top).toFixed(0)}px`); }, { passive: true });
      sec.addEventListener('pointerenter', () => sec.setAttribute('data-lit', ''));
      sec.addEventListener('pointerleave', () => sec.removeAttribute('data-lit'));
    });
  }

  /* ---- the enquiry photograph moves with the scroll ------------------ */
  if (!reduced) {
    const plx = $$('.enquiry__media img');
    if (plx.length) {
      let raf = 0;
      const paint = () => { raf = 0; const vh = innerHeight;
        for (const img of plx) { const r = img.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) continue;
          const p = (r.top + r.height / 2 - vh / 2) / vh; img.style.transform = `translate3d(0, ${(p * -34).toFixed(1)}px, 0) scale(1.12)`; } };
      addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
      paint();
    }
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
