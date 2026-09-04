/* ===========================================================================
   The Collection — filtering, sorting and rendering over window.LISTINGS.
   ======================================================================== */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const grid = $('#grid');
  if (!grid || !window.LISTINGS) return;

  const state = { tenure: '', area: '', type: '', price: '', sort: 'desc' };

  /* ---- populate the area picker from the data itself ------------------ */
  const areaMenu = $('#areaMenu');
  if (areaMenu && window.AREAS) {
    window.AREAS.forEach(a => {
      const li = document.createElement('li');
      li.innerHTML = `<button class="pick__opt" role="option" data-v="${a}">${a}</button>`;
      areaMenu.append(li);
    });
    // the picker was initialised before these options existed — rebuild it
    const pick = areaMenu.closest('[data-pick]');
    pick.replaceWith(pick.cloneNode(true));
    window.initPick?.($('[data-filter="area"]'));
  }

  /* ---- formatting ----------------------------------------------------- */
  const M = n => n / 1e6;
  const money = n => {
    if (!n) return '—';
    const m = M(n);
    return m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2);
  };
  const priceLabel = r => {
    if (!r.priceMin) return '<span class="res__price num">On application</span>';
    const one = !r.priceMax || r.priceMax === r.priceMin;
    return one
      ? `<span class="res__price num">${money(r.priceMin)}<i>M THB</i></span>`
      : `<span class="res__price num">${money(r.priceMin)}<span class="dash">–</span>${money(r.priceMax)}<i>M THB</i></span>`;
  };
  const sizeLabel = r => {
    if (!r.areaMin) return '';
    const one = !r.areaMax || r.areaMax === r.areaMin;
    return one ? `${Math.round(r.areaMin)} m²` : `${Math.round(r.areaMin)}–${Math.round(r.areaMax)} m²`;
  };
  const specs = r => {
    const out = [];
    if (r.beds) out.push(`${r.beds} bed`);
    if (r.baths) out.push(`${r.baths} bath`);
    if (sizeLabel(r)) out.push(sizeLabel(r));
    if (r.floors && r.kind === 'project') out.push(`${r.floors} floors`);
    out.push(r.type);
    return out;
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- card ------------------------------------------------------------ */
  const card = (r, i) => {
    const tenureClass = r.tenure === 'Freehold' || r.tenure === 'Foreign quota' ? ' res__flag--sig' : '';
    return `
    <a class="res rv${i < 6 ? '' : ''}" href="residence.html?id=${encodeURIComponent(r.id)}">
      <div class="res__media">
        <img src="assets/img/${r.img}-600.jpg"
             srcset="assets/img/${r.img}-400.jpg 400w, assets/img/${r.img}-600.jpg 600w, assets/img/${r.img}-900.jpg 900w"
             sizes="(min-width:1000px) 30vw, (min-width:680px) 45vw, 92vw"
             width="900" height="600" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async"
             alt="${esc(r.name)}, ${esc(r.type.toLowerCase())} in ${esc(r.area)}">
        ${r.tenure ? `<span class="res__flag${tenureClass}">${esc(r.tenure)}</span>` : ''}
      </div>
      <div class="res__body">
        <p class="res__loc">${esc(r.area)}</p>
        <h3 class="res__h">${esc(r.name)}</h3>
        <p class="res__spec">${specs(r).map(s => `<span>${esc(s)}</span>`).join('')}</p>
        <p class="res__foot">
          ${priceLabel(r)}
          <span class="res__note">${r.kind === 'project' ? (r.completion ? (r.done ? 'Completed ' : 'Completes ') + r.completion : 'New development') : 'Resale'}</span>
        </p>
      </div>
    </a>`;
  };

  /* ---- filter + sort --------------------------------------------------- */
  const matches = r => {
    if (state.tenure) {
      if (state.tenure === 'Freehold' && r.tenure !== 'Freehold') return false;
      if (state.tenure === 'Foreign quota' && !(r.tenure === 'Foreign quota' || r.tenure === 'Freehold')) return false;
      if (state.tenure === 'Thai quota' && r.tenure !== 'Thai quota') return false;
    }
    if (state.area && r.area !== state.area) return false;
    if (state.type && r.type !== state.type) return false;
    if (state.price) {
      const [lo, hi] = state.price.split('-').map(Number);
      const min = M(r.priceMin || 0), max = M(r.priceMax || r.priceMin || 0);
      if (max < lo || min > hi) return false;
    }
    return true;
  };

  const render = () => {
    let rows = window.LISTINGS.filter(matches);
    rows.sort((a, b) =>
      state.sort === 'asc'  ? (a.priceMin || 0) - (b.priceMin || 0) :
      state.sort === 'area' ? (b.areaMax || b.areaMin || 0) - (a.areaMax || a.areaMin || 0) :
                              (b.priceMax || b.priceMin || 0) - (a.priceMax || a.priceMin || 0));

    grid.innerHTML = rows.map(card).join('');
    $('#empty').hidden = rows.length > 0;

    const total = window.LISTINGS.length;
    const fh = rows.filter(r => r.tenure === 'Freehold' || r.tenure === 'Foreign quota').length;
    $('#count').textContent = rows.length === total
      ? `${total} residences · ${fh} available to a foreign buyer outright`
      : `${rows.length} of ${total} residences · ${fh} available to a foreign buyer outright`;

    window.revealAgain?.();
  };

  /* ---- wire the pickers ------------------------------------------------ */
  document.addEventListener('pick:change', e => {
    const pick = e.target.closest('[data-pick]');
    const key = pick?.dataset.filter;
    if (!key) return;
    const opt = $$('.pick__opt', pick).find(o => o.getAttribute('aria-selected') === 'true');
    state[key] = opt?.dataset.v ?? '';
    render();
  });

  $('#clearBtn')?.addEventListener('click', () => {
    Object.assign(state, { tenure: '', area: '', type: '', price: '', sort: 'desc' });
    $$('[data-pick]').forEach(pick => {
      const opts = $$('.pick__opt', pick);
      opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === 0)));
      $('.pick__val', pick).textContent = opts[0].textContent.trim();
    });
    render();
  });

  render();
})();
