/* ===========================================================================
   ANJIA — behaviour. No framework, no dependencies.
   ======================================================================== */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---- theme -------------------------------------------------------- */
  try { const t = localStorage.getItem('anjia-theme'); if (t) root.dataset.theme = t; } catch {}
  $('#themeBtn')?.addEventListener('click', () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme:dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('anjia-theme', root.dataset.theme); } catch {}
  });

  /* ---- drawer ------------------------------------------------------- */
  const drawer = $('#drawer'), scrim = $('#scrim'), burger = $('#burger');
  let lastFocus = null;
  const setDrawer = open => {
    if (!drawer) return;
    if (open) { lastFocus = document.activeElement; scrim.hidden = false; }
    requestAnimationFrame(() => {
      drawer.toggleAttribute('data-open', open);
      scrim.toggleAttribute('data-open', open);
    });
    drawer.setAttribute('aria-hidden', String(!open));
    burger?.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) drawer.querySelector('a,button')?.focus();
    else { setTimeout(() => { scrim.hidden = true; }, 400); lastFocus?.focus(); }
  };
  burger?.addEventListener('click', () => setDrawer(true));
  $('#drawerClose')?.addEventListener('click', () => setDrawer(false));
  scrim?.addEventListener('click', () => setDrawer(false));
  $$('#drawer a').forEach(a => a.addEventListener('click', () => setDrawer(false)));
  // keep focus inside the open drawer
  drawer?.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !drawer.hasAttribute('data-open')) return;
    const f = $$('a,button', drawer).filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---- language listbox --------------------------------------------- */
  const langBtn = $('#langBtn'), langMenu = $('#langMenu'), langCur = $('#langCur');
  langBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const open = langMenu.hasAttribute('data-open');
    langMenu.toggleAttribute('data-open', !open);
    langBtn.setAttribute('aria-expanded', String(!open));
  });
  $$('#langMenu button').forEach(b => b.addEventListener('click', () => {
    $$('#langMenu button').forEach(x => x.setAttribute('aria-selected', 'false'));
    b.setAttribute('aria-selected', 'true');
    langCur.textContent = b.dataset.code;
    langMenu.removeAttribute('data-open');
    langBtn.setAttribute('aria-expanded', 'false');
  }));

  /* ---- custom pickers (there is no native <select> on this site) ----- */
  const closePicks = except => $$('[data-pick]').forEach(p => {
    if (p === except) return;
    $('.pick__menu', p)?.removeAttribute('data-open');
    $('.pick__btn', p)?.setAttribute('aria-expanded', 'false');
  });
  const initPick = pick => {
    const btn = $('.pick__btn', pick), menu = $('.pick__menu', pick), val = $('.pick__val', pick);
    const opts = $$('.pick__opt', pick);
    if (!btn || !menu || !opts.length) return;
    let active = Math.max(0, opts.findIndex(o => o.getAttribute('aria-selected') === 'true'));
    const mark = i => { opts.forEach((o, k) => o.toggleAttribute('data-active', k === i)); opts[i]?.scrollIntoView({ block: 'nearest' }); };
    const open = () => { closePicks(pick); menu.setAttribute('data-open', ''); btn.setAttribute('aria-expanded', 'true'); mark(active); };
    const close = () => { menu.removeAttribute('data-open'); btn.setAttribute('aria-expanded', 'false'); };
    const choose = i => {
      opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
      val.textContent = opts[i].textContent.trim();
      active = i; close(); btn.focus();
      pick.dispatchEvent(new CustomEvent('pick:change', { bubbles: true, detail: { index: i, value: val.textContent } }));
    };
    btn.addEventListener('click', () => menu.hasAttribute('data-open') ? close() : open());
    opts.forEach((o, i) => o.addEventListener('click', () => choose(i)));
    pick.addEventListener('keydown', e => {
      const isOpen = menu.hasAttribute('data-open');
      switch (e.key) {
        case 'Escape':    if (isOpen) { e.preventDefault(); close(); btn.focus(); } break;
        case 'ArrowDown': e.preventDefault(); if (!isOpen) return open(); active = (active + 1) % opts.length; mark(active); break;
        case 'ArrowUp':   e.preventDefault(); if (!isOpen) return open(); active = (active - 1 + opts.length) % opts.length; mark(active); break;
        case 'Home':      if (isOpen) { e.preventDefault(); active = 0; mark(active); } break;
        case 'End':       if (isOpen) { e.preventDefault(); active = opts.length - 1; mark(active); } break;
        case 'Enter':
        case ' ':         if (isOpen) { e.preventDefault(); choose(active); } break;
      }
    });
  };
  $$('[data-pick]').forEach(initPick);
  window.initPick = initPick;                       // for pickers added later
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-pick]')) closePicks(null);
    if (!e.target.closest('.lang')) { langMenu?.removeAttribute('data-open'); langBtn?.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    langMenu?.removeAttribute('data-open'); langBtn?.setAttribute('aria-expanded', 'false');
    if (drawer?.hasAttribute('data-open')) setDrawer(false);
  });

  /* ---- scroll reveal ------------------------------------------------- */
  let io;
  const reveal = () => {
    const items = $$('.rv:not([data-in])');
    if (!('IntersectionObserver' in window)) return items.forEach(el => el.setAttribute('data-in', ''));
    io ||= new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.setAttribute('data-in', ''); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.03 });
    items.forEach(el => io.observe(el));
  };
  reveal();
  window.revealAgain = reveal;
  // a reveal must never be able to trap content
  setTimeout(() => $$('.rv:not([data-in])').forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight * 1.4) el.setAttribute('data-in', '');
  }), 1500);

  /* ---- header over the hero, and the mobile dock --------------------- */
  const hdr = $('#hdr'), hero = $('.hero'), dock = $('#dock');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      hdr?.toggleAttribute('data-over', e.isIntersecting && e.intersectionRatio > 0.12);
      dock?.toggleAttribute('data-show', !e.isIntersecting);
    }, { threshold: [0, 0.12, 0.5] }).observe(hero);
  } else {
    hdr?.removeAttribute('data-over');
    dock?.setAttribute('data-show', '');
  }

  /* ---- collection rail ----------------------------------------------- */
  const rail = $('#rail');
  if (rail && window.LISTINGS) {
    const M = n => n / 1e6;
    const money = n => { const m = M(n); return m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2); };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // three intentions, derived from the data rather than hand-tagged
    const brief = r => {
      const top = M(r.priceMax || r.priceMin || 0);
      if (top >= 30) return 'signature';
      if (r.type === 'Condominium' && top <= 12) return 'yield';
      return 'live';
    };
    const priceLabel = r => !r.priceMin ? '<span class="res__price num">On application</span>'
      : (!r.priceMax || r.priceMax === r.priceMin)
        ? `<span class="res__price num">${money(r.priceMin)}<i>M THB</i></span>`
        : `<span class="res__price num">${money(r.priceMin)}<span class="dash">–</span>${money(r.priceMax)}<i>M THB</i></span>`;
    const size = r => !r.areaMin ? '' :
      (!r.areaMax || r.areaMax === r.areaMin) ? `${Math.round(r.areaMin)} m²`
      : `${Math.round(r.areaMin)}–${Math.round(r.areaMax)} m²`;

    const card = r => {
      const specs = [];
      if (r.beds) specs.push(`${r.beds} bed`);
      if (size(r)) specs.push(size(r));
      specs.push(r.type);
      const sig = r.tenure === 'Freehold' || r.tenure === 'Foreign quota';
      return `
      <a class="res" href="residence.html?id=${encodeURIComponent(r.id)}">
        <div class="res__media">
          <img src="assets/img/${r.img}-600.jpg"
               srcset="assets/img/${r.img}-400.jpg 400w, assets/img/${r.img}-600.jpg 600w, assets/img/${r.img}-900.jpg 900w"
               sizes="(min-width:1000px) 372px, (min-width:680px) 44vw, 82vw"
               width="900" height="600" loading="lazy" decoding="async"
               alt="${esc(r.name)}, ${esc(r.type.toLowerCase())} in ${esc(r.area)}">
          <span class="res__flag${sig ? ' res__flag--sig' : ''}">${esc(r.tenure)}</span>
        </div>
        <div class="res__body">
          <p class="res__loc">${esc(r.area)}</p>
          <h3 class="res__h">${esc(r.name)}</h3>
          <p class="res__spec">${specs.map(x => `<span>${esc(x)}</span>`).join('')}</p>
          <p class="res__foot">
            ${priceLabel(r)}
            <span class="res__note">${r.kind === 'project' ? (r.completion ? (r.done ? 'Completed ' : 'Completes ') + r.completion : 'New development') : 'Resale'}</span>
          </p>
        </div>
      </a>`;
    };

    const render = which => {
      const rows = window.LISTINGS
        .filter(r => brief(r) === which)
        .sort((a, b) => (b.priceMax || b.priceMin || 0) - (a.priceMax || a.priceMin || 0))
        .slice(0, 9);
      rail.innerHTML = rows.map(card).join('');
      rail.scrollTo({ left: 0, behavior: 'auto' });
      reveal();
    };
    $$('.brief').forEach(b => b.addEventListener('click', () => {
      $$('.brief').forEach(x => x.setAttribute('aria-selected', 'false'));
      b.setAttribute('aria-selected', 'true');
      render(b.dataset.brief);
    }));
    render('yield');

    const step = () => (rail.querySelector('.res')?.getBoundingClientRect().width || 320) + 16;
    $('#railPrev')?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }));
    $('#railNext')?.addEventListener('click', () => rail.scrollBy({ left:  step(), behavior: reduced ? 'auto' : 'smooth' }));
  }

  /* ---- enquiry form --------------------------------------------------- */
  $('#enquiryForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const note = $('#formNote');
    const name = $('#eName').value.trim(), contact = $('#eContact').value.trim();
    if (!name || !contact) {
      note.textContent = 'Please add your name and a way to reach you.';
      note.style.color = '#e8a99f';
      return;
    }
    note.textContent = 'Thank you — on the real site an adviser would reply within one working day.';
    note.style.color = '#c9a86a';
  });
})();
