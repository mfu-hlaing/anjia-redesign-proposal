/* ===========================================================================
   ANJIA — parity layer
   Global behaviours the live site has on every page: currency, the cookie
   notice, the customer-service rail, the concierge, saved residences, and the
   gallery lightbox. Search lives in search.js.
   ======================================================================== */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('anjia:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('anjia:' + k, JSON.stringify(v)); } catch {} }
  };
  const A = window.Anjia = window.Anjia || {};
  A.store = store;

  /* ==================================================================== */
  /* Currency                                                             */
  /* The live site has a currency control that changes nothing. This one   */
  /* rewrites every price on the page, and says where the rate came from.  */
  /* ==================================================================== */
  const RATES = { THB: [1, '฿'], USD: [0.0274, '$'], CNY: [0.199, '¥'], JPY: [4.28, '¥'] };
  const RATE_DATE = 'September 2026';

  const fmtM = (n, cur) => {
    const [rate] = RATES[cur] || RATES.THB;
    const v = n * rate;
    const scale = v >= 1e6 ? 1e6 : v >= 1e3 ? 1e3 : 1;
    const compact = v / scale;
    return compact >= 100 ? compact.toFixed(0)
      : compact >= 10 ? compact.toFixed(1)
      : compact >= 1 ? compact.toFixed(2)
      : compact.toFixed(2);
  };
  const unitOf = (n, cur) => {
    const v = n * (RATES[cur] || RATES.THB)[0];
    return (v >= 1e6 ? 'M ' : v >= 1e3 ? 'K ' : '') + cur;
  };

  A.currency = () => {
    const saved = store.get('cur', 'THB');
    return RATES[saved] ? saved : 'THB';
  };
  A.money = n => {
    if (!n) return '';
    const c = A.currency();
    return `${fmtM(n, c)}<i>${unitOf(n, c)}</i>`;
  };
  A.moneyPlain = n => {
    if (!n) return '';
    const c = A.currency();
    return `${fmtM(n, c)}${unitOf(n, c)}`;
  };
  A.perSqm = n => {
    if (!n) return '';
    const c = A.currency(), [rate] = RATES[c] || RATES.THB;
    return `${Math.round(n * rate).toLocaleString()} ${c} / m²`;
  };

  function paintCurrency() {
    const c = A.currency();
    $('#curCur') && ($('#curCur').textContent = c);
    $$('#curMenu button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.cur === c)));
    // any element that carries its own baht value re-renders itself
    $$('[data-thb]').forEach(el => {
      const lo = +el.dataset.thb, hi = +(el.dataset.thbMax || 0);
      const period = el.dataset.period || '';
      el.innerHTML = (!lo ? 'On application'
        : (hi && hi !== lo)
          ? `${fmtM(lo, c)}<span class="dash">–</span>${fmtM(hi, c)}<i>${unitOf(hi, c)}</i>`
          : `${fmtM(lo, c)}<i>${unitOf(lo, c)}</i>`) +
          (period ? `<small>${period}</small>` : '');
    });
    $$('[data-sqm]').forEach(el => { el.textContent = A.perSqm(+el.dataset.sqm); });
    $$('[data-ratenote]').forEach(el => {
      el.textContent = c === 'THB' ? 'Prices in Thai baht.'
        : `Converted from Thai baht at an indicative ${RATE_DATE} rate. Baht is the contract currency.`;
    });
    document.dispatchEvent(new CustomEvent('anjia:currency', { detail: { cur: c } }));
  }
  A.paintCurrency = paintCurrency;

  const curBtn = $('#curBtn'), curMenu = $('#curMenu');
  curBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const open = curMenu.hasAttribute('data-open');
    curMenu.toggleAttribute('data-open', !open);
    curBtn.setAttribute('aria-expanded', String(!open));
  });
  $$('#curMenu button').forEach(b => b.addEventListener('click', () => {
    store.set('cur', b.dataset.cur);
    curMenu.removeAttribute('data-open');
    curBtn.setAttribute('aria-expanded', 'false');
    paintCurrency();
  }));
  document.addEventListener('click', e => {
    if (!e.target.closest('.lang--cur')) {
      curMenu?.removeAttribute('data-open'); curBtn?.setAttribute('aria-expanded', 'false');
    }
    if (!e.target.closest('#followPop') && !e.target.closest('#followBtn')) closeFollow();
  });

  /* ==================================================================== */
  /* Language                                                             */
  /* The live site serves four languages. This concept is written in       */
  /* English only, and says so rather than letting the control look        */
  /* broken — the switcher is wired, the translations are a content job.   */
  /* ==================================================================== */
  const LANGS = { EN: 'English', TH: 'ไทย', ZH: '中文', JA: '日本語' };
  function setLang(code) {
    const requested = LANGS[code] ? code : 'EN';
    // Every visible word in this proposal is English. Keep the document's language,
    // persisted state and selected control truthful even when another language is requested.
    document.documentElement.lang = 'en';
    store.set('lang', 'EN');
    $$('[data-code]').forEach(b => {
      const on = b.dataset.code === 'EN';
      b.setAttribute(b.hasAttribute('aria-pressed') ? 'aria-pressed' : 'aria-selected', String(on));
    });
    const cur = $('#langCur'); if (cur) cur.textContent = 'EN';
    let note = $('#langNote');
    clearTimeout(setLang._t);
    if (requested === 'EN') { note?.remove(); return; }
    if (!note) {
      note = document.createElement('div');
      note.className = 'langNote'; note.id = 'langNote'; note.setAttribute('role', 'status');
      document.body.appendChild(note);
    }
    note.innerHTML = `<b>${LANGS[requested]} is not available in this proposal yet.</b>
      All displayed content remains English, and no machine translation has been substituted.
      <button type="button" id="langBack">Dismiss</button>`;
    $('#langBack').addEventListener('click', () => note.remove());
    setLang._t = setTimeout(() => note.remove(), 9000);
  }
  $$('#langMenu button, .drawer__lang').forEach(b =>
    b.addEventListener('click', () => setLang(b.dataset.code)));
  setLang('EN');

  /* ==================================================================== */
  /* Cookie notice                                                        */
  /* ==================================================================== */
  const cookie = $('#cookie');
  if (cookie) {
    if (!store.get('consent')) {
      // let the page paint first; the banner is not the first thing anyone sees
      setTimeout(() => cookie.hidden = false, 900);
    }
    $$('[data-cookie]', cookie).forEach(b => b.addEventListener('click', () => {
      store.set('consent', { choice: b.dataset.cookie, at: Date.now() });
      cookie.hidden = true;
    }));
  }

  /* ==================================================================== */
  /* Service rail                                                         */
  /* ==================================================================== */
  const svc = $('#svc'), followPop = $('#followPop'), followBtn = $('#followBtn');
  const closeFollow = () => { if (followPop) { followPop.hidden = true; followBtn?.setAttribute('aria-expanded', 'false'); } };
  followBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const open = !followPop.hidden;
    followPop.hidden = open;
    followBtn.setAttribute('aria-expanded', String(!open));
  });
  $('#toTop')?.addEventListener('click', () => window.scrollTo({
    top: 0, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'
  }));
  const onScroll = () => svc?.toggleAttribute('data-scrolled', scrollY > 600);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ==================================================================== */
  /* Saved residences                                                     */
  /* ==================================================================== */
  A.saved = () => store.get('saved', []);
  A.isSaved = id => A.saved().includes(String(id));
  A.toggleSave = id => {
    id = String(id);
    const s = A.saved(), i = s.indexOf(id);
    i < 0 ? s.push(id) : s.splice(i, 1);
    store.set('saved', s);
    paintSaved();
    document.dispatchEvent(new CustomEvent('anjia:saved', { detail: { id, on: i < 0 } }));
    return i < 0;
  };
  function paintSaved() {
    const n = A.saved().length;
    $$('[data-savecount]').forEach(el => { el.textContent = n; el.hidden = n === 0; });
    $$('.fav[data-id]').forEach(b => {
      const on = A.isSaved(b.dataset.id);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', (on ? 'Remove ' : 'Save ') + (b.dataset.name || 'this residence'));
    });
  }
  A.paintSaved = paintSaved;
  document.addEventListener('click', e => {
    const b = e.target.closest('.fav[data-id]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    A.toggleSave(b.dataset.id);
  });

  /* ==================================================================== */
  /* Concierge                                                            */
  /* Answers assembled from Anjia's own published guidance and from the    */
  /* collection itself. It never invents a fact, and it hands over to a    */
  /* person the moment a question needs one.                               */
  /* ==================================================================== */
  const L = () => window.LISTINGS || [];
  const count = fn => L().filter(fn).length;
  const cheapest = () => L().filter(r => r.priceMin).sort((a, b) => a.priceMin - b.priceMin)[0];

  const TOPICS = [
    { q: 'Can a foreigner own a condominium here?',
      a: () => `Yes — outright, in your own name, provided the unit sits inside the building's
        <b>foreign quota</b>. Thai law lets foreigners hold up to 49% of a condominium building's
        total floor area. Land beneath a house is different: a foreigner may not own it directly,
        so a villa is normally held on a registered lease or through a Thai company.
        <ul><li>${count(r => /Freehold|Foreign/i.test(r.tenure || ''))} of our
        ${L().length} residences are available on that basis today.</li></ul>`,
      more: ['ownership.html', 'Read the ownership guide'] },
    { q: 'What is the cheapest residence you hold?',
      a: () => { const r = cheapest(); return !r ? 'The collection is loading.' :
        `<b>${r.name}</b> in ${r.area}, from ${A.moneyPlain(r.priceMin)}. It is a ${String(r.type).toLowerCase()}
         on ${r.tenure ? String(r.tenure).toLowerCase() : 'a title we will confirm'}.`; },
      more: ['residences.html?sort=asc', 'See the collection by entry price'] },
    { q: 'Which areas do you cover?',
      a: () => `Pattaya and the coast either side of it — ${[...new Set(L().map(r => r.area))].sort().join(', ')}.
        Bangkok is served through the same desk.`,
      more: ['residences.html', 'Filter by area'] },
    { q: 'Do I have to fly out to buy?',
      a: () => `No. Most of our owners have never stood in the building they bought. Title is verified
        here, the foreign-quota position is confirmed in writing before you commit, and the transfer
        can be completed under a power of attorney while you stay where you are.`,
      more: ['process.html', 'See the eight steps'] },
    { q: 'What does it cost to transfer?',
      a: () => `Transfer fee is 2% of the appraised value, normally split between buyer and seller.
        A specific business tax of 3.3% applies if the seller has held the property under five years,
        otherwise stamp duty of 0.5%. Withholding tax depends on the seller. We set the exact figures
        out in writing before you commit to anything.`,
      more: ['process.html', 'The process, step by step'] },
    { q: 'Can you manage the property after I buy?',
      a: () => `That is the part of the business most owners actually use. Letting, tenant handling,
        bill payment, inspection and remittance — reported to you monthly, in your language,
        wherever you live.`,
      more: ['about.html', 'About the practice'] },
    { q: 'What is a leasehold, and should I worry about it?',
      a: () => `A registered lease of up to 30 years, renewable by agreement. It is the normal route
        where a foreigner cannot hold the freehold — most commonly land under a villa. It is not the
        same as owning, and we will always tell you which one you are being offered.`,
      more: ['ownership.html', 'Freehold, quota and lease compared'] },
    { q: 'I would rather speak to a person.',
      a: () => `Of course. The desk answers in English, Thai, Chinese and Japanese, and replies within
        one working day. Call <a href="tel:+66612343888">+66 61 234 3888</a> or send the form and an
        adviser will come back to you.`,
      more: ['contact.html', 'Send an enquiry'] },
  ];

  const cx = $('#concierge'), cxLog = $('#cxLog'), cxAsk = $('#cxAsk');
  function say(html, mine) {
    const d = document.createElement('div');
    d.className = 'cx__m' + (mine ? ' cx__m--me' : '');
    d.innerHTML = html;
    cxLog.appendChild(d);
    cxLog.scrollTop = cxLog.scrollHeight;
  }
  function askButtons(list) {
    cxAsk.innerHTML = '';
    list.forEach(t => {
      const b = document.createElement('button');
      b.className = 'cx__q'; b.type = 'button'; b.textContent = t.q;
      b.addEventListener('click', () => {
        say(t.q, true);
        setTimeout(() => {
          say(t.a() + (t.more ? `<p style="margin-top:8px"><a href="${t.more[0]}">${t.more[1]} →</a></p>` : ''));
          askButtons(TOPICS.filter(x => x !== t).slice(0, 5));
        }, 260);
      });
      cxAsk.appendChild(b);
    });
  }
  function openCx() {
    if (!cx) return;
    cx.hidden = false;
    $('#conciergeBtn')?.setAttribute('aria-expanded', 'true');
    if (!cxLog.children.length) {
      say(`Good day. I answer from Anjia's own published guidance — ownership rules, the purchase
           process, and what is actually in the collection. For anything that needs judgement, I will
           put you to an adviser rather than guess.`);
      askButtons(TOPICS.slice(0, 5));
    }
    $('#cxClose')?.focus();
  }
  function closeCx() { if (cx) { cx.hidden = true; $('#conciergeBtn')?.setAttribute('aria-expanded', 'false'); } }
  $('#conciergeBtn')?.addEventListener('click', () => cx.hidden ? openCx() : closeCx());
  $$('[data-concierge]').forEach(b => b.addEventListener('click', openCx));
  $('#cxClose')?.addEventListener('click', closeCx);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCx(); closeFollow(); closeLb(); } });

  /* ==================================================================== */
  /* Gallery lightbox                                                     */
  /* ==================================================================== */
  let lb = null, lbShots = [], lbI = 0;
  function buildLb() {
    lb = document.createElement('div');
    lb.className = 'lb'; lb.hidden = true;
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photographs');
    lb.innerHTML = `
      <div class="lb__top">
        <span class="micro" id="lbCount"></span>
        <button class="ibtn" id="lbClose" aria-label="Close photographs">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="lb__stage">
        <button class="lb__nav lb__nav--p" aria-label="Previous photograph">
          <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <img id="lbImg" alt="">
        <button class="lb__nav lb__nav--n" aria-label="Next photograph">
          <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="lb__dots" id="lbDots"></div>`;
    document.body.appendChild(lb);
    $('#lbClose', lb).addEventListener('click', closeLb);
    $('.lb__nav--p', lb).addEventListener('click', () => go(lbI - 1));
    $('.lb__nav--n', lb).addEventListener('click', () => go(lbI + 1));
    lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'ArrowLeft') go(lbI - 1);
      if (e.key === 'ArrowRight') go(lbI + 1);
      if (e.key === 'Escape') closeLb();
    });
    // a swipe on the photograph moves to the next one
    let t0 = null;
    const stage = $('.lb__stage', lb);
    stage.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; t0 = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener('pointerup', e => {
      if (!t0) return; const dx = e.clientX - t0.x, dy = e.clientY - t0.y; t0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(lbI + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener('pointercancel', () => { t0 = null; });
  }
  function go(i) {
    if (!lbShots.length) return;
    lbI = (i + lbShots.length) % lbShots.length;
    $('#lbImg', lb).src = lbShots[lbI];
    $('#lbCount', lb).textContent = `${lbI + 1} of ${lbShots.length}`;
    $$('#lbDots button', lb).forEach((d, k) => d.setAttribute('aria-selected', String(k === lbI)));
  }
  A.lightbox = (shots, i = 0) => {
    if (!lb) buildLb();
    lbShots = shots;
    $('#lbDots', lb).innerHTML = shots.map((_, k) =>
      `<button type="button" aria-label="Photograph ${k + 1}"></button>`).join('');
    $$('#lbDots button', lb).forEach((d, k) => d.addEventListener('click', () => go(k)));
    lb.hidden = false; go(i);
    $('#lbClose', lb).focus();
  };
  function closeLb() { if (lb) lb.hidden = true; }

  /* ==================================================================== */
  paintCurrency();
  paintSaved();
  document.addEventListener('anjia:rendered', () => { paintSaved(); paintCurrency(); });
})();
