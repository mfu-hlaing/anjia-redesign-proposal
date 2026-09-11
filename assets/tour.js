/* ===========================================================================
   ANJIA — walk through the photographs.

   A residence's own photographs hung along a warm, dark hall; you walk from
   one to the next. The layout drawings wait at the end, and then the door.
   No geometry is invented: these are the photographs, at their true aspect.
   ======================================================================== */
import * as THREE from './vendor/three.module.min.js';

const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

let current = null;

export function openTour(opts) {
  if (current) current.close();
  current = new Hall(opts);
  return current;
}

class Hall {
  constructor({ title, subtitle = '', shots = [], plans = [], base = '', href = '', id = '', trigger = null }) {
    this.title = title; this.shots = shots; this.plans = plans; this.base = base; this.href = href; this.id = id; this.trigger = trigger;
    this.stations = [...shots.map((src, i) => ({ kind: 'photo', src, i })), ...plans.map((p, i) => ({ kind: 'plan', src: p.src, name: p.name, i })), { kind: 'door' }];
    this.i = 0; this.alive = true; this.tw = null;
    this.build(); this.scene3d(); this.bind();
    this.go(0, true);
    this.loop = this.loop.bind(this); this.timer = new THREE.Timer(); this.loop();
  }

  build() {
    const n = this.shots.length, np = this.plans.length;
    const el = this.el = document.createElement('div');
    el.className = 'hall'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', `Walk through ${this.title}`);
    el.innerHTML = `
      <canvas></canvas>
      <div class="hall__top">
        <div class="hall__title"><p class="micro">${esc(this.title.length > 40 ? 'Walk through' : 'Walk through the photographs')}</p><h2>${esc(this.title)}</h2></div>
        <button class="ibtn" type="button" data-close aria-label="Leave the walk-through">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
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
          <button class="btn btn--sm btn--onDark" type="button" data-prev>‹ Back</button>
          <button class="btn btn--sm btn--primary" type="button" data-next>Walk on ›</button>
          <button class="btn btn--sm btn--onDark" type="button" data-zoom>View larger</button>
          <span class="hall__hint">Scroll, swipe or use the arrow keys · Esc to leave</span>
        </div>
      </div>`;
    document.body.appendChild(el);
    this.prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    this.canvas = el.querySelector('canvas');
    this.count = n + np;
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
    const camera = this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
    this.SP = 15; // metres between photographs
    this.frames = [];
    // the floor: warm, dark, faintly lined, mirrored frames read through it
    const floorTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#211812'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(255,214,166,.07)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 0.5); g.lineTo(256, 0.5); g.moveTo(0.5, 0); g.lineTo(0.5, 256); g.stroke();
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 200); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 600), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0.86 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.4, -260); scene.add(floor);
    // light pools, dust
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
        s.obj = door; s.x = 0; s.z = -k * this.SP - 8; return;
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
      frame.position.z = -0.03; img.position.z = 0;
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 }));
      mirror.position.z = 0; mirror.scale.y = -1; mirror.visible = !isPlan;
      const pool = new THREE.Sprite(this.glowMat); pool.scale.set(14, 9, 1); pool.position.set(0, 4.2, -0.6);
      g.add(frame, img, mirror, pool);
      s.obj = g; s.img = img; s.frame = frame; s.mirror = mirror; s.x = x; s.z = z; s.side = side;
      const H = isPlan ? 5.2 : 6.2;
      const size = (ar) => { img.scale.set(H * ar, H, 1); frame.scale.set(H * ar + 0.36, H + 0.36, 1); mirror.scale.set(H * ar, -H, 1); mirror.position.y = -H - 0.02 - (isPlan ? 0 : 0); };
      size(1.5);
      loader.load(s.src, t => {
        if (!this.alive) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const ar = t.image.width / t.image.height;
        size(clamp(ar, 0.6, 2.4));
        mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
        mirror.material.map = t; mirror.material.needsUpdate = true;
        s.loaded = true; this.fadeIn(mat);
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
    this.cam = { x: 0, y: 0.4, z: 8, lx: 0, ly: 0, lz: -8 };   // where the camera is and looks
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
    const w = this.el.clientWidth, h = this.el.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.portrait = h > w;
    this.go(this.i, true);
  }

  bind() {
    const el = this.el;
    el.querySelector('[data-close]').addEventListener('click', () => this.close());
    el.querySelector('[data-prev]').addEventListener('click', () => this.go(this.i - 1));
    el.querySelector('[data-next]').addEventListener('click', () => this.go(this.i + 1));
    el.querySelector('[data-zoom]').addEventListener('click', () => this.zoom());
    el.querySelector('[data-again]')?.addEventListener('click', () => this.go(0));
    el.querySelectorAll('[data-dots] button').forEach((b, k) => b.addEventListener('click', () => this.go(k)));
    this.onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); this.go(this.i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); this.go(this.i - 1); }
      else if (e.key === 'Home') this.go(0); else if (e.key === 'End') this.go(this.stations.length - 1);
      else if (e.key === 'Enter') this.zoom();
    };
    document.addEventListener('keydown', this.onKey);
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
      const r = this.canvas.getBoundingClientRect();
      this.ptr.x = ((e.clientX - r.left) / r.width - .5) * 2; this.ptr.y = ((e.clientY - r.top) / r.height - .5) * 2;
    });
    this.canvas.tabIndex = 0; this.canvas.focus({ preventScroll: true });
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

  go(k, instant) {
    k = clamp(k, 0, this.stations.length - 1);
    this.i = k;
    const s = this.stations[k];
    const back = this.portrait ? 11.5 : 8.6;
    const t = this.target;
    if (s.kind === 'door') { t.x = 0; t.y = 0.3; t.z = s.z + 14; t.lx = 0; t.ly = 0.9; t.lz = s.z; }
    else if (s.kind === 'plan') { t.x = 0; t.y = 1.8; t.z = s.z + back * 0.9; t.lx = 0; t.ly = -0.6; t.lz = s.z; }
    else { t.x = s.x * 0.12; t.y = 0.5; t.z = s.z + back; t.lx = s.x * 0.86; t.ly = 0.3; t.lz = s.z; }
    if (instant || reduced) Object.assign(this.cam, t);
    this.paintHud();
  }

  paintHud() {
    const s = this.stations[this.i], el = this.el;
    const cap = el.querySelector('[data-cap]'), count = el.querySelector('[data-count]');
    if (s.kind === 'door') { cap.textContent = 'The end of the hall.'; count.textContent = ''; }
    else if (s.kind === 'plan') { cap.textContent = `Layout — ${s.name}`; count.textContent = `${this.plans.length > 1 ? `${s.i + 1} of ${this.plans.length} layouts` : 'the layout'}`; }
    else { cap.textContent = s.i === 0 ? 'The residence, as photographed.' : 'Photograph'; count.textContent = `${s.i + 1} of ${this.shots.length}`; }
    el.querySelectorAll('[data-dots] button').forEach((b, k) => b.setAttribute('aria-current', String(k === this.i)));
    el.querySelector('[data-cta]').toggleAttribute('data-on', s.kind === 'door');
    el.querySelector('[data-next]').disabled = this.i >= this.stations.length - 1;
    el.querySelector('[data-prev]').disabled = this.i <= 0;
    el.querySelector('[data-zoom]').hidden = s.kind === 'door';
  }

  loop() {
    if (!this.alive) return;
    requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const c = this.cam, t = this.target, k = reduced ? 1 : 1 - Math.pow(0.0025, dt);
    for (const key of ['x', 'y', 'z', 'lx', 'ly', 'lz']) c[key] += (t[key] - c[key]) * k;
    const px = reduced ? 0 : this.ptr.x * 0.5, py = reduced ? 0 : -this.ptr.y * 0.3;
    this.camera.position.set(c.x + px, c.y + py, c.z);
    this.camera.lookAt(c.lx + px * 0.6, c.ly + py * 0.6, c.lz);
    if (this.motes) {
      const a = this.motes.geometry.attributes.position, n = a.count, T = performance.now() / 1000;
      for (let i = 0; i < n; i++) { a.setY(i, a.getY(i) + Math.sin(T * 0.6 + i) * 0.0025); a.setX(i, a.getX(i) + Math.cos(T * 0.4 + i * 1.7) * 0.0018); }
      a.needsUpdate = true;
    }
    // frames breathe toward the visitor as they arrive
    this.stations.forEach((s, i) => {
      if (!s.obj || s.kind === 'door') return;
      const near = clamp(1 - Math.abs(i - this.i) * 0.5, 0, 1);
      const targetRot = s.kind === 'plan' ? 0 : -s.side * (0.62 - 0.16 * near);
      s.obj.rotation.y += (targetRot - s.obj.rotation.y) * (reduced ? 1 : 0.06);
    });
    this.renderer.render(this.scene, this.camera);
  }

  close() {
    if (!this.alive) return;
    this.alive = false;
    document.removeEventListener('keydown', this.onKey);
    this.ro?.disconnect();
    const finish = () => {
      this.el.remove();
      document.body.style.overflow = this.prevOverflow || '';
      this.scene?.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.map?.dispose?.(); m.dispose?.(); } });
      this.renderer?.dispose();
      this.trigger?.focus?.();
      if (current === this) current = null;
    };
    if (reduced) finish(); else { this.el.setAttribute('data-leaving', ''); setTimeout(finish, 340); }
  }
}
