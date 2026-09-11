/* ===========================================================================
   ANJIA — the collection engine
   One search, used by every listing page. Free text over every field we hold,
   then facets, then sort, then grid / list / map. State lives in the URL, so
   a search can be sent to somebody.
   ======================================================================== */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A  = window.Anjia = window.Anjia || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BASE = document.body.dataset.base || '';

  /* ---- the searchable index ------------------------------------------- */
  const blob = r => [r.name, r.area, r.address, r.type, r.kind === 'project' ? 'new development project' : 'resale',
                     r.developer, r.tenure, r.furnished, (r.tags || []).join(' '),
                     (r.facilities || []).join(' '), (r.near || []).map(n => n.n).join(' '),
                     r.beds ? r.beds + ' bedroom' : '', r.desc]
    .filter(Boolean).join(' ').toLowerCase();

  let INDEX = [];
  const build = () => { INDEX = (window.LISTINGS || []).map(r => ({ r, s: blob(r) })); };

  /* ---- state ----------------------------------------------------------- */
  const DEFAULTS = { q: '', intent: 'buy', kind: '', type: '', area: '', price: '', beds: '',
                     tenure: '', status: '', sort: 'desc', view: 'grid', page: 1 };
  let state = { ...DEFAULTS };
  const LOCKED = {};                       // facets a section page fixes in place

  function fromURL() {
    const p = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(k => { if (p.has(k)) state[k] = p.get(k); });
    state.page = Math.max(1, +state.page || 1);
    Object.assign(state, LOCKED);
  }
  function toURL(push) {
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => {
      if (v && v !== DEFAULTS[k] && !(k in LOCKED) && k !== 'page') p.set(k, v);
    });
    const url = location.pathname + (p.toString() ? '?' + p : '');
    history[push ? 'pushState' : 'replaceState'](null, '', url);
    // the same filters, carried onto the coast
    const to3d = $('#to3d');
    if (to3d) to3d.href = `${BASE}explore.html` + (p.toString() ? '?' + p : '');
  }

  /* ---- matching -------------------------------------------------------- */
  const M = n => n / 1e6;
  const isSoldOut = r => String(r.availability || '').toLowerCase() === 'sold out';
  const matchesIntent = r => state.intent === 'rent'
    ? !!r.forRent && +r.rentPrice > 0
    : state.intent === 'manage'
      ? false
      : true; // the default collection is the complete source catalogue, including sold-out archive records
  const monthlyRent = r => (+r.rentPrice || 0) /
    (String(r.rentUnit || '').toLowerCase() === 'per_year' ? 12 : 1);
  const priceBounds = r => state.intent === 'rent'
    ? [monthlyRent(r), monthlyRent(r)]
    : [+r.priceMin || 0, +(r.priceMax || r.priceMin) || 0];
  function score(entry, terms) {
    if (!terms.length) return 1;
    let s = 0;
    for (const t of terms) {
      if (!entry.s.includes(t)) return 0;                 // every term must appear
      s += entry.r.name.toLowerCase().includes(t) ? 3
         : String(entry.r.area).toLowerCase().includes(t) ? 2 : 1;
    }
    return s;
  }
  function facets(r) {
    if (!matchesIntent(r)) return false;
    if (state.kind && r.kind !== state.kind) return false;
    if (state.type && r.type !== state.type) return false;
    if (state.area && r.area !== state.area) return false;
    if (state.tenure) {
      if (state.tenure === 'Freehold'      && r.tenure !== 'Freehold') return false;
      if (state.tenure === 'Foreign quota' && !(r.tenure === 'Foreign quota' || r.tenure === 'Freehold')) return false;
      if (state.tenure === 'Thai quota'    && r.tenure !== 'Thai quota') return false;
    }
    if (state.beds) {
      const want = +state.beds;
      // a resale has one bedroom count; a development has a table of unit types
      const counts = r.bedsRange || (r.beds ? [r.beds] : []);
      if (!counts.length) return false;
      if (!counts.some(b => want >= 4 ? b >= 4 : b === want)) return false;
    }
    if (state.status) {
      const availability = String(r.availability || '').toLowerCase();
      if (state.status === 'ready' && !(
        availability === 'ready to move in' || (!availability && (r.kind !== 'project' || r.done)))) return false;
      if (state.status === 'offplan' && !(
        availability === 'off-plan' || (!availability && r.kind === 'project' && !r.done))) return false;
    }
    if (state.price) {
      const [lo, hi] = state.price.split('-').map(Number);
      const [rawMin, rawMax] = priceBounds(r);
      const min = M(rawMin), max = M(rawMax);
      if (max < lo || min > hi) return false;
    }
    return true;
  }
  function results() {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = [];
    for (const e of INDEX) {
      if (!facets(e.r)) continue;
      const sc = score(e, terms);
      if (sc) rows.push({ r: e.r, sc });
    }
    rows.sort((a, b) => {
      const [aMin, aMax] = priceBounds(a.r), [bMin, bMax] = priceBounds(b.r);
      return (
      state.sort === 'asc'  ? aMin - bMin :
      state.sort === 'area' ? (b.r.areaMax || b.r.areaMin || 0) - (a.r.areaMax || a.r.areaMin || 0) :
      state.sort === 'rel'  ? b.sc - a.sc :
                              bMax - aMax);
    });
    return rows.map(x => x.r);
  }
  A.results = results;

  /* ---- card ------------------------------------------------------------ */
  const sizeLabel = r => !r.areaMin ? ''
    : (!r.areaMax || r.areaMax === r.areaMin) ? `${Math.round(r.areaMin)} m²`
    : `${Math.round(r.areaMin)}–${Math.round(r.areaMax)} m²`;
  const specs = r => {
    const out = [];
    if (r.beds) out.push(`${r.beds} bed`);
    if (r.baths) out.push(`${r.baths} bath`);
    if (sizeLabel(r)) out.push(sizeLabel(r));
    if (r.floors && r.kind === 'project') out.push(`${r.floors} floors`);
    out.push(r.type);
    return out;
  };
  const href = r => `${BASE}residence/${encodeURIComponent(r.id)}.html`;

  A.card = (r, i = 0) => {
    const sig = r.tenure === 'Freehold' || r.tenure === 'Foreign quota' ? ' res__flag--sig' : '';
    const [lo, hi] = priceBounds(r);
    const note = state.intent === 'rent'
      ? (String(r.rentUnit || '').toLowerCase() === 'per_year'
        ? 'Rental · monthly equivalent' : 'Rental · per month')
      : r.availability || (r.kind === 'project'
        ? (r.completion ? (r.done ? 'Completed ' : 'Completes ') + r.completion : 'New development')
        : r.kind === 'land' ? 'Land' : 'Resale');
    return `
    <article class="res rv${isSoldOut(r) ? ' res--sold' : ''}">
      <a class="res__link" href="${href(r)}">
        <div class="res__media">
        <img src="${BASE}assets/img/${r.img}-600.jpg"
             srcset="${BASE}assets/img/${r.img}-400.jpg 400w, ${BASE}assets/img/${r.img}-600.jpg 600w, ${BASE}assets/img/${r.img}-900.jpg 900w"
             sizes="(min-width:1000px) 30vw, (min-width:680px) 45vw, 92vw"
             width="900" height="600" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async"
             alt="${esc(r.name)}, ${esc(String(r.type).toLowerCase())} in ${esc(r.area)}">
        ${r.tenure ? `<span class="res__flag${sig}">${esc(r.tenure)}</span>` : ''}
        </div>
        <div class="res__body">
          <p class="res__loc">${esc(r.area)}</p>
          <h3 class="res__h">${esc(r.name)}</h3>
          <p class="res__spec">${specs(r).map(s => `<span>${esc(s)}</span>`).join('')}</p>
          <p class="res__foot">
            <span class="res__price num" data-thb="${lo}" data-thb-max="${hi}"></span>
            <span class="res__note">${esc(note)}</span>
          </p>
        </div>
      </a>
      <button class="fav" type="button" data-id="${esc(r.id)}" data-name="${esc(r.name)}" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/></svg>
      </button>
    </article>`;
  };

  /* ---- map ------------------------------------------------------------- */
  function drawMap(rows) {
    const box = $('#map'); if (!box) return;
    const pts = rows.filter(r => r.lat && r.lng);
    if (!pts.length) { box.innerHTML = '<p class="empty">None of these have coordinates.</p>'; return; }
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    const pad = 0.012;
    const y0 = Math.min(...lats) - pad, y1 = Math.max(...lats) + pad;
    const x0 = Math.min(...lngs) - pad, x1 = Math.max(...lngs) + pad;
    const W = 1000, H = 620;
    // equirectangular, corrected for latitude so distances read true
    const k = Math.cos((y0 + y1) / 2 * Math.PI / 180);
    const sx = W / ((x1 - x0) * k), sy = H / (y1 - y0), s = Math.min(sx, sy);
    const ox = (W - (x1 - x0) * k * s) / 2, oy = (H - (y1 - y0) * s) / 2;
    const X = lng => ox + (lng - x0) * k * s;
    const Y = lat => H - oy - (lat - y0) * s;

    // area labels at the centroid of each area's listings
    const byArea = {};
    pts.forEach(p => (byArea[p.area] = byArea[p.area] || []).push(p));
    const labels = Object.entries(byArea).map(([a, ps]) => {
      const cx = ps.reduce((t, p) => t + X(p.lng), 0) / ps.length;
      const cy = ps.reduce((t, p) => t + Y(p.lat), 0) / ps.length;
      return `<text class="map__lbl" x="${cx.toFixed(1)}" y="${(cy - 16).toFixed(1)}" text-anchor="middle">${esc(a)}</text>`;
    }).join('');

    // a 1 km scale bar, measured in the same projection
    const kmDeg = 1 / 111.32;
    const kmPx = kmDeg * s;
    const pins = pts.map((p, i) => `
      <g class="map__pin" data-i="${i}" tabindex="0" role="button"
         aria-label="${esc(p.name)}, ${esc(p.area)}">
        <circle class="map__dot" cx="${X(p.lng).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="6"/>
      </g>`).join('');

    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Plan of where the residences are">
        <rect width="${W}" height="${H}" class="map__sea" opacity=".35"/>
        ${labels}${pins}
        <g transform="translate(28,${H - 34})">
          <line x1="0" y1="0" x2="${kmPx.toFixed(1)}" y2="0" stroke="var(--muted)" stroke-width="1.5"/>
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--muted)" stroke-width="1.5"/>
          <line x1="${kmPx.toFixed(1)}" y1="-4" x2="${kmPx.toFixed(1)}" y2="4" stroke="var(--muted)" stroke-width="1.5"/>
          <text class="map__lbl" x="${(kmPx / 2).toFixed(1)}" y="-9" text-anchor="middle">1 km</text>
        </g>
        <g transform="translate(${W - 40},34)">
          <path d="M0 12V-12M-5 -6L0 -12l5 6" stroke="var(--muted)" stroke-width="1.4" fill="none"/>
          <text class="map__lbl" x="0" y="26" text-anchor="middle">N</text>
        </g>
      </svg>
      <p class="map__note">Plotted from each residence's own coordinates. Relative positions and
        distances are true; there is no basemap, so nothing here is drawn from guesswork.</p>
      <div class="map__card" id="mapCard"></div>`;

    const cardBox = $('#mapCard', box);
    const show = i => {
      const p = pts[i];
      const [lo, hi] = priceBounds(p);
      $$('.map__pin', box).forEach((g, k) => g.toggleAttribute('data-on', k === i));
      cardBox.innerHTML = `
        <img src="${BASE}assets/img/${p.img}-400.jpg" width="400" height="267" alt="" loading="lazy">
        <div class="map__cb">
          <p>${esc(p.area)}</p><h4>${esc(p.name)}</h4>
          <p class="res__spec"><span class="num" data-thb="${lo}" data-thb-max="${hi}"></span>${state.intent === 'rent'
            ? (String(p.rentUnit || '').toLowerCase() === 'per_year' ? ' / month equivalent' : ' / month') : ''}</p>
          <p style="margin-top:8px;display:flex;gap:14px">
            <a class="tlink" href="${href(p)}">Open</a>
            <a class="tlink" href="https://www.google.com/maps?q=${p.lat},${p.lng}" rel="noopener">Map</a>
          </p>
        </div>`;
      cardBox.setAttribute('data-on', '');
      A.paintCurrency?.();
    };
    $$('.map__pin', box).forEach(g => {
      g.addEventListener('click', () => show(+g.dataset.i));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(+g.dataset.i); } });
    });
    show(0);
  }

  /* ---- render ---------------------------------------------------------- */
  const PER = 12;
  function render() {
    const grid = $('#grid'); if (!grid) return;
    const rows = results();
    const all = window.LISTINGS || [];
    const total = all.filter(r => state.intent === 'rent' ? !!r.forRent && +r.rentPrice > 0 : true).length;
    const managing = state.intent === 'manage';

    const mapBox = $('#mapWrap');
    if (managing) {
      grid.hidden = true;
      if ($('#more')) $('#more').hidden = true;
      if (mapBox) mapBox.hidden = true;
    } else if (state.view === 'map' && rows.length) {
      // the map shows every match at once, so there is nothing left to page
      grid.hidden = true;
      if ($('#more')) $('#more').hidden = true;
      if (mapBox) { mapBox.hidden = false; drawMap(rows); }
    } else {
      if (mapBox) mapBox.hidden = true;
      grid.hidden = false;
      grid.dataset.view = state.view;
      const shown = rows.slice(0, state.page * PER);
      grid.innerHTML = shown.map((r, i) => A.card(r, i)).join('');
      const more = $('#more');
      if (more) {
        const remaining = Math.max(0, rows.length - shown.length);
        more.hidden = remaining === 0;
        if (remaining && $('#moreBtn')) $('#moreBtn').textContent =
          `Show ${Math.min(PER, remaining)} more of ${rows.length}`;
      }
    }

    const empty = $('#empty');
    if (empty) {
      empty.hidden = !managing && rows.length > 0;
      if (managing) empty.innerHTML = `Property management starts with a brief, not a sales result set.<br>
        <a class="tlink" href="${BASE}contact.html?intent=manage">Talk to the management desk →</a>`;
      else if (state.intent === 'rent') empty.innerHTML = `No currently published rental matches those filters.<br>
        <a class="tlink" href="${BASE}contact.html?intent=rent">Ask the lettings desk what is current →</a>`;
      else empty.innerHTML = `Nothing in the collection matches that combination just now.<br>
        <a class="tlink" href="${BASE}contact.html">Tell us what you are looking for →</a>`;
    }
    const fh = rows.filter(r => !isSoldOut(r) && (r.tenure === 'Freehold' || r.tenure === 'Foreign quota')).length;
    const c = $('#count');
    if (c) c.textContent = managing ? 'Property management · adviser-led service'
      : state.intent === 'rent'
        ? (rows.length === total ? `${total} advertised rental${total === 1 ? '' : 's'}`
          : `${rows.length} of ${total} advertised rentals`)
        : (rows.length === total
          ? `${total} residences · ${fh} currently offered with a foreign-ownership route`
          : `${rows.length} of ${total} residences · ${fh} currently offered with a foreign-ownership route`);

    // active filter chips
    const act = $('#active');
    if (act) {
      const LABEL = { q: 'Search', type: 'Kind', area: 'Area', price: 'Budget', beds: 'Bedrooms',
                      tenure: 'Tenure', status: 'Status', kind: 'Category' };
      const PRICE = state.intent === 'rent'
        ? { '0-0.02': 'Under 20K / month', '0.02-0.04': '20–40K / month', '0.04-0.08': '40–80K / month', '0.08-9999': '80K+ / month' }
        : { '0-3': 'Under 3M', '3-8': '3–8M', '8-20': '8–20M', '20-60': '20–60M', '60-9999': '60M+' };
      act.innerHTML = Object.entries(state)
        .filter(([k, v]) => v && LABEL[k] && !(k in LOCKED) && v !== DEFAULTS[k])
        .map(([k, v]) => `<button type="button" data-clear="${k}">
            ${LABEL[k]}: ${esc(k === 'price' ? (PRICE[v] || v) : k === 'beds' ? (v >= 4 ? '4+' : v) : v)}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`).join('');
    }

    document.dispatchEvent(new CustomEvent('anjia:rendered'));
    window.revealAgain?.();
  }
  A.render = render;

  function update(patch, push = true) {
    Object.assign(state, patch);
    if (!('page' in patch)) state.page = 1;
    toURL(push); render();
  }
  A.update = update;

  /* ---- typeahead -------------------------------------------------------- */
  function suggest(input, panel) {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { panel.hidden = true; return; }
    const terms = q.split(/\s+/).filter(Boolean);
    const hits = INDEX.filter(e => matchesIntent(e.r))
      .map(e => ({ r: e.r, sc: score(e, terms) })).filter(x => x.sc)
      .sort((a, b) => b.sc - a.sc).slice(0, 6);
    const areas = [...new Set((window.LISTINGS || []).map(r => r.area))]
      .filter(a => a.toLowerCase().includes(q)).slice(0, 3);
    if (!hits.length && !areas.length) {
      panel.innerHTML = `<p class="sug__k">Nothing matches “${esc(input.value)}”</p>`;
      panel.hidden = false; return;
    }
    const hl = s => esc(s).replace(new RegExp('(' + terms.map(t =>
      t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'), '<mark>$1</mark>');
    panel.innerHTML =
      (areas.length ? `<p class="sug__k">Areas</p>` + areas.map(a =>
        `<button type="button" data-area="${esc(a)}"><i>Area</i><em>${hl(a)}</em></button>`).join('') : '') +
      (hits.length ? `<p class="sug__k">Residences</p>` + hits.map(h =>
        `<button type="button" data-go="${esc(h.r.id)}">
           <img src="${BASE}assets/img/${h.r.img}-400.jpg" alt="" loading="lazy">
           <span><em>${hl(h.r.name)}</em><i>${esc(h.r.area)} · ${esc(h.r.type)}</i></span>
         </button>`).join('') : '');
    panel.hidden = false;
  }

  /* ---- wiring ----------------------------------------------------------- */
  function setPick(pick, value) {
    const opts = $$('.pick__opt', pick);
    const i = Math.max(0, opts.findIndex(o => (o.dataset.v || '') === (value || '')));
    opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
    const val = $('.pick__val', pick); if (val) val.textContent = opts[i].textContent.trim();
  }

  const SALE_BUDGETS = [
    ['', 'Any budget'], ['0-3', 'Under 3M THB'], ['3-8', '3M – 8M THB'],
    ['8-20', '8M – 20M THB'], ['20-60', '20M – 60M THB'], ['60-9999', '60M THB and above']
  ];
  const RENT_BUDGETS = [
    ['', 'Any monthly budget'], ['0-0.02', 'Under 20K THB / month'],
    ['0.02-0.04', '20K – 40K THB / month'], ['0.04-0.08', '40K – 80K THB / month'],
    ['0.08-9999', '80K THB / month and above']
  ];
  function configureBudget() {
    let pick = $('[data-pick][data-filter="price"]');
    if (!pick) return;
    const choices = state.intent === 'rent' ? RENT_BUDGETS : SALE_BUDGETS;
    const menu = $('.pick__menu', pick);
    if (!menu) return;
    menu.innerHTML = choices.map(([value, text]) => `<li><button class="pick__opt" role="option"
      aria-selected="${value === state.price}" data-v="${value}">${text}</button></li>`).join('');
    const label = $('.micro', pick);
    if (label) label.textContent = state.intent === 'rent' ? 'Monthly budget' : 'Budget';
    // Re-initialise so the picker's keyboard-active index follows the new option set.
    const fresh = pick.cloneNode(true);
    pick.replaceWith(fresh);
    window.initPick?.(fresh);
    setPick(fresh, state.price);
  }

  function syncIntentUI() {
    $$('[data-seg] button').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.intent === state.intent)));
    const note = $('#intentNote');
    if (!note) return;
    note.hidden = state.intent === 'buy';
    if (state.intent === 'rent') {
      const n = (window.LISTINGS || []).filter(r => r.forRent && +r.rentPrice > 0).length;
      note.innerHTML = `<b>Rent.</b> Showing the ${n} currently published rental${n === 1 ? '' : 's'},
        on a monthly basis; annual asking prices are shown as monthly equivalents.
        The lettings desk can confirm terms and availability.`;
    } else if (state.intent === 'manage') {
      note.innerHTML = `<b>Management.</b> This is an adviser-led service, not a sale catalogue.
        <a href="${BASE}contact.html?intent=manage">Start a management brief</a>.`;
    }
  }

  function boot() {
    build();
    // section pages lock a facet: <body data-lock="kind:project">
    (document.body.dataset.lock || '').split(',').filter(Boolean).forEach(pair => {
      const [k, v] = pair.split(':'); LOCKED[k] = v;
    });
    fromURL();
    configureBudget();

    // populate the area picker from the data itself
    const areaMenu = $('[data-filter="area"] .pick__menu');
    if (areaMenu) {
      [...new Set((window.LISTINGS || []).map(r => r.area))].sort().forEach(a => {
        const li = document.createElement('li');
        li.innerHTML = `<button class="pick__opt" role="option" data-v="${esc(a)}">${esc(a)}</button>`;
        areaMenu.appendChild(li);
      });
      const p = areaMenu.closest('[data-pick]');
      const fresh = p.cloneNode(true); p.replaceWith(fresh); window.initPick?.(fresh);
    }

    // reflect URL state into the controls
    $$('[data-pick][data-filter]').forEach(p => setPick(p, state[p.dataset.filter]));
    syncIntentUI();
    $$('.views button').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.view === state.view)));
    const qi = $('#q'); if (qi) { qi.value = state.q; qi.closest('.srch__field')?.toggleAttribute('data-has', !!state.q); }

    document.addEventListener('pick:change', e => {
      const pick = e.target.closest('[data-pick][data-filter]');
      if (!pick) return;
      const key = pick.dataset.filter;
      const opt = $$('.pick__opt', pick).find(o => o.getAttribute('aria-selected') === 'true');
      update({ [key]: opt?.dataset.v ?? '' });
    });

    $$('[data-seg] button').forEach(b => b.addEventListener('click', () => {
      update({ intent: b.dataset.intent, price: '' });
      configureBudget();
      syncIntentUI();
    }));

    $$('.views button').forEach(b => b.addEventListener('click', () => {
      $$('.views button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      // on a page with no results to show, the choice simply travels with the search
      if ($('#grid')) update({ view: b.dataset.view });
    }));

    $('#moreBtn')?.addEventListener('click', () => update({ page: state.page + 1 }, false));

    $('#active')?.addEventListener('click', e => {
      const b = e.target.closest('[data-clear]'); if (!b) return;
      const k = b.dataset.clear;
      update({ [k]: DEFAULTS[k] });
      const pick = $(`[data-pick][data-filter="${k}"]`); if (pick) setPick(pick, '');
      if (k === 'q' && $('#q')) { $('#q').value = ''; $('#q').closest('.srch__field')?.removeAttribute('data-has'); }
    });

    $('#clearBtn')?.addEventListener('click', () => {
      state = { ...DEFAULTS, ...LOCKED };
      configureBudget();
      syncIntentUI();
      $$('[data-pick][data-filter]').forEach(p => setPick(p, ''));
      if ($('#q')) { $('#q').value = ''; $('#q').closest('.srch__field')?.removeAttribute('data-has'); }
      toURL(true); render();
    });

    // free-text search
    const form = $('#srchForm'), input = $('#q'), panel = $('#sug');
    if (input) {
      const field = input.closest('.srch__field');
      input.addEventListener('input', () => {
        field?.toggleAttribute('data-has', !!input.value);
        if (panel) suggest(input, panel);
      });
      input.addEventListener('focus', () => { if (panel && input.value.trim().length > 1) suggest(input, panel); });
      $('#qClear')?.addEventListener('click', () => {
        input.value = ''; field?.removeAttribute('data-has');
        if (panel) panel.hidden = true;
        if ($('#grid')) update({ q: '' }); else input.focus();
      });
      document.addEventListener('click', e => {
        if (panel && !e.target.closest('.srch__q')) panel.hidden = true;
      });
      panel?.addEventListener('click', e => {
        const go = e.target.closest('[data-go]'), ar = e.target.closest('[data-area]');
        if (go) location.href = `${BASE}residence/${encodeURIComponent(go.dataset.go)}.html`;
        else if (ar) {
          panel.hidden = true;
          if ($('#grid')) { update({ area: ar.dataset.area, q: '' }); input.value = '';
            const p = $('[data-pick][data-filter="area"]'); if (p) setPick(p, ar.dataset.area); }
          else location.href = `${BASE}residences.html?area=${encodeURIComponent(ar.dataset.area)}`;
        }
      });
    }
    form?.addEventListener('submit', e => {
      e.preventDefault();
      if (panel) panel.hidden = true;
      const q = input ? input.value.trim() : '';
      if ($('#grid')) { update({ q }); }
      else {
        // hero search on a page without a grid — carry the whole state across
        if (state.intent === 'manage') {
          location.href = `${BASE}contact.html?intent=manage`;
          return;
        }
        const p = new URLSearchParams();
        if (q) p.set('q', q);
        $$('[data-pick][data-filter]', form).forEach(pk => {
          const o = $$('.pick__opt', pk).find(x => x.getAttribute('aria-selected') === 'true');
          if (o?.dataset.v) p.set(pk.dataset.filter, o.dataset.v);
        });
        const seg = $('[data-seg] button[aria-selected="true"]', form);
        if (seg && seg.dataset.intent !== 'buy') p.set('intent', seg.dataset.intent);
        const view = $('.views button[aria-selected="true"]', form);
        if (view && view.dataset.view !== 'grid') p.set('view', view.dataset.view);
        location.href = `${BASE}residences.html` + (p.toString() ? '?' + p : '');
      }
    });

    addEventListener('popstate', () => {
      state = { ...DEFAULTS }; fromURL(); configureBudget(); syncIntentUI(); render();
    });

    if ($('#grid')) render();
  }

  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot) : boot();
})();
