/* ===========================================================================
   ANJIA — the room tour: walk through the photographs.

   A residence's own photographs hung along a warm, dark hall; you walk from
   one to the next. The layout drawings wait at the end, and then the door.
   No geometry is invented: these are the photographs, at their true aspect,
   fitted to whatever screen is looking — phone, tablet or laptop.
   ======================================================================== */
import * as THREE from './vendor/three.module.min.js';

const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const coarse = matchMedia('(pointer:coarse)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let current = null;

export function openTour(opts) {
  if (current) current.close();
  current = new Hall(opts);
  return current;
}

const ICON = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5-10-6.5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
  motion: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 9c-1 2-1 4 0 6M21 9c1 2 1 4 0 6"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m15.5 15.5 4 4M11 8v6M8 11h6"/></svg>',
};

class Hall {
  constructor({ title, subtitle = '', shots = [], plans = [], base = '', href = '', id = '', trigger = null }) {
    this.title = title; this.shots = shots; this.plans = plans; this.base = base; this.href = href; this.id = id; this.trigger = trigger;
    this.stations = [...shots.map((src, i) => ({ kind: 'photo', src, i })), ...plans.map((p, i) => ({ kind: 'plan', src: p.src, name: p.name, i })), { kind: 'door' }];
    this.i = 0; this.alive = true; this.auto = 0; this.motion = false; this.SP = 15;
    this.build();
    this.scene3d();
    if (!this.alive) return;
    this.bind();
    this.el.__hall = this;
    this.go(0, true);
    this.loop = this.loop.bind(this); this.timer = new THREE.Timer(); this.loop();
  }

  /* ------------------------------------------------------------ the room */
  build() {
    const el = this.el = document.createElement('div');
    el.className = 'hall'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', `Room tour of ${this.title}`);
    el.innerHTML = `
      <canvas></canvas>
      <div class="hall__top">
        <div class="hall__title"><p class="micro">Room tour</p><h2>${esc(this.title)}</h2></div>
        <div class="hall__tools">
          <button class="ibtn" type="button" data-play aria-pressed="false" aria-label="Play the tour" title="Play the tour">${ICON.play}</button>
          <button class="ibtn" type="button" data-motion aria-pressed="false" aria-label="Look around by moving your phone" title="Look around by moving your phone" hidden>${ICON.motion}</button>
          <button class="ibtn" type="button" data-full aria-label="Full screen" title="Full screen" hidden>${ICON.full}</button>
          <button class="ibtn" type="button" data-close aria-label="Leave the room tour">${ICON.x}</button>
        </div>
      </div>
      <p class="hall__load">Hanging the photographs…</p>
      <div class="hall__cta glass" data-cta>
        <p class="micro">The end of the hall</p>
        <h3>Shall we open the door?</h3>
        <p>An adviser who speaks your language will confirm the current quota position, the true all-in cost, and whether this residence suits what you described.</p>
        <div>
          <a class="btn btn--sm btn--primary" href="${esc(this.base)}contact.html">Enquire privately</a>
          ${this.href ? `<a class="btn btn--sm btn--onDark" href="${esc(this.href)}">Open the residence</a>` : `<button class="btn btn--sm btn--onDark" type="button" data-again>Walk it again</button>`}
        </div>
      </div>
      <div class="hall__bot">
        <div class="hall__cap"><p data-cap></p><b data-count></b></div>
        <div class="hall__dots" data-dots>${this.stations.map((s, k) => `<button type="button" ${s.kind === 'plan' ? 'data-plan' : ''} aria-label="${s.kind === 'photo' ? `Photograph ${k + 1}` : s.kind === 'plan' ? `Layout: ${esc(s.name)}` : 'The door'}"></button>`).join('')}</div>
        <div class="hall__nav">
          <button class="btn btn--sm btn--onDark hall__prev" type="button" data-prev aria-label="Back">${ICON.prev}<span>Back</span></button>
          <button class="btn btn--sm btn--primary hall__next" type="button" data-next><span>Walk on</span>${ICON.next}</button>
          <button class="btn btn--sm btn--onDark hall__zoom" type="button" data-zoom aria-label="View larger">${ICON.zoom}<span>View larger</span></button>
          <span class="hall__hint">${coarse ? 'Swipe to walk · tap a photograph to step up to it' : 'Scroll, swipe or use the arrow keys · Esc to leave'}</span>
        </div>
      </div>`;
    document.body.appendChild(el);
    this.prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    this.canvas = el.querySelector('canvas');
    this.topBar = el.querySelector('.hall__top'); this.botBar = el.querySelector('.hall__bot'); this.cta = el.querySelector('[data-cta]');
    this.count = this.shots.length + this.plans.length;
    if (document.fullscreenEnabled && el.requestFullscreen) el.querySelector('[data-full]').hidden = false;
    if (coarse && 'DeviceOrientationEvent' in window) el.querySelector('[data-motion]').hidden = false;
  }

  scene3d() {
    const canvas = this.canvas;
    let renderer = null;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch {}
    if (!renderer || !renderer.getContext()) {
      // no WebGL: fall back to the plain lightbox, which every browser can show
      this.close(); window.Anjia?.lightbox?.(this.shots, 0); return;
    }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#120d0a');
    scene.fog = new THREE.FogExp2(0x120d0a, 0.03);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
    // the floor: warm, dark, faintly lined; the mirrored frames read through it
    const floorTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#211812'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(255,214,166,.07)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 0.5); g.lineTo(256, 0.5); g.moveTo(0.5, 0); g.lineTo(0.5, 256); g.stroke();
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 200); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 600), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0.86 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.4, -260); scene.add(floor);
    const glow = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, 'rgba(255,214,166,.85)'); grd.addColorStop(.4, 'rgba(255,178,87,.22)'); grd.addColorStop(1, 'rgba(255,178,87,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.glowMat = new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 });
    const loader = new THREE.TextureLoader(); this.loader = loader;
    this.stations.forEach((s, k) => {
      if (s.kind === 'door') {
        const door = new THREE.Group();
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55, color: 0xffb257 }));
        halo.scale.set(11, 9, 1); halo.position.set(0, 0.6, -0.4);
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 6.2), new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false }));
        leaf.position.set(0, -0.3, 0);
        const jamb = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 6.8), new THREE.MeshBasicMaterial({ color: 0x3a2a1c }));
        jamb.position.set(0, -0.3, -0.05);
        door.add(jamb, leaf, halo);
        door.position.set(0, 0, -k * this.SP - 8); scene.add(door);
        s.obj = door; s.x = 0; s.z = -k * this.SP - 8; s.fw = 3.2; s.fh = 6.8; return;
      }
      const side = k % 2 ? 1 : -1;
      const g = new THREE.Group();
      const isPlan = s.kind === 'plan';
      const x = isPlan ? 0 : side * 6.6, z = -k * this.SP;
      g.position.set(x, isPlan ? -0.6 : 0.4, z);
      g.rotation.y = isPlan ? 0 : -side * 0.62;
      if (isPlan) g.rotation.x = -0.35;
      const mat = new THREE.MeshBasicMaterial({ color: 0x2a2018, transparent: true, opacity: 0 });
      const img = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: isPlan ? 0x3a2a1c : 0xf4e8d6 }));
      frame.position.z = -0.03;
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 }));
      mirror.visible = !isPlan;
      const pool = new THREE.Sprite(this.glowMat); pool.scale.set(14, 9, 1); pool.position.set(0, 4.2, -0.6);
      g.add(frame, img, mirror, pool);
      s.obj = g; s.img = img; s.frame = frame; s.mirror = mirror; s.x = x; s.z = z; s.side = side;
      const H = isPlan ? 5.2 : 6.2;
      const size = ar => {
        img.scale.set(H * ar, H, 1); frame.scale.set(H * ar + 0.36, H + 0.36, 1);
        mirror.scale.set(H * ar, -H, 1); mirror.position.y = -H - 0.02;
        s.fw = H * ar; s.fh = H;
      };
      size(1.5);
      loader.load(s.src, t => {
        if (!this.alive) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const ar = t.image.width / t.image.height;
        size(clamp(ar, 0.6, 2.4));
        mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
        mirror.material.map = t; mirror.material.needsUpdate = true;
        s.loaded = true; this.fadeIn(mat);
        if (this.stations[this.i] === s) this.go(this.i, false, true);   // refit to the true aspect
        this.loadedCount = (this.loadedCount || 0) + 1;
        if (this.loadedCount >= Math.min(2, this.count)) this.el.querySelector('.hall__load')?.setAttribute('data-gone', '');
      }, undefined, () => { s.failed = true; mat.color.set(0x3a2e24); mat.opacity = 1; });
      scene.add(g);
    });
    if (!reduced) {
      const n = 380, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 26; pos[i * 3 + 1] = (Math.random() - .5) * 12; pos[i * 3 + 2] = -Math.random() * this.stations.length * this.SP; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffc58f, size: 0.09, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
      scene.add(this.motes);
    }
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.cam = { x: 0, y: 0.4, z: 8, lx: 0, ly: 0, lz: -8 };
    this.target = { ...this.cam };
    this.ptr = { x: 0, y: 0 };
    this.fit(); this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(this.el);
  }

  fadeIn(mat) {
    if (reduced) { mat.opacity = 1; return; }
    const t0 = performance.now();
    const step = () => { if (!this.alive) return; const k = clamp((performance.now() - t0) / 700, 0, 1); mat.opacity = k; if (k < 1) requestAnimationFrame(step); };
    step();
  }

  fit() {
    if (!this.renderer) return;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.portrait = h > w;
    this.go(this.i, true, true);
  }

  /* ---------------------------------------------------------- controls */
  bind() {
    const el = this.el;
    el.querySelector('[data-close]').addEventListener('click', () => this.close());
    el.querySelector('[data-prev]').addEventListener('click', () => this.go(this.i - 1));
    el.querySelector('[data-next]').addEventListener('click', () => this.go(this.i + 1));
    el.querySelector('[data-zoom]').addEventListener('click', () => this.zoom());
    el.querySelector('[data-again]')?.addEventListener('click', () => this.go(0));
    el.querySelector('[data-play]').addEventListener('click', () => this.toggleAuto());
    el.querySelector('[data-full]').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {});
    });
    el.querySelector('[data-motion]').addEventListener('click', () => this.toggleMotion());
    el.querySelectorAll('[data-dots] button').forEach((b, k) => b.addEventListener('click', () => this.go(k)));
    this.onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); this.go(this.i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); this.go(this.i - 1); }
      else if (e.key === 'Home') this.go(0); else if (e.key === 'End') this.go(this.stations.length - 1);
      else if (e.key === 'Enter') this.zoom();
    };
    document.addEventListener('keydown', this.onKey);
    this.onVis = () => { if (document.hidden && this.auto) this.toggleAuto(false); };
    document.addEventListener('visibilitychange', this.onVis);
    let acc = 0, last = 0;
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const now = performance.now(); if (now - last < 520) return;
      acc += e.deltaY || e.deltaX;
      if (Math.abs(acc) > 34) { this.go(this.i + (acc > 0 ? 1 : -1)); acc = 0; last = now; }
    }, { passive: false });
    let t0 = null;
    this.canvas.addEventListener('pointerdown', e => { t0 = { x: e.clientX, y: e.clientY, t: performance.now() }; this.canvas.setPointerCapture?.(e.pointerId); });
    this.canvas.addEventListener('pointerup', e => {
      if (!t0) return; const dx = e.clientX - t0.x, dy = e.clientY - t0.y, dt = performance.now() - t0.t; t0 = null;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) { this.go(this.i + (dx < 0 ? 1 : -1)); return; }
      if (Math.abs(dy) > 42) { this.go(this.i + (dy < 0 ? 1 : -1)); return; }
      if (dt < 500 && Math.abs(dx) < 6 && Math.abs(dy) < 6) this.tap(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('pointermove', e => {
      if (this.motion) return;
      const r = this.canvas.getBoundingClientRect();
      this.ptr.x = ((e.clientX - r.left) / r.width - .5) * 2; this.ptr.y = ((e.clientY - r.top) / r.height - .5) * 2;
    });
    this.canvas.tabIndex = 0; this.canvas.focus({ preventScroll: true });
  }

  toggleAuto(on = !this.auto) {
    clearInterval(this.auto); this.auto = 0;
    const b = this.el.querySelector('[data-play]');
    if (on) {
      this.auto = setInterval(() => { if (this.i >= this.stations.length - 1) this.toggleAuto(false); else this.go(this.i + 1, false, true); }, 4600);
      if (this.i >= this.stations.length - 1) this.go(0, false, true);
    }
    b.setAttribute('aria-pressed', String(!!this.auto)); b.innerHTML = this.auto ? ICON.pause : ICON.play;
    b.setAttribute('aria-label', this.auto ? 'Pause the tour' : 'Play the tour');
  }

  toggleMotion() {
    const b = this.el.querySelector('[data-motion]');
    if (this.motion) { this.motion = false; removeEventListener('deviceorientation', this.onOrient); b.setAttribute('aria-pressed', 'false'); this.ptr.x = this.ptr.y = 0; return; }
    const ask = typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission() : Promise.resolve('granted');
    ask.then(r => {
      if (r !== 'granted' || !this.alive) return;
      this.motion = true; b.setAttribute('aria-pressed', 'true');
      this.onOrient = e => { this.ptr.x = clamp((e.gamma || 0) / 24, -1, 1); this.ptr.y = clamp(((e.beta || 0) - 42) / 28, -1, 1); };
      addEventListener('deviceorientation', this.onOrient);
    }).catch(() => {});
  }

  tap(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const objs = this.stations.filter(s => s.img).map(s => s.img);
    const hit = this.ray.intersectObjects(objs, false)[0];
    if (!hit) return;
    const k = this.stations.findIndex(s => s.img === hit.object);
    if (k === this.i) this.zoom(); else this.go(k);
  }

  zoom() {
    const s = this.stations[this.i];
    if (!s || s.kind === 'door') return;
    const A = window.Anjia;
    if (s.kind === 'photo') A?.lightbox?.(this.shots, s.i);
    else A?.lightbox?.(this.plans.map(p => p.src), s.i);
  }

  /* ---------------------------------------------------- fitting a frame */
  // The photograph must sit inside the band the bars leave free, on any screen.
  band(fh, fw, top, bot) {
    const W = this.el.clientWidth || innerWidth, H = this.el.clientHeight || innerHeight;
    const vfov = this.camera.fov * Math.PI / 180, aspect = W / Math.max(1, H);
    const tanV = Math.tan(vfov / 2), tanH = tanV * aspect;
    const bandH = Math.max(90, H - top - bot), bandC = top + bandH / 2;
    const distH = fh / (2 * tanV * (bandH / H) * 0.84);
    const distW = fw / (2 * tanH * (this.portrait ? 0.95 : 0.88));
    const dist = Math.max(distH, distW, 4);
    const dy = ((H / 2 - bandC) / H) * (2 * dist * tanV);   // the frame appears this much higher: look lower by it
    return { dist, dy };
  }

  go(k, instant, keepAuto) {
    k = clamp(k, 0, this.stations.length - 1);
    this.i = k;
    const s = this.stations[k], t = this.target;
    const topH = (this.topBar?.offsetHeight || 70) + 8, botH = (this.botBar?.offsetHeight || 150) + 8;
    if (s.kind === 'door') {
      const H = this.el.clientHeight || innerHeight;
      const ctaBottom = Math.max(H * 0.19, 176) + (this.cta?.offsetHeight || 220) + 10;
      const fit = this.band(s.fh, s.fw, topH, ctaBottom);
      const dist = clamp(fit.dist, 9, 12.5), dy = fit.dy * (dist / fit.dist);
      t.x = 0; t.y = 0.2; t.z = s.z + dist; t.lx = 0; t.ly = 0.2 - dy; t.lz = s.z;
    } else {
      const { dist, dy } = this.band(s.fh + 0.4, s.fw + 0.4, topH, botH);
      const cy = s.obj.position.y;
      const lean = s.kind === 'plan' ? 0 : (this.portrait ? 0.1 : 0.28) * (s.side || 0);   // toward the corridor, a little
      const n = Math.hypot(lean, 1);
      t.x = s.x - lean / n * dist; t.z = s.z + dist / n; t.y = cy + (s.kind === 'plan' ? 1.1 : 0.15);
      t.lx = s.x; t.ly = cy - dy; t.lz = s.z;
    }
    if (instant || reduced) Object.assign(this.cam, t);
    this.paintHud();
    if (this.auto && !keepAuto) this.toggleAuto(true);   // a manual step restarts the clock
  }

  // for the verification rig: where the current photograph sits on screen
  frameRect() {
    const s = this.stations[this.i]; if (!s?.img) return null;
    const W = this.el.clientWidth, H = this.el.clientHeight;
    const v = new THREE.Vector3(); let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const [x, y] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]) {
      v.set(x, y, 0); s.img.localToWorld(v); v.project(this.camera);
      const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
      l = Math.min(l, px); r = Math.max(r, px); t = Math.min(t, py); b = Math.max(b, py);
    }
    return { l, t, r, b, top: this.topBar.offsetHeight, bot: this.botBar.offsetHeight, W, H };
  }

  paintHud() {
    const s = this.stations[this.i], el = this.el;
    const cap = el.querySelector('[data-cap]'), count = el.querySelector('[data-count]');
    if (s.kind === 'door') { cap.textContent = 'The end of the hall.'; count.textContent = ''; }
    else if (s.kind === 'plan') { cap.textContent = `Layout — ${s.name}`; count.textContent = this.plans.length > 1 ? `${s.i + 1} of ${this.plans.length} layouts` : 'the layout'; }
    else { cap.textContent = s.i === 0 ? 'The residence, as photographed.' : 'Photograph'; count.textContent = `${s.i + 1} of ${this.shots.length}`; }
    el.querySelectorAll('[data-dots] button').forEach((b, k) => b.setAttribute('aria-current', String(k === this.i)));
    el.querySelector('[data-cta]').toggleAttribute('data-on', s.kind === 'door');
    el.querySelector('[data-next]').disabled = this.i >= this.stations.length - 1;
    el.querySelector('[data-prev]').disabled = this.i <= 0;
    el.querySelector('[data-zoom]').hidden = s.kind === 'door';
    const dot = el.querySelectorAll('[data-dots] button')[this.i];
    dot?.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------ the loop */
  loop() {
    if (!this.alive) return;
    requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const c = this.cam, t = this.target, k = reduced ? 1 : 1 - Math.pow(0.0025, dt);
    for (const key of ['x', 'y', 'z', 'lx', 'ly', 'lz']) c[key] += (t[key] - c[key]) * k;
    const amp = this.portrait ? 0.28 : 0.5;
    const px = reduced ? 0 : this.ptr.x * amp, py = reduced ? 0 : -this.ptr.y * amp * 0.6;
    this.camera.position.set(c.x + px, c.y + py, c.z);
    this.camera.lookAt(c.lx + px * 0.6, c.ly + py * 0.6, c.lz);
    const T = performance.now() / 1000;
    if (this.motes) {
      const a = this.motes.geometry.attributes.position, n = a.count;
      for (let i = 0; i < n; i++) { a.setY(i, a.getY(i) + Math.sin(T * 0.6 + i) * 0.0025); a.setX(i, a.getX(i) + Math.cos(T * 0.4 + i * 1.7) * 0.0018); }
      a.needsUpdate = true;
    }
    this.stations.forEach((s, i) => {
      if (!s.obj || s.kind === 'door') return;
      const near = clamp(1 - Math.abs(i - this.i) * 0.5, 0, 1);
      const focus = this.portrait ? 0.14 : 0.36;
      const targetRot = s.kind === 'plan' ? 0 : -s.side * (0.62 - (0.62 - focus) * near);
      s.obj.rotation.y += (targetRot - s.obj.rotation.y) * (reduced ? 1 : 0.06);
      // the photograph you are standing in front of breathes, very slowly
      const map = s.img?.material.map; if (!map) return;
      if (i === this.i && !reduced) { map.repeat.set(0.955, 0.955); map.offset.set(0.0225 + 0.02 * Math.sin(T * 0.11), 0.0225 + 0.02 * Math.cos(T * 0.09)); }
      else { map.repeat.set(1, 1); map.offset.set(0, 0); }
    });
    this.renderer.render(this.scene, this.camera);
  }

  close() {
    if (!this.alive) return;
    this.alive = false;
    clearInterval(this.auto);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.onOrient) removeEventListener('deviceorientation', this.onOrient);
    if (document.fullscreenElement === this.el) document.exitFullscreen?.().catch?.(() => {});
    this.ro?.disconnect();
    const finish = () => {
      this.el.remove();
      document.body.style.overflow = this.prevOverflow || '';
      this.scene?.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.map?.dispose?.(); m.dispose?.(); } });
      this.renderer?.dispose();
      this.trigger?.focus?.();
      if (current === this) current = null;
    };
    if (reduced || !this.renderer) finish(); else { this.el.setAttribute('data-leaving', ''); setTimeout(finish, 340); }
  }
}
