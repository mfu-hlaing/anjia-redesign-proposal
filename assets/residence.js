/* ===========================================================================
   Residence detail — reads ?id= and renders one record from window.LISTINGS.
   ======================================================================== */
(() => {
  'use strict';
  const root = document.getElementById('detailRoot');
  if (!root || !window.LISTINGS) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const id = new URLSearchParams(location.search).get('id');
  const r = window.LISTINGS.find(x => x.id === id) || window.LISTINGS[0];
  if (!r) { root.innerHTML = '<p class="empty">That residence is no longer in the collection.</p>'; return; }

  document.title = `${r.name} — Anjia Residences`;

  const M = n => n / 1e6;
  const money = n => { const m = M(n); return m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2); };
  const price = !r.priceMin ? 'On application'
    : (!r.priceMax || r.priceMax === r.priceMin)
      ? `${money(r.priceMin)}<i>M THB</i>`
      : `${money(r.priceMin)}<span class="dash">–</span>${money(r.priceMax)}<i>M THB</i>`;
  const unit = r.unitMin
    ? (r.unitMax && r.unitMax !== r.unitMin
        ? `${Math.round(r.unitMin).toLocaleString()}–${Math.round(r.unitMax).toLocaleString()} THB / m²`
        : `${Math.round(r.unitMin).toLocaleString()} THB / m²`)
    : '';
  const size = !r.areaMin ? '—'
    : (!r.areaMax || r.areaMax === r.areaMin) ? `${Math.round(r.areaMin)} m²`
    : `${Math.round(r.areaMin)}–${Math.round(r.areaMax)} m²`;

  const shots = [r.img, ...(r.gallery || [])];
  const srcOf = (stem, w) => `assets/img/${stem}-${w}.jpg`;
  const main = stem => stem === r.img
    ? `<img id="galMain" src="${srcOf(stem,900)}" srcset="${srcOf(stem,600)} 600w, ${srcOf(stem,900)} 900w"
           sizes="(min-width:1000px) 62vw, 96vw" width="900" height="600" alt="${esc(r.name)}" decoding="async">`
    : `<img id="galMain" src="${srcOf(stem,1000)}" width="1000" height="750" alt="${esc(r.name)}" decoding="async">`;

  const fact = (t, v) => v ? `<div class="fact"><dt>${t}</dt><dd>${esc(v)}</dd></div>` : '';
  const facts = [
    fact('Tenure', r.tenure),
    fact('Size', size),
    fact(r.kind === 'project' ? 'Unit price' : 'Price per m²', unit),
    fact('Bedrooms', r.beds),
    fact('Bathrooms', r.baths),
    fact('Storeys', r.floors),
    fact('Residences', r.households ? r.households.toLocaleString() : ''),
    fact('Buildings', r.buildings),
    fact('Completion', r.completion),
    fact('Opened', r.opened),
    fact('Parking', r.parking ? r.parking.toLocaleString() + ' spaces' : ''),
    fact('Service charge', r.fee),
    fact('Land area', r.landArea ? r.landArea.toLocaleString() + ' m²' : ''),
    fact('Furnishing', r.furnished),
    fact('Built', r.built),
  ].filter(Boolean).join('');

  const chips = arr => (arr && arr.length)
    ? `<div class="chips">${arr.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : '';

  const near = (r.near && r.near.length)
    ? `<h3>What is nearby</h3><ul class="nearList">${r.near.map(n =>
        `<li><span>${esc(n.n)}</span><span>${esc(n.d)} km</span></li>`).join('')}</ul>` : '';

  const tenureNote = r.tenure === 'Freehold'
    ? 'Held outright, in your own name, in perpetuity — subject to the building’s 49% foreign quota having room at the time of transfer. We confirm the quota position before you commit.'
    : r.tenure === 'Foreign quota'
    ? 'This unit sits inside the building’s foreign quota, so it can be transferred into a foreign name outright. Quota units are finite and do not return often.'
    : 'Currently held under Thai quota. A foreign buyer would take this by registered lease or wait for a quota unit — we will set out both routes before you decide.';

  root.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="index.html">Anjia</a><span aria-hidden="true">/</span>
      <a href="residences.html">The Collection</a><span aria-hidden="true">/</span>
      <span>${esc(r.area)}</span>
    </nav>

    <header class="detail__head">
      <div>
        <p class="detail__loc">${esc(r.area)} &nbsp;·&nbsp; ${esc(r.type)}${r.kind === 'project' ? ' &nbsp;·&nbsp; New development' : ' &nbsp;·&nbsp; Resale'}</p>
        <h1 class="detail__h">${esc(r.name)}</h1>
        ${r.address ? `<p class="lede" style="margin-top:var(--s-3);font-size:var(--t-sm)">${esc(r.address)}</p>` : ''}
      </div>
      <div class="detail__price">
        <span class="detail__p">${price}</span>
        ${r.tenure ? `<span class="tenureChip${r.tenure === 'Freehold' || r.tenure === 'Foreign quota' ? ' tenureChip--brass' : ''}">${esc(r.tenure)}</span>` : ''}
      </div>
    </header>

    <div class="gallery">
      <figure class="gallery__main" style="margin:0">${main(r.img)}</figure>
      ${shots.length > 1 ? `<div class="gallery__strip" role="group" aria-label="Photographs">
        ${shots.map((s, i) => `<button type="button" data-stem="${s}" aria-current="${i === 0}" aria-label="Photograph ${i + 1}">
          <img src="${srcOf(s, i === 0 ? 400 : 600)}" alt="" loading="lazy" decoding="async"></button>`).join('')}
      </div>` : ''}
    </div>

    <div class="detailBody">
      <div>
        <dl class="facts">${facts}</dl>

        <div class="prose" style="margin-top:var(--s-8)">
          <h3>What a foreigner may do here</h3>
          <p>${tenureNote}</p>

          ${r.desc ? `<h3>The residence</h3><p>${esc(r.desc)}</p>` : ''}

          ${r.developer ? `<h3>The developer</h3>
            <p><strong style="font-weight:400;font-family:'Bodoni Moda',serif">${esc(r.developer)}</strong>${r.developerNote ? ' — ' + esc(r.developerNote) : ''}</p>` : ''}

          ${r.facilities && r.facilities.length ? `<h3>On site</h3>${chips(r.facilities)}` : ''}
          ${r.tags && r.tags.length ? `<h3>Noted for</h3>${chips(r.tags)}` : ''}
          ${r.traffic ? `<h3>Getting there</h3><p>${esc(r.traffic)}</p>` : ''}
          ${near}
        </div>
      </div>

      <aside class="aside">
        <div class="asideCard">
          <h3>Enquire privately</h3>
          <p>An adviser who speaks your language will confirm the current quota position, the true
             all-in cost, and whether this residence actually suits what you described.</p>
          <div class="asideCard__rule"></div>
          <div class="asideCard__row"><span>Tenure</span><span>${esc(r.tenure || '—')}</span></div>
          <div class="asideCard__row"><span>Size</span><span>${esc(size)}</span></div>
          <div class="asideCard__row"><span>Area</span><span>${esc(r.area)}</span></div>
          <a class="btn btn--primary btn--block" href="contact.html">Request details</a>
          <a class="btn btn--outline btn--block" style="margin-top:var(--s-2)" href="tel:+66123443888">Call the desk</a>
        </div>
      </aside>
    </div>

    <section class="sec" style="border-top:1px solid var(--rule);margin-top:var(--s-8)">
      <div class="secHead"><div><p class="kicker">Also in ${esc(r.area)}</p>
        <h2 class="secHead__h">Nearby in the collection</h2></div></div>
      <div class="grid" id="alsoGrid"></div>
    </section>`;

  /* gallery switching */
  const mainImg = document.getElementById('galMain');
  root.querySelectorAll('.gallery__strip button').forEach(b => b.addEventListener('click', () => {
    root.querySelectorAll('.gallery__strip button').forEach(x => x.setAttribute('aria-current', 'false'));
    b.setAttribute('aria-current', 'true');
    const stem = b.dataset.stem;
    mainImg.removeAttribute('srcset');
    mainImg.src = srcOf(stem, stem === r.img ? 900 : 1000);
  }));

  /* nearby */
  const also = window.LISTINGS.filter(x => x.id !== r.id && x.area === r.area).slice(0, 3);
  const pool = also.length ? also : window.LISTINGS.filter(x => x.id !== r.id).slice(0, 3);
  document.getElementById('alsoGrid').innerHTML = pool.map(x => {
    const p = !x.priceMin ? 'On application'
      : (!x.priceMax || x.priceMax === x.priceMin) ? `${money(x.priceMin)}<i>M THB</i>`
      : `${money(x.priceMin)}<span class="dash">–</span>${money(x.priceMax)}<i>M THB</i>`;
    return `<a class="res" href="residence.html?id=${encodeURIComponent(x.id)}">
      <div class="res__media">
        <img src="${srcOf(x.img, 600)}" width="900" height="600" loading="lazy" decoding="async" alt="${esc(x.name)}">
        ${x.tenure ? `<span class="res__flag${x.tenure === 'Freehold' || x.tenure === 'Foreign quota' ? ' res__flag--sig' : ''}">${esc(x.tenure)}</span>` : ''}
      </div>
      <div class="res__body">
        <p class="res__loc">${esc(x.area)}</p>
        <h3 class="res__h">${esc(x.name)}</h3>
        <p class="res__foot"><span class="res__price num">${p}</span></p>
      </div></a>`;
  }).join('');

  window.revealAgain?.();
})();
