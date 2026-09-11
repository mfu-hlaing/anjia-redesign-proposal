/* ===========================================================================
   ANJIA — the coast, in three dimensions.

   Every residence in the collection stands where its own coordinates put it,
   as a symbolic building whose height comes from its recorded floor count.
   The shoreline is drawn by hand for orientation and is approximate; nothing
   else on the ground is claimed. Runs on three.js (assets/vendor, MIT).
   ======================================================================== */
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const A = window.Anjia || {};
const BASE = document.body.dataset.base || '';
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const coarse = matchMedia('(pointer:coarse)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ------------------------------------------------------------- geography */
const LAT0 = 12.915, LNG0 = 100.88;
const M_DEG = 111320, KX = M_DEG * Math.cos(LAT0 * Math.PI / 180);
const U = 10;            // one scene unit is ten metres
const EXAG = 2.2;        // heights are exaggerated so a tower reads across the bay
const FLOOR_M = 3.1;     // metres per storey, as a rule of thumb
const FLOOR_U = FLOOR_M * EXAG / U;
const HALF = { x: 1500, z: 1400 };
const toXZ = (lat, lng) => [(lng - LNG0) * KX / U, -(lat - LAT0) * M_DEG / U];

/* The shoreline, north to south, fitted to where the beachfront residences in
   the collection actually stand. Approximate — drawn for orientation only. */
const COAST = [
  [13.03, 100.925], [13.005, 100.906], [12.99, 100.894], [12.98, 100.8885], [12.9745, 100.8862],
  [12.971, 100.8846], [12.968, 100.8840], [12.965, 100.8837], [12.9615, 100.8853], [12.958, 100.8848],
  [12.9548, 100.8828], [12.950, 100.8818], [12.944, 100.8808], [12.938, 100.8795], [12.933, 100.8778],
  [12.929, 100.8758], [12.9255, 100.8722], [12.9228, 100.8688], [12.9212, 100.8664], [12.9175, 100.8618],
  [12.9135, 100.8572], [12.9095, 100.8553], [12.9058, 100.8556], [12.9040, 100.8600], [12.9025, 100.8645],
  [12.8992, 100.8683], [12.8955, 100.8718], [12.8918, 100.8743], [12.8826, 100.8807], [12.8735, 100.8870],
  [12.8646, 100.8930], [12.8555, 100.8990], [12.8465, 100.9045], [12.837, 100.910], [12.825, 100.9165],
  [12.81, 100.923], [12.795, 100.929],
].map(([la, ln]) => toXZ(la, ln));
const ISLANDS = [
  [[12.947, 100.781], [12.937, 100.795], [12.919, 100.792], [12.905, 100.783], [12.907, 100.770], [12.925, 100.764], [12.941, 100.769]],
  [[12.943, 100.801], [12.940, 100.806], [12.937, 100.803], [12.939, 100.799]],
  [[12.938, 100.812], [12.936, 100.815], [12.934, 100.812], [12.936, 100.810]],
].map(poly => poly.map(([la, ln]) => toXZ(la, ln)));
const HILLS = [
  { p: toXZ(12.917, 100.8635), r: 95, h: 11 },   // Pratumnak hill
  { p: toXZ(12.93, 100.962), r: 520, h: 7 },     // the rise east of the city
  { p: toXZ(12.835, 100.955), r: 480, h: 9 },    // south-east hills
  { p: toXZ(13.0, 100.94), r: 380, h: 5 },
];
/* Several records carry the same point on Thepprasit Road — Anjia's own office —
   rather than the residence. They are shown, and said to be approximate. */
const OFFICE = toXZ(12.9081, 100.8817);

/* --------------------------------------------------------------- listings */
const L = (window.LISTINGS || []).filter(r => r.lat && r.lng);
const placed = [], unplaced = [];
for (const r of L) {
  const [x, z] = toXZ(r.lat, r.lng);
  if (Math.abs(x) > HALF.x - 60 || Math.abs(z) > HALF.z - 60) { unplaced.push(r); continue; }
  placed.push({ r, x, z, office: Math.hypot(x - OFFICE[0], z - OFFICE[1]) < 12 });
}
// one building per point: resale units in the same tower share a building
const clusters = [];
{
  const byKey = new Map();
  for (const p of placed) {
    const key = `${p.x.toFixed(0)}|${p.z.toFixed(0)}`;
    let c = byKey.get(key);
    if (!c) {
      // also merge with any existing cluster within 15 m
      c = clusters.find(k => Math.hypot(k.x - p.x, k.z - p.z) < 1.5);
      if (!c) { c = { x: p.x, z: p.z, listings: [], office: p.office }; clusters.push(c); }
      byKey.set(key, c);
    }
    c.listings.push(p.r);
  }
}
const kindOf = r => r.type === 'Land' ? 'land' : r.type === 'Condominium' ? 'condo'
  : r.type === 'Villa' ? 'villa' : r.type === 'Townhouse' ? 'town' : 'house';
const floorsOf = r => {
  if (r.kind === 'project') { const f = +r.floors; return f > 0 && f < 90 ? f : (r.type === 'Condominium' ? 24 : 2); }
  const m = /^(\d+)\s*\/\s*(\d+)/.exec(String(r.floors || ''));
  if (m) return clamp(+m[2], 2, 80);
  const f = parseInt(r.floors, 10);
  return f > 0 && f < 90 ? f : (r.type === 'Condominium' ? 8 : 2);
};
const isSig = r => r.tenure === 'Freehold' || r.tenure === 'Foreign quota';
for (const c of clusters) {
  const lead = c.listings.find(r => r.kind === 'project') || c.listings[0];
  c.lead = lead;
  c.kind = kindOf(lead);
  c.floors = Math.max(...c.listings.map(floorsOf));
  const fp = { land: 6.2, condo: 5.4, villa: 3.0, town: 2.1, house: 2.5 }[c.kind];
  c.w = fp * (0.9 + 0.25 * hash(c.x * 3.1 + c.z)); c.d = fp * (0.9 + 0.25 * hash(c.z * 1.7 - c.x));
  c.h = c.kind === 'land' ? 0.35 : Math.max(2.6, c.floors * FLOOR_U);
  if (c.office) { c.kind = 'office'; c.h = 1.4; c.w = 6.4; c.d = 4.2; c.rot = 0; }
  c.rot = c.kind === 'condo' ? (hash(c.x + c.z * 7) - .5) * .9 : (hash(c.x * 5 - c.z) - .5) * 1.4;
  c.sig = c.listings.some(isSig);
  c.lease = c.listings.every(r => r.tenure === 'Leasehold');
  // a resale unit records "floor / of" — mark the floor
  const band = c.listings.map(r => /^(\d+)\s*\/\s*(\d+)/.exec(String(r.floors || ''))).find(Boolean);
  c.band = band && !c.office ? clamp(+band[1], 1, c.floors) * FLOOR_U - FLOOR_U / 2 : -1;
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
const areas = {};
for (const c of clusters) for (const r of c.listings) {
  const a = areas[r.area] || (areas[r.area] = { name: r.area, n: 0, sx: 0, sz: 0, xs: [], zs: [] });
  a.n++; a.sx += c.x; a.sz += c.z; a.xs.push(c.x); a.zs.push(c.z);
}
for (const a of Object.values(areas)) {
  a.x = a.sx / a.n; a.z = a.sz / a.n;
  a.radius = Math.max(40, ...a.xs.map((x, i) => Math.hypot(x - a.x, a.zs[i] - a.z)));
  // a robust centre: the median keeps a far-flung villa from dragging the label away
  const med = arr => { const s = [...arr].sort((p, q) => p - q); return s[s.length >> 1]; };
  a.x = med(a.xs); a.z = med(a.zs);
}
const AREA_ORDER = Object.values(areas).sort((p, q) => p.z - q.z); // north first

/* ----------------------------------------------------------- the terrain */
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
const LAND = [[COAST[0][0], -HALF.z - 400], ...COAST, [COAST[COAST.length - 1][0], HALF.z + 400], [HALF.x + 400, HALF.z + 400], [HALF.x + 400, -HALF.z - 400]];
function coastInfo(x, z) {
  // distance to the shoreline and which side; positive = land
  let best = 1e9, side = 1, qx = 0, qz = 0;
  for (let i = 0; i < COAST.length - 1; i++) {
    const [ax, az] = COAST[i], [bx, bz] = COAST[i + 1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
    const px = ax + t * dx, pz = az + t * dz, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; qx = px; qz = pz; side = Math.sign(dx * (z - az) - dz * (x - ax)) || 1; }
  }
  // the polyline runs north to south; east of it is land
  return { d: best, land: side < 0, qx, qz };
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => hash(a * 15.73 + b * 91.17);
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
}
function landHeight(x, z) {
  let h = 0.5 + 1.1 * vnoise(x * 0.006, z * 0.006) + 0.45 * vnoise(x * 0.03, z * 0.03);
  for (const hill of HILLS) {
    const d = Math.hypot(x - hill.p[0], z - hill.p[1]) / hill.r;
    if (d < 1) h += hill.h * Math.pow(1 - d * d, 1.6);
  }
  return h;
}
function isLand(x, z) {
  if (pointInPoly(x, z, LAND)) return true;
  return ISLANDS.some(p => pointInPoly(x, z, p));
}
function groundAt(x, z) {
  const c = coastInfo(x, z);
  const inland = isLand(x, z) ? clamp(c.d / 14, 0, 1) : 0;
  return lerp(-3, landHeight(x, z), inland);
}
// any residence recorded a few dozen metres out to sea is set back on the beach
for (const c of clusters) {
  if (!isLand(c.x, c.z)) {
    const k = coastInfo(c.x, c.z);
    const nx = c.x - k.qx, nz = c.z - k.qz, n = Math.hypot(nx, nz) || 1;
    c.x = k.qx - nx / n * 9; c.z = k.qz - nz / n * 9; c.snapped = true;
  }
  c.y = Math.max(0.4, groundAt(c.x, c.z));
}

/* ------------------------------------------------------------ the stage */
const stage = $('#stage'), canvas = $('#coastCanvas');
if (!stage || !canvas) throw new Error('no stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (e) { renderer = null; }
if (!renderer || !renderer.getContext()) {
  $('#veil')?.setAttribute('data-gone', '');
  const fb = $('#fallback'); if (fb) fb.hidden = false;
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75));
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8dccb, 1200, 6500);
const camera = new THREE.PerspectiveCamera(48, 1, 2, 12000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.screenSpacePanning = false;
controls.minDistance = 26; controls.maxDistance = 2700;
controls.maxPolarAngle = Math.PI * 0.472; controls.minPolarAngle = 0.12;
controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.9;
controls.keyPanSpeed = 22;
canvas.tabIndex = 0;
controls.listenToKeyEvents(canvas);

const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
const hemi = new THREE.HemisphereLight(0xb8c8de, 0x6e5638, 1.0);
scene.add(sun, sun.target, hemi);

/* sky */
const skyUniforms = {
  uZenith: { value: new THREE.Color('#6ea0d6') }, uHorizon: { value: new THREE.Color('#e9dccb') },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color('#fff1dc') },
  uSunVis: { value: 1 }, uStars: { value: 0 },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(5600, 40, 24), new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 uZenith, uHorizon, uSunDir, uSunColor; uniform float uSunVis, uStars; varying vec3 vDir;
    float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
    void main(){
      vec3 d = normalize(vDir);
      float up = clamp(d.y, 0.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(up, 0.5));
      float s = max(dot(d, uSunDir), 0.0);
      col += uSunColor * (pow(s, 40.0) * 1.1 + pow(s, 5.0) * 0.16) * uSunVis;
      if (uStars > 0.0) {
        vec3 p = floor(d * 300.0);
        float r = h3(p);
        float star = step(0.9962, r) * smoothstep(0.02, 0.3, d.y) * uStars;
        col += star * (0.45 + 0.55 * h3(p + 2.3));
      }
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -10;
scene.add(sky);

/* the sun, as a soft disc */
function radialTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(0.35, outer); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,255,255,1)', 'rgba(255,220,170,.55)'),
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
sunSprite.scale.set(560, 560, 1); scene.add(sunSprite);

/* the ground */
const maskW = 1024, maskH = Math.round(1024 * HALF.z / HALF.x);
const shoreTex = (() => {
  const c = document.createElement('canvas'); c.width = maskW; c.height = maskH;
  const g = c.getContext('2d');
  const X = x => (x + HALF.x) / (2 * HALF.x) * maskW, Z = z => (z + HALF.z) / (2 * HALF.z) * maskH;
  g.fillStyle = '#000'; g.fillRect(0, 0, maskW, maskH);
  const trace = poly => { g.beginPath(); poly.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.closePath(); };
  // shallow water: a soft band along every shore, drawn as widening strokes
  g.lineJoin = 'round'; g.lineCap = 'round';
  [[40, 0.18], [26, 0.36], [14, 0.6], [7, 0.82], [3.2, 1]].forEach(([w, a]) => {
    const v = Math.round(a * 255); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = w;
    trace(LAND); g.stroke(); ISLANDS.forEach(p => { trace(p); g.stroke(); });
  });
  g.fillStyle = '#fff'; trace(LAND); g.fill(); ISLANDS.forEach(p => { trace(p); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
})();

const terrain = (() => {
  const segX = 232, segZ = Math.round(232 * HALF.z / HALF.x);
  const geo = new THREE.PlaneGeometry(2 * HALF.x, 2 * HALF.z, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
  const cSand = new THREE.Color('#ecd9b5'), cField = new THREE.Color('#bdb287'), cField2 = new THREE.Color('#a69b70'),
        cHill = new THREE.Color('#9a7f56'), cUrban = new THREE.Color('#d9cdb0'), cFloor = new THREE.Color('#1c4351'), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const info = coastInfo(x, z), land = isLand(x, z);
    const inland = land ? clamp(info.d / 14, 0, 1) : 0;
    let y = lerp(-3, landHeight(x, z), inland);
    pos.setY(i, y);
    if (!land && info.d > 14) { tmp.copy(cFloor); }
    else if (inland < 1 || y < 0.9) { tmp.copy(cSand).lerp(cField, clamp((y - 0.4) * 1.2, 0, 1) * inland); }
    else {
      const v = vnoise(x * 0.05, z * 0.05);
      tmp.copy(cField).lerp(cField2, v);
      if (y > 3.5) tmp.lerp(cHill, clamp((y - 3.5) / 8, 0, 1));
      // the built city reads a shade lighter around the residences
      let urban = 0;
      for (const c of clusters) { const d = Math.hypot(c.x - x, c.z - z); if (d < 110) urban += (1 - d / 110) * 0.55; }
      if (urban) tmp.lerp(cUrban, clamp(urban, 0, 0.8));
    }
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = false;
  return m;
})();
scene.add(terrain);

/* the sea */
const seaUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
  uTime: { value: 0 }, uDeep: { value: new THREE.Color('#1f6a82') }, uShallow: { value: new THREE.Color('#6ec4bd') },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color('#fff1dc') }, uGlint: { value: 0.9 },
  uSky: { value: new THREE.Color('#6ea0d6') }, uShore: { value: shoreTex }, uHalf: { value: new THREE.Vector2(HALF.x, HALF.z) },
  uCam: { value: new THREE.Vector3() },
}]);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(HALF.x * 8, HALF.z * 8), new THREE.ShaderMaterial({
  uniforms: seaUniforms, fog: true,
  vertexShader: `
    #include <fog_pars_vertex>
    varying vec3 vW;
    void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz;
      vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `
    #include <fog_pars_fragment>
    uniform float uTime, uGlint; uniform vec3 uDeep, uShallow, uSunDir, uSunColor, uSky, uCam; uniform sampler2D uShore; uniform vec2 uHalf;
    varying vec3 vW;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = (vW.xz + uHalf) / (2.0 * uHalf);
      float shore = (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? 0.0 : texture2D(uShore, uv).r;
      float t = uTime;
      vec2 p = vW.xz;
      float a1 = p.x*0.17 + t*0.9, a2 = p.y*0.13 - t*0.7, a3 = (p.x+p.y)*0.05 + t*0.45, a4 = (p.x - p.y*0.6)*0.31 + t*1.3;
      float dx = cos(a1)*0.17 + cos(a3)*0.05 + cos(a4)*0.31*0.35;
      float dz = cos(a2)*0.13 + cos(a3)*0.05 - cos(a4)*0.19*0.35;
      vec3 n = normalize(vec3(-dx*0.9, 1.0, -dz*0.9));
      vec3 V = normalize(uCam - vW);
      vec3 H = normalize(V + uSunDir);
      float spec = pow(max(dot(n, H), 0.0), 220.0) * uGlint;
      float fres = pow(1.0 - max(dot(n, V), 0.0), 3.5);
      float near = smoothstep(1100.0, 260.0, distance(uCam, vW));
      float sparkle = step(0.986, h2(floor(p*0.7) + floor(t*2.0)*0.37)) * uGlint * 0.35 * smoothstep(0.0, 0.2, max(dot(n,H),0.0)) * near;
      vec3 col = mix(uDeep, uShallow, smoothstep(0.0, 0.9, shore));
      col = mix(col, uSky, fres * 0.55);
      col += uSunColor * (spec * 1.3 + sparkle);
      float foam = smoothstep(0.86, 0.99, shore) * (0.62 + 0.38 * sin(p.x*0.45 + t*1.1) * sin(p.y*0.35 - t*0.8));
      col = mix(col, vec3(0.97,0.95,0.9), foam * (0.18 + 0.3 * near));
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
      #include <colorspace_fragment>
    }`,
}));
sea.rotation.x = -Math.PI / 2; sea.position.y = 0; sea.renderOrder = -5;
scene.add(sea);

/* the buildings */
const N = clusters.length;
const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.translate(0, 0.5, 0);
const bodyU = {
  uNight: { value: 0 }, uWinLit: { value: new THREE.Color('#ffb257') }, uFloorH: { value: FLOOR_U },
  uPulse: { value: 0 }, uDim: { value: new THREE.Color('#5a4a3c') },
};
const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3a2d22 });
bodyMat.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, bodyU);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      attribute float aState; attribute float aBand; attribute float aSeed;
      varying vec3 vLocal; varying vec3 vScl; varying float vState; varying float vBand; varying float vSeed; varying float vNy;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vLocal = position; vNy = normal.y; vState = aState; vBand = aBand; vSeed = aSeed;
      #ifdef USE_INSTANCING
        vScl = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      #else
        vScl = vec3(1.0);
      #endif`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uNight, uFloorH, uPulse; uniform vec3 uWinLit, uDim;
      varying vec3 vLocal; varying vec3 vScl; varying float vState; varying float vBand; varying float vSeed; varying float vNy;
      float hash21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float wall = 1.0 - step(0.5, abs(vNy));
      float yU = vLocal.y * vScl.y;
      float along = vLocal.x * vScl.x + vLocal.z * vScl.z;
      float floors = yU / uFloorH;
      float cols = along / (uFloorH * 0.95);
      vec2 cell = vec2(fract(floors), fract(cols));
      float inWin = step(0.24, cell.x) * (1.0 - step(0.76, cell.x)) * step(0.2, cell.y) * (1.0 - step(0.8, cell.y));
      float tall = step(1.5, vScl.y / uFloorH);
      float seed = hash21(vec2(floor(floors), floor(cols)) + vSeed * 17.3);
      float lit = uNight * step(0.42, seed) * inWin * wall * tall;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82, inWin * wall * tall * (1.0 - uNight * 0.6));
      float band = 0.0;
      if (vBand >= 0.0) band = wall * (1.0 - step(uFloorH * 0.5, abs(yU - vBand)));
      if (vState > 1.5 && vState < 2.5) { diffuseColor.rgb = mix(diffuseColor.rgb, uDim, 0.72); lit *= 0.12; band *= 0.2; }
      if (vState > 0.5 && vState < 1.5) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.56, 0.14), 0.32); }
      if (vState > 2.5) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.66), 0.35); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += uWinLit * lit * 1.5;
      totalEmissiveRadiance += vec3(1.0, 0.5, 0.06) * band * (0.85 + 0.6 * uPulse);
      if (vState > 0.5 && vState < 1.5) totalEmissiveRadiance += vec3(0.95, 0.45, 0.07) * (0.22 + 0.22 * uPulse);
      if (vState > 2.5) totalEmissiveRadiance += vec3(0.55, 0.33, 0.1) * 0.3;`);
};
const bodies = new THREE.InstancedMesh(unitBox, bodyMat, N);
const aState = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
const aBand = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
aState.setUsage(THREE.DynamicDrawUsage);
bodies.geometry = unitBox.clone();
bodies.geometry.setAttribute('aState', aState);
bodies.geometry.setAttribute('aBand', aBand);
bodies.geometry.setAttribute('aSeed', aSeed);
const roofMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const roofs = new THREE.InstancedMesh(unitBox, roofMat, N);
const shadowGeo = new THREE.CircleGeometry(0.5, 28); shadowGeo.rotateX(-Math.PI / 2);
const shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.3, depthWrite: false }), N);
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
const ROOF = { sig: new THREE.Color('#fe7d05'), thai: new THREE.Color('#d9c6a8'), lease: new THREE.Color('#7a5a3a'), land: new THREE.Color('#caa97a'), office: new THREE.Color('#9a8a78') };
const BODY = [new THREE.Color('#f4e8d6'), new THREE.Color('#efe1cb'), new THREE.Color('#f7eee0'), new THREE.Color('#e9dcc6')];
const tmpC = new THREE.Color();
clusters.forEach((c, i) => {
  Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.rot);
  M.compose(P.set(c.x, c.y - 0.25, c.z), Q, S.set(c.w, c.h, c.d));
  bodies.setMatrixAt(i, M);
  bodies.setColorAt(i, tmpC.copy(BODY[i % BODY.length]).multiplyScalar(0.94 + 0.08 * hash(i * 3.3)));
  const capH = c.kind === 'land' ? 0.12 : c.kind === 'condo' ? 0.42 : 0.5;
  M.compose(P.set(c.x, c.y - 0.25 + c.h, c.z), Q, S.set(c.w * 1.04, capH, c.d * 1.04));
  roofs.setMatrixAt(i, M);
  roofs.setColorAt(i, c.kind === 'office' ? ROOF.office : c.kind === 'land' ? ROOF.land : c.lease ? ROOF.lease : c.sig ? ROOF.sig : ROOF.thai);
  M.compose(P.set(c.x, c.y - 0.2, c.z), Q, S.set(Math.max(c.w, c.d) * 2.1, 1, Math.max(c.w, c.d) * 2.1));
  shadows.setMatrixAt(i, M);
  aBand.setX(i, c.band); aSeed.setX(i, hash(i * 9.7 + 1.3)); aState.setX(i, 0);
});
bodies.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = shadows.instanceMatrix.needsUpdate = true;
bodies.instanceColor.needsUpdate = roofs.instanceColor.needsUpdate = true;
scene.add(shadows, bodies, roofs);

/* selection: a ring on the ground, a beam, and the photograph in the world */
const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 56), new THREE.MeshBasicMaterial({ color: 0xfe7d05, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb257, transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
beam.visible = false; scene.add(beam);
const photo = new THREE.Group();
const photoFrame = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.11), new THREE.MeshBasicMaterial({ color: 0xfbf6ef, transparent: true, opacity: .96, depthWrite: false }));
const photoImg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
photoImg.position.set(0, 0.015, 0.02); photoFrame.position.z = 0;
photo.add(photoFrame, photoImg); photo.visible = false; photo.renderOrder = 20; scene.add(photo);
const texLoader = new THREE.TextureLoader(); const texCache = new Map();
function loadTex(url) {
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise(res => texLoader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
  texCache.set(url, p); return p;
}

/* area labels */
const labels = [];
function labelSprite(text, sub) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 220;
  const g = c.getContext('2d'); g.textAlign = 'center';
  g.font = '400 66px Fraunces, Georgia, serif';
  const tw = Math.max(g.measureText(text).width, 240) + 84;
  g.fillStyle = 'rgba(24,17,12,.58)';
  g.beginPath(); g.roundRect((640 - tw) / 2, 28, tw, 158, 79); g.fill();
  g.fillStyle = '#fbf6ef'; g.fillText(text, 320, 104);
  g.fillStyle = '#ffc58f'; g.font = '300 32px "IBM Plex Sans Thai", "IBM Plex Sans", sans-serif';
  const s = sub.toUpperCase().split('').join(String.fromCharCode(8202));
  g.fillText(s, 320, 158);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, fog: false }));
  sp.renderOrder = 30; return sp;
}
async function buildLabels() {
  try { await Promise.all([document.fonts.load('400 66px Fraunces'), document.fonts.load('300 30px "IBM Plex Sans Thai"')]); } catch {}
  labels.forEach(l => { scene.remove(l.sprite); l.sprite.material.map.dispose(); l.sprite.material.dispose(); });
  labels.length = 0;
  for (const a of AREA_ORDER) {
    const sp = labelSprite(a.name, `${a.n} residence${a.n === 1 ? '' : 's'}`);
    sp.position.set(a.x, Math.max(2, groundAt(a.x, a.z)) + 34, a.z);
    scene.add(sp); labels.push({ sprite: sp, area: a });
  }
}
buildLabels();

/* ------------------------------------------------------- time of day */
const KEYS = [
  { e: -0.45, zen: '#07070f', hor: '#1b140f', sun: '#3a2a1f', sunI: 0.0, hS: '#2a2438', hG: '#17100b', hI: 0.42, fog: '#110c09', deep: '#06131a', shal: '#0d2731', sky: '#131a2a', win: 1, stars: 1, glint: 0.2, exp: 0.55 },
  { e: -0.12, zen: '#1a1a33', hor: '#63382a', sun: '#c25d2b', sunI: 0.35, hS: '#3d3454', hG: '#2a1b10', hI: 0.55, fog: '#2a1911', deep: '#0b2330', shal: '#1a4652', sky: '#2c2a44', win: 0.9, stars: 0.55, glint: 0.55, exp: 0.7 },
  { e: 0.03, zen: '#4b5a8f', hor: '#ef9a62', sun: '#ff8a3c', sunI: 1.3, hS: '#a8909a', hG: '#4d3524', hI: 0.95, fog: '#e0996a', deep: '#1a4a5c', shal: '#4f9a9c', sky: '#6a6f9d', win: 0.55, stars: 0, glint: 1.5, exp: 0.9 },
  { e: 0.2, zen: '#6f8dbf', hor: '#ffcb8d', sun: '#ffb257', sunI: 2.0, hS: '#d9b8a0', hG: '#7d5a3c', hI: 1.25, fog: '#f1c99d', deep: '#1f5f73', shal: '#5fb3ad', sky: '#8ea2c6', win: 0.18, stars: 0, glint: 1.25, exp: 1 },
  { e: 0.5, zen: '#5f97d3', hor: '#dfe3e6', sun: '#fff1dc', sunI: 2.1, hS: '#c7d3de', hG: '#87715a', hI: 0.82, fog: '#dfe3e6', deep: '#175f7a', shal: '#63c3bf', sky: '#78abdb', win: 0, stars: 0, glint: 0.9, exp: 1 },
  { e: 1.0, zen: '#4f8ccc', hor: '#dbe1e6', sun: '#fff7ea', sunI: 2.15, hS: '#cbd6e0', hG: '#8a7358', hI: 0.8, fog: '#dbe1e6', deep: '#14607e', shal: '#66c6c2', sky: '#6fa6d8', win: 0, stars: 0, glint: 0.8, exp: 1 },
];
const cA = new THREE.Color(), cB = new THREE.Color();
const mixC = (a, b, t, out) => out.copy(cA.set(a)).lerp(cB.set(b), t);
const sunDir = new THREE.Vector3();
let hourNow = 12, timeMode = 'now';
function applyHour(h) {
  const t = (h - 6) / 12;                         // 0 at sunrise, 1 at sunset
  const el = Math.sin(t * Math.PI) * (66 * Math.PI / 180);
  const az = t * Math.PI;                         // east → west
  sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * 0.42 * Math.cos(el) + 0.18 * Math.cos(el)).normalize();
  const e = Math.sin(el);
  let i = 0; while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1], f = clamp((e - k0.e) / (k1.e - k0.e), 0, 1);
  mixC(k0.zen, k1.zen, f, skyUniforms.uZenith.value); mixC(k0.hor, k1.hor, f, skyUniforms.uHorizon.value);
  mixC(k0.sun, k1.sun, f, skyUniforms.uSunColor.value);
  skyUniforms.uSunDir.value.copy(sunDir); skyUniforms.uSunVis.value = e > -0.06 ? 1 : 0;
  skyUniforms.uStars.value = lerp(k0.stars, k1.stars, f);
  sun.color.copy(skyUniforms.uSunColor.value); sun.intensity = lerp(k0.sunI, k1.sunI, f);
  sun.position.copy(sunDir).multiplyScalar(1000);
  mixC(k0.hS, k1.hS, f, hemi.color); mixC(k0.hG, k1.hG, f, hemi.groundColor); hemi.intensity = lerp(k0.hI, k1.hI, f);
  mixC(k0.fog, k1.fog, f, scene.fog.color);
  mixC(k0.deep, k1.deep, f, seaUniforms.uDeep.value); mixC(k0.shal, k1.shal, f, seaUniforms.uShallow.value);
  mixC(k0.sky, k1.sky, f, seaUniforms.uSky.value);
  seaUniforms.uSunDir.value.copy(sunDir); seaUniforms.uSunColor.value.copy(skyUniforms.uSunColor.value);
  seaUniforms.uGlint.value = lerp(k0.glint, k1.glint, f) * (e > -0.05 ? 1 : 0.15);
  bodyU.uNight.value = lerp(k0.win, k1.win, f);
  const exp = lerp(k0.exp, k1.exp, f);
  terrain.material.color.setScalar(exp); roofMat.color.setScalar(0.6 + 0.4 * exp); bodyMat.color.setScalar(0.65 + 0.35 * exp);
  sunSprite.position.copy(sunDir).multiplyScalar(4300);
  sunSprite.material.color.copy(skyUniforms.uSunColor.value);
  sunSprite.material.opacity = e > -0.03 ? clamp(0.55 + e, 0, 1) : 0;
  const s = 620 - 260 * clamp(e, 0, 1); sunSprite.scale.set(s, s, 1);
  renderer.setClearColor(scene.fog.color);
}
function bangkokHour() {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const h = +p.find(x => x.type === 'hour').value, m = +p.find(x => x.type === 'minute').value;
    return (h % 24) + m / 60;
  } catch { const d = new Date(); return (d.getUTCHours() + 7 + d.getUTCMinutes() / 60) % 24; }
}
const PRESET = { dawn: 6.35, day: 11.2, golden: 17.55, night: 21.4 };
const phrase = h => h < 5.5 ? 'night' : h < 6.6 ? 'first light' : h < 9 ? 'morning' : h < 15 ? 'daylight' : h < 17 ? 'afternoon'
  : h < 18.4 ? 'golden hour' : h < 19.3 ? 'dusk' : 'night';
function setTime(mode, silent) {
  timeMode = mode;
  hourNow = mode === 'now' ? bangkokHour() : PRESET[mode];
  applyHour(hourNow);
  $$('button[data-time]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.time === mode)));
  const el = $('#timeNote');
  if (el) {
    if (mode === 'now') {
      const hh = Math.floor(hourNow), mm = Math.round((hourNow - hh) * 60);
      el.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} in Pattaya · ${phrase(hourNow)}`;
    } else el.textContent = `${phrase(hourNow)} · lighting only, the collection does not change`;
  }
  if (!silent) syncUrl();
}
setInterval(() => { if (timeMode === 'now') setTime('now', true); }, 60000);

/* ------------------------------------------------------------ filters */
const state = { intent: 'buy', tenure: '', type: '', price: '', beds: '', status: '', q: '', saved: false, area: '', id: '' };
const rentMonthly = r => String(r.rentUnit || '').toLowerCase() === 'per_year' ? Math.round((+r.rentPrice || 0) / 12) : (+r.rentPrice || 0);
function matches(r) {
  if (state.intent === 'rent' && !(r.forRent && +r.rentPrice > 0)) return false;
  if (state.type && r.type !== state.type) return false;
  if (state.tenure) {
    if (state.tenure === 'Freehold' && r.tenure !== 'Freehold') return false;
    if (state.tenure === 'Foreign quota' && !(r.tenure === 'Foreign quota' || r.tenure === 'Freehold')) return false;
    if (state.tenure === 'Thai quota' && r.tenure !== 'Thai quota') return false;
    if (state.tenure === 'Leasehold' && r.tenure !== 'Leasehold') return false;
  }
  if (state.beds) {
    const want = +state.beds, has = r.beds ?? (r.bedsRange ? r.bedsRange[1] : null);
    if (has == null) return false;
    if (want >= 4 ? has < 4 : (r.bedsRange ? !(r.bedsRange[0] <= want && want <= r.bedsRange[1]) : has !== want)) return false;
  }
  if (state.status) {
    const av = String(r.availability || '').toLowerCase();
    const ready = r.kind === 'resale' || r.done || /ready/.test(av);
    const off = /off/.test(av) || (r.kind === 'project' && !r.done);
    if (state.status === 'ready' && !ready) return false;
    if (state.status === 'offplan' && !off) return false;
  }
  if (state.price) {
    const [lo, hi] = state.price.split('-').map(Number);
    if (state.intent === 'rent') { const m = rentMonthly(r); if (!(m >= lo * 1e6 && m <= hi * 1e6)) return false; }
    else { const top = r.priceMax || r.priceMin || 0, bot = r.priceMin || 0; if (!bot) return false;
      if (top < lo * 1e6 || bot > hi * 1e6) return false; }
  }
  if (state.saved && !(A.isSaved && A.isSaved(r.id))) return false;
  if (state.q) {
    const t = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    const blob = [r.name, r.area, r.type, r.developer, r.tenure, (r.facilities || []).join(' '), (r.near || []).map(n => n.n).join(' ')].join(' ').toLowerCase();
    if (!t.every(w => blob.includes(w))) return false;
  }
  return true;
}
let selected = null, selectedIdx = 0, hovered = -1;
function applyFilters() {
  let shown = 0, shownL = 0;
  clusters.forEach((c, i) => {
    c.on = c.listings.filter(matches);
    const on = c.on.length > 0;
    if (on) { shown++; shownL += c.on.length; }
    const sel = selected === c;
    aState.setX(i, sel ? 1 : on ? (hovered === i ? 3 : 0) : 2);
    if (!on || sel) roofs.setColorAt(i, sel ? tmpC.set('#ffb257') : tmpC.set('#6b5a4a'));
    else roofs.setColorAt(i, c.kind === 'office' ? ROOF.office : c.kind === 'land' ? ROOF.land : c.lease ? ROOF.lease : c.sig ? ROOF.sig : ROOF.thai);
  });
  aState.needsUpdate = true; roofs.instanceColor.needsUpdate = true;
  const total = placed.length;
  const office = placed.filter(p => p.office).length;
  const parts = [`<b>${shownL}</b> of ${total} residences on the coast`];
  if (office) parts.push(`${office} recorded at the Anjia office`);
  if (unplaced.length) parts.push(`${unplaced.length} not placed`);
  $('#coastCount').innerHTML = parts.join(' · ');
  renderList();
  paintChips();
}
function paintChips() {
  $$('[data-f]').forEach(b => {
    const k = b.dataset.f, v = b.dataset.v;
    b.setAttribute('aria-pressed', String(k === 'saved' ? state.saved : String(state[k]) === v));
  });
  $$('#areaChips button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.area === state.area)));
  const q = $('#coastQ'); if (q && q.value !== state.q) q.value = state.q;
  const rent = state.intent === 'rent';
  $('#budgetSale').hidden = rent; $('#budgetRent').hidden = !rent;
}
function syncUrl() {
  const p = new URLSearchParams();
  for (const k of ['intent', 'tenure', 'type', 'price', 'beds', 'status', 'q', 'area', 'id'])
    if (state[k] && !(k === 'intent' && state[k] === 'buy')) p.set(k, state[k]);
  if (state.saved) p.set('saved', '1');
  if (timeMode !== 'now') p.set('time', timeMode);
  const url = location.pathname + (p.toString() ? '?' + p : '');
  history.replaceState(null, '', url);
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  for (const k of ['intent', 'tenure', 'type', 'price', 'beds', 'status', 'q', 'area', 'id']) if (p.get(k)) state[k] = p.get(k);
  if (!['buy', 'rent'].includes(state.intent)) state.intent = 'buy';
  state.saved = p.get('saved') === '1';
  if (['dawn', 'day', 'golden', 'night'].includes(p.get('time'))) timeMode = p.get('time');
}

/* --------------------------------------------------------------- panel */
const panel = $('#coastPanel');
const money = (lo, hi, period) => `<span class="num" data-thb="${lo || 0}" data-thb-max="${hi || 0}"${period ? ` data-period="${period}"` : ''}></span>`;
const floorNote = r => { const m = /^(\d+)\s*\/\s*(\d+)/.exec(String(r.floors || '')); return m ? `Floor ${m[1]} of ${m[2]}` : ''; };
const sizeOf = r => !r.areaMin ? '' : (!r.areaMax || r.areaMax === r.areaMin) ? `${Math.round(r.areaMin)} m²` : `${Math.round(r.areaMin)}–${Math.round(r.areaMax)} m²`;
function renderPanel() {
  if (!selected) { panel.removeAttribute('data-open'); document.body.removeAttribute('data-panel'); return; }
  const list = selected.on && selected.on.length ? selected.on : selected.listings;
  selectedIdx = clamp(selectedIdx, 0, list.length - 1);
  const r = list[selectedIdx], sig = isSig(r);
  const specs = [];
  if (r.beds) specs.push(`${r.beds} bed`); else if (r.bedsRange) specs.push(`${r.bedsRange[0]}–${r.bedsRange[1]} bed`);
  if (sizeOf(r)) specs.push(sizeOf(r));
  specs.push(r.type);
  if (floorNote(r)) specs.push(floorNote(r)); else if (r.kind === 'project' && +r.floors > 0 && +r.floors < 90) specs.push(`${r.floors} storeys`);
  if (r.availability) specs.push(r.availability);
  const rent = state.intent === 'rent' && r.forRent && +r.rentPrice > 0;
  const price = rent ? money(rentMonthly(r), 0, ' / month') : money(r.priceMin, r.priceMax || r.priceMin);
  const note = selected.office ? 'Recorded at the same point as Anjia’s office on Thepprasit Road, not at the residence itself. The desk will confirm the exact location.'
    : selected.snapped ? 'Recorded a few dozen metres off the beach; set back onto the shore here.' : '';
  panel.innerHTML = `
    <div class="pnl__media">
      <img src="${BASE}assets/img/${esc(r.img)}-600.jpg" width="900" height="600" alt="${esc(r.name)}" decoding="async">
      <span class="pnl__flag${sig ? ' pnl__flag--sig' : ''}">${esc(r.tenure || (r.kind === 'project' ? 'New development' : 'Residence'))}</span>
      <button class="pnl__close" type="button" id="pnlClose" aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="pnl__body">
      <p class="pnl__loc">${esc(r.area)}${r.developer ? ' · ' + esc(r.developer) : ''}</p>
      <h2 class="pnl__h">${esc(r.name)}</h2>
      <p class="pnl__price">${price}</p>
      <p class="pnl__spec">${specs.map(s => `<span>${esc(s)}</span>`).join('')}</p>
      ${note ? `<p class="pnl__note">${esc(note)}</p>` : ''}
      <div class="pnl__act">
        <a class="btn btn--sm btn--primary" href="${BASE}residence/${encodeURIComponent(r.id)}.html">Open residence</a>
        <button class="btn btn--sm btn--onDark fav" type="button" data-id="${esc(r.id)}" data-name="${esc(r.name)}" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/></svg>
          <span>Save</span></button>
        ${(r.gallery || []).length ? `<button class="btn btn--sm btn--onDark btn--wide" type="button" id="pnlWalk">Walk through the photographs</button>` : ''}
      </div>
      ${list.length > 1 ? `<div class="pnl__more"><span>${selectedIdx + 1} of ${list.length} in this building</span>
        <span><button type="button" id="pnlPrev" aria-label="Previous residence here">‹</button> <button type="button" id="pnlNext" aria-label="Next residence here">›</button></span></div>` : ''}
    </div>`;
  panel.setAttribute('data-open', ''); document.body.setAttribute('data-panel', '');
  A.paintCurrency?.(); A.paintSaved?.();
  $('#pnlClose').addEventListener('click', () => select(null));
  $('#pnlPrev')?.addEventListener('click', () => { selectedIdx = (selectedIdx - 1 + list.length) % list.length; renderPanel(); });
  $('#pnlNext')?.addEventListener('click', () => { selectedIdx = (selectedIdx + 1) % list.length; renderPanel(); });
  $('#pnlWalk')?.addEventListener('click', async ev => {
    const shots = [r.img, ...(r.gallery || [])].map((s, i) => `${BASE}assets/img/${s}-${i ? 1000 : 900}.jpg`);
    const plans = (r.units || []).filter(u => u.image).map(u => ({ src: `${BASE}assets/img/${u.image}-800.jpg`, name: u.name }));
    try {
      const mod = await import('./tour.js');
      mod.openTour({ title: r.name, subtitle: `${r.area} · ${r.type}`, shots, plans, base: BASE, id: r.id, href: `${BASE}residence/${encodeURIComponent(r.id)}.html`, trigger: ev.currentTarget });
    } catch (err) { location.href = `${BASE}residence/${encodeURIComponent(r.id)}.html`; }
  });
  // the photograph, floating above the building
  loadTex(`${BASE}assets/img/${r.img}-400.jpg`).then(t => {
    if (!t || !selected || !selected.listings.includes(r)) return;
    if (list[selectedIdx] !== r) return;
    photoImg.material.map = t; photoImg.material.needsUpdate = true;
    const ar = t.image && t.image.width ? t.image.width / t.image.height : 1.5;
    photoImg.scale.set(ar, 1, 1); photoFrame.scale.set(ar + 0.08 * ar, 1, 1);
    photo.visible = true;
  });
}
function select(c, idx = 0, fly = true) {
  if (selected && selected !== c) { const i = clusters.indexOf(selected); aState.setX(i, selected.on?.length ? 0 : 2); }
  selected = c; selectedIdx = idx;
  state.id = c ? c.listings[idx]?.id || '' : '';
  if (c) {
    const i = clusters.indexOf(c); aState.setX(i, 1);
    const size = Math.max(c.w, c.d);
    ring.position.set(c.x, c.y - 0.1, c.z); ring.userData.s = size * 2.2; ring.scale.set(ring.userData.s, ring.userData.s, 1); ring.visible = true;
    beam.position.set(c.x, c.y + c.h + 30, c.z); beam.scale.set(size * 0.8, 60, size * 0.8); beam.visible = true;
    photo.position.set(c.x, c.y + c.h + 4.5, c.z); photo.visible = false;
    if (fly) flyToCluster(c);
  } else { ring.visible = beam.visible = photo.visible = false; }
  aState.needsUpdate = true;
  if (c && innerWidth < 760) { $$('.hud__filters,.hud__list').forEach(el => el.removeAttribute('data-open')); $$('#filtersBtn,#listBtn').forEach(b => b.setAttribute('aria-expanded', 'false')); }
  applyFilters(); renderPanel(); syncUrl();
  $$('#coastListItems button').forEach(b => b.setAttribute('aria-current', String(!!c && c.listings.some(r => r.id === b.dataset.id))));
}

/* ---------------------------------------------------------------- list */
function renderList() {
  const ul = $('#coastListItems'); if (!ul) return;
  const rows = [];
  for (const c of clusters) for (const r of (c.on || [])) rows.push({ c, r });
  rows.sort((a, b) => a.r.area.localeCompare(b.r.area) || a.r.name.localeCompare(b.r.name));
  ul.innerHTML = rows.map(({ c, r }) => `<li><button type="button" data-id="${esc(r.id)}" aria-current="${String(selected === c)}">
      <span>${esc(r.name)}</span><small>${esc(r.area)} · ${esc(r.tenure || r.type)}</small></button></li>`).join('')
    || '<li><button type="button" disabled>Nothing matches these filters.</button></li>';
  $('#coastListCount').textContent = `${rows.length} residence${rows.length === 1 ? '' : 's'}`;
}
$('#coastListItems')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  const c = clusters.find(k => k.listings.some(r => r.id === b.dataset.id)); if (!c) return;
  const list = c.on?.length ? c.on : c.listings;
  select(c, Math.max(0, list.findIndex(r => r.id === b.dataset.id)));
});

/* ------------------------------------------------------------- camera */
const flight = { on: false, start: 0, dur: 0, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3(), done: null };
function flyTo(pos, target, dur = 1.8, done) {
  flight.p0.copy(camera.position); flight.t0.copy(controls.target);
  flight.p1.copy(pos); flight.t1.copy(target);
  flight.dur = reduced ? 0 : dur; flight.start = performance.now(); flight.on = true; flight.done = done || null;
  controls.enabled = false;
  if (flight.dur === 0) endFlight();
}
function endFlight() {
  camera.position.copy(flight.p1); controls.target.copy(flight.t1);
  flight.on = false; controls.enabled = !tour.on; controls.update();
  const d = flight.done; flight.done = null; d && d();
}
const DIR_SE = new THREE.Vector3(0.6, 0.4, 0.62).normalize();
const centre = (() => { const xs = clusters.map(c => c.x), zs = clusters.map(c => c.z);
  return new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2 - 40, 0, (Math.min(...zs) + Math.max(...zs)) / 2 - 60); })();
function overview(dur = 2.2, done) { flyTo(centre.clone().addScaledVector(DIR_SE, 820), centre.clone(), dur, done); }
function flyToArea(a, dur = 2.0, done) {
  const target = new THREE.Vector3(a.x, Math.max(0, groundAt(a.x, a.z)), a.z);
  const dist = clamp(a.radius * 1.9 + 50, 110, 640);
  flyTo(target.clone().addScaledVector(DIR_SE, dist), target, dur, done);
}
function flyToCluster(c, dur = 1.7, done) {
  const target = new THREE.Vector3(c.x, c.y + c.h * 0.55, c.z);
  // keep the visitor's current bearing, come in closer and a little lower
  const cur = camera.position.clone().sub(controls.target); cur.y = 0;
  if (cur.lengthSq() < 1) cur.copy(DIR_SE);
  cur.normalize();
  const dist = clamp(c.h * 1.5 + 22, 36, 180);
  const pos = target.clone().addScaledVector(cur, dist * 0.86); pos.y = target.y + dist * 0.5;
  flyTo(pos, target, dur, done);
}

/* ------------------------------------------------------------- picking */
const ray = new THREE.Raycaster(); ray.params.Mesh = {}; const ndc = new THREE.Vector2();
const hoverTag = $('#hoverTag');
let ptrDown = null, moved = false;
function pick(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([bodies, roofs], false);
  return hits.length ? hits[0].instanceId : -1;
}
function setHover(i) {
  if (hovered === i) return;
  if (hovered >= 0 && clusters[hovered] !== selected) aState.setX(hovered, clusters[hovered].on?.length ? 0 : 2);
  hovered = i;
  if (i >= 0 && clusters[i] !== selected) aState.setX(i, 3);
  aState.needsUpdate = true;
  canvas.toggleAttribute('data-hover', i >= 0);
  if (i < 0) { hoverTag.hidden = true; return; }
  const c = clusters[i], r = (c.on?.length ? c.on : c.listings)[0];
  const n = (c.on?.length ? c.on : c.listings).length;
  const lo = state.intent === 'rent' ? rentMonthly(r) : r.priceMin, hi = state.intent === 'rent' ? 0 : (r.priceMax || r.priceMin);
  hoverTag.innerHTML = `<small>${c.office ? 'Recorded at the Anjia office' : esc(r.area)}${n > 1 ? ` · ${n} residences` : ''}</small>${esc(r.name)}<br><span class="num" data-thb="${lo || 0}" data-thb-max="${hi || 0}"${state.intent === 'rent' ? ' data-period=" / month"' : ''}></span>`;
  hoverTag.hidden = false; A.paintCurrency?.();
}
let hoverRaf = 0, hoverEv = null;
canvas.addEventListener('pointermove', e => {
  hoverEv = e; if (ptrDown && (Math.abs(e.clientX - ptrDown.x) > 5 || Math.abs(e.clientY - ptrDown.y) > 5)) moved = true;
  if (coarse) return;
  if (!hoverRaf) hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; if (hoverEv) setHover(pick(hoverEv.clientX, hoverEv.clientY)); });
});
canvas.addEventListener('pointerleave', () => setHover(-1));
canvas.addEventListener('pointerdown', e => { ptrDown = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = false;
  if (flight.on && !tour.on) { flight.on = false; controls.enabled = true; } if (tour.on) endTour('paused'); $('#hint')?.setAttribute('data-gone', ''); });
canvas.addEventListener('pointerup', e => {
  if (!ptrDown) return;
  const quick = performance.now() - ptrDown.t < 500 && !moved; ptrDown = null;
  if (!quick) return;
  const i = pick(e.clientX, e.clientY);
  if (i >= 0) { const c = clusters[i]; select(c, 0); }
  else if (selected) select(null);
});
canvas.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) select(null); });

/* --------------------------------------------------------------- tour */
const tour = { on: false, stops: [], i: 0, timer: 0, paused: false };
function buildStops() {
  const stops = [];
  for (const a of AREA_ORDER) {
    const cs = clusters.filter(c => !c.office && (c.on || []).some(r => r.area === a.name));
    if (!cs.length) continue;
    stops.push({ kind: 'area', area: a, label: a.name, sub: `${cs.reduce((n, c) => n + c.on.length, 0)} residences` });
    const picks = cs.map(c => ({ c, r: c.on.find(r => r.area === a.name) }))
      .sort((p, q) => (q.r.featured ? 1 : 0) - (p.r.featured ? 1 : 0) || (isSig(q.r) ? 1 : 0) - (isSig(p.r) ? 1 : 0) || (q.r.priceMax || q.r.priceMin || 0) - (p.r.priceMax || p.r.priceMin || 0))
      .slice(0, 2);
    for (const p of picks) stops.push({ kind: 'res', c: p.c, r: p.r, label: p.r.name, sub: a.name });
  }
  return stops;
}
function startTour() {
  tour.stops = buildStops(); if (!tour.stops.length) return;
  tour.on = true; tour.i = -1; tour.paused = false;
  if (timeMode === 'now' && (hourNow < 6.5 || hourNow > 18.5)) setTime('golden');
  $('#tourBar').hidden = false; $('#tourBtn').setAttribute('aria-pressed', 'true');
  $('#hint')?.setAttribute('data-gone', '');
  nextStop();
}
function nextStop() {
  if (!tour.on) return;
  tour.i++;
  if (tour.i >= tour.stops.length) { endTour('done'); return; }
  const s = tour.stops[tour.i];
  $('#tourStop').innerHTML = `<small>Stop ${tour.i + 1} of ${tour.stops.length} · ${esc(s.sub)}</small>${esc(s.label)}`;
  $('#tourProg').style.width = `${((tour.i + 1) / tour.stops.length) * 100}%`;
  const dwell = s.kind === 'area' ? 3200 : 5600;
  const after = () => { if (!tour.on || tour.paused) return; tour.timer = setTimeout(nextStop, dwell); };
  if (s.kind === 'area') { select(null); flyToArea(s.area, 2.4, after); }
  else { const list = s.c.on?.length ? s.c.on : s.c.listings; select(s.c, Math.max(0, list.indexOf(s.r)), false); flyToCluster(s.c, 2.2, after); }
}
function endTour(why) {
  clearTimeout(tour.timer); tour.on = false; tour.paused = false; controls.enabled = !flight.on;
  if (flight.on) { flight.on = false; controls.enabled = true; }
  $('#tourBar').hidden = true; $('#tourBtn').setAttribute('aria-pressed', 'false');
  $('#tourPause').textContent = 'Pause';
  if (why === 'done') overview(2.6);
}
$('#tourBtn')?.addEventListener('click', () => tour.on ? endTour('stopped') : startTour());
$('#tourStopBtn')?.addEventListener('click', () => endTour('stopped'));
$('#tourPause')?.addEventListener('click', () => {
  if (!tour.on) return;
  tour.paused = !tour.paused; $('#tourPause').textContent = tour.paused ? 'Resume' : 'Pause';
  if (tour.paused) clearTimeout(tour.timer); else nextStop();
});

/* ------------------------------------------------------------------ UI */
function buildAreaChips() {
  const box = $('#areaChips'); if (!box) return;
  box.innerHTML = `<button class="areaChip glass" type="button" data-area="" aria-pressed="true">The whole coast<i>${placed.length}</i></button>` +
    AREA_ORDER.map(a => `<button class="areaChip glass" type="button" data-area="${esc(a.name)}" aria-pressed="false">${esc(a.name)}<i>${a.n}</i></button>`).join('');
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-area]'); if (!b) return;
    if (tour.on) endTour('stopped');
    state.area = b.dataset.area; paintChips(); syncUrl();
    if (!state.area) { select(null); overview(2.2); }
    else { select(null); flyToArea(areas[state.area]); }
    b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  });
}
buildAreaChips();
$('#coastFilters')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-f]'); if (!b) return;
  const k = b.dataset.f;
  if (k === 'saved') state.saved = !state.saved;
  else if (k === 'clear') { Object.assign(state, { tenure: '', type: '', price: '', beds: '', status: '', q: '', saved: false }); }
  else state[k] = b.dataset.v;
  if (k === 'intent') state.price = '';
  applyFilters(); syncUrl();
});
$('#coastQ')?.addEventListener('input', e => { state.q = e.target.value.trim(); applyFilters(); syncUrl(); });
$('#coastQ')?.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
const toggle = (btn, box) => btn?.addEventListener('click', () => {
  const open = box.hasAttribute('data-open');
  $$('.hud__filters,.hud__list').forEach(el => el.removeAttribute('data-open'));
  $$('#filtersBtn,#listBtn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (!open) { box.setAttribute('data-open', ''); btn.setAttribute('aria-expanded', 'true'); }
});
toggle($('#filtersBtn'), $('#coastFilters')); toggle($('#listBtn'), $('#coastList'));
$('#resetBtn')?.addEventListener('click', () => { if (tour.on) endTour('stopped'); state.area = ''; paintChips(); select(null); overview(1.8); syncUrl(); });
document.addEventListener('click', e => { const b = e.target.closest('button[data-time]'); if (b) setTime(b.dataset.time); });
document.addEventListener('anjia:saved', () => { if (state.saved) applyFilters(); });
document.addEventListener('anjia:currency', () => {});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (tour.on) endTour('stopped'); else if (selected) select(null); }
  if (e.key === ' ' && tour.on && !/input|textarea|button/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); $('#tourPause').click(); }
});

/* the residences that could not be placed, listed plainly below the stage */
{
  const ul = $('#coastUnplaced');
  if (ul) {
    const rows = [...unplaced.map(r => ({ r, why: 'Recorded coordinates fall outside the coast' })),
      ...placed.filter(p => p.office).map(p => ({ r: p.r, why: 'Recorded at Anjia’s office, shown there' }))];
    ul.innerHTML = rows.map(({ r, why }) => `<li><a class="tlink" href="${BASE}residence/${encodeURIComponent(r.id)}.html">${esc(r.name)}</a><span>${esc(why)}</span></li>`).join('')
      || '<li><span>Every residence in the collection is placed.</span></li>';
  }
}

/* ------------------------------------------------------------ sizing */
function fit() {
  const top = stage.getBoundingClientRect().top + window.scrollY;
  const dock = $('#dock');
  const dockH = dock && getComputedStyle(dock).display !== 'none' ? dock.offsetHeight : 0;
  const h = clamp(innerHeight - top - dockH, 520, 1240);
  stage.style.height = h + 'px';
  const w = stage.clientWidth, hh = stage.clientHeight;
  renderer.setSize(w, hh, false);
  camera.aspect = w / hh; camera.updateProjectionMatrix();
}
fit(); addEventListener('resize', fit);

/* ------------------------------------------------------------ the loop */
const timer = new THREE.Timer();
let running = true;
const compass = $('#compass');
const worldV = new THREE.Vector3();
function frame() {
  if (!running) return;
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  if (!reduced) seaUniforms.uTime.value += dt;
  if (flight.on) {
    const t = (performance.now() - flight.start) / (flight.dur * 1000);
    if (t >= 1) endFlight();
    else { const k = easeInOut(t);
      camera.position.lerpVectors(flight.p0, flight.p1, k); controls.target.lerpVectors(flight.t0, flight.t1, k); }
  } else {
    controls.update();
    controls.target.x = clamp(controls.target.x, -HALF.x + 80, HALF.x - 80);
    controls.target.z = clamp(controls.target.z, -HALF.z + 80, HALF.z - 80);
    controls.target.y = clamp(controls.target.y, 0, 90);
  }
  if (camera.position.y < 4) camera.position.y = 4;
  seaUniforms.uCam.value.copy(camera.position);
  sky.position.copy(camera.position);
  bodyU.uPulse.value = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 420);
  if (ring.visible) { const s = (ring.userData.s || 4) * (1 + 0.07 * bodyU.uPulse.value); ring.scale.set(s, s, 1); ring.material.opacity = 0.55 + 0.4 * bodyU.uPulse.value; }
  // labels keep a legible size and step aside when you are close
  for (const l of labels) {
    const d = camera.position.distanceTo(l.sprite.position);
    const s = clamp(d * 0.028, 12, 84); l.sprite.scale.set(s * 2.9, s, 1);
    l.sprite.material.opacity = clamp((d - 70) / 120, 0, 1) * (state.area && state.area !== l.area.name ? 0.35 : 1);
  }
  if (photo.visible) {
    const d = camera.position.distanceTo(photo.position); const s = clamp(d * 0.075, 5, 40);
    photo.scale.set(s, s, s); photo.lookAt(camera.position);
  }
  if (hoverTag && !hoverTag.hidden && hovered >= 0) {
    const c = clusters[hovered]; worldV.set(c.x, c.y + c.h + 1, c.z).project(camera);
    const r = canvas.getBoundingClientRect();
    hoverTag.style.left = ((worldV.x + 1) / 2 * r.width) + 'px'; hoverTag.style.top = ((1 - worldV.y) / 2 * r.height) + 'px';
  }
  if (compass) { const a = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    compass.style.transform = `rotate(${(a * 180 / Math.PI).toFixed(1)}deg)`; }
  renderer.render(scene, camera);
}
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { timer.update(); frame(); } });

/* -------------------------------------------------------------- start */
readUrl();
paintChips();
setTime(timeMode, true);
applyFilters();
// begin high over the bay, and settle
const startPos = centre.clone().add(new THREE.Vector3(420, 1900, 2300));
camera.position.copy(startPos); controls.target.copy(centre); controls.update();
frame();
$('#veil')?.setAttribute('data-gone', '');
const focusId = state.id && clusters.find(c => c.listings.some(r => r.id === state.id));
if (focusId) {
  const list = focusId.on?.length ? focusId.on : focusId.listings;
  overview(reduced ? 0 : 1.4, () => select(focusId, Math.max(0, list.findIndex(r => r.id === state.id))));
} else if (state.area && areas[state.area]) {
  flyToArea(areas[state.area], 3.0);
} else overview(3.4);
setTimeout(() => $('#hint')?.setAttribute('data-gone', ''), 9000);
