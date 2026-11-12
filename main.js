/* Stillwater Meadow — a calm, walkable lakeside world. three.js r128, no external assets. */
(() => {
  'use strict';

  const errorBox = document.getElementById('error');
  function showError(msg) { errorBox.hidden = false; errorBox.textContent = msg; }
  window.addEventListener('error', (e) => showError('Something went wrong: ' + e.message));
  if (!window.THREE) { showError('three.js did not load. Check that lib/three.min.js is next to index.html.'); return; }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;

  // ───────────────────────── helpers ─────────────────────────
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  const turnTo = (a, b, step) => a + clamp(angDiff(a, b), -step, step);
  const wrap = (v, min, max) => { const r = max - min; return ((((v - min) % r) + r) % r) + min; };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20261112);
  const rand = (a, b) => a + (b - a) * rng();
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  function hash(x, y) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  }

  // ───────────────────────── world shape ─────────────────────────
  const LAKE = { x: 6, z: -30 };
  const PATH_T = 1.32;
  const WORLD_LIMIT = 118;
  function lakeR(a) { return 30 + 4 * Math.sin(3 * a) + 2.5 * Math.cos(5 * a + 1.3) + 1.5 * Math.sin(7 * a + 0.4); }
  function lakeT(x, z) { const dx = x - LAKE.x, dz = z - LAKE.z; return Math.hypot(dx, dz) / lakeR(Math.atan2(dz, dx)); }
  function pathAmt(x, z) {
    const dx = x - LAKE.x, dz = z - LAKE.z;
    const r = lakeR(Math.atan2(dz, dx)) * PATH_T;
    return 1 - smooth(1.3, 2.7, Math.abs(Math.hypot(dx, dz) - r));
  }
  function height(x, z) {
    const d = Math.hypot(x, z);
    let base = 0.6 + fbm(x * 0.018 + 3.1, z * 0.018 - 7.4) * 7.5;
    base += smooth(85, 150, d) * (16 + fbm(x * 0.045, z * 0.045) * 24);
    const t = lakeT(x, z);
    const floor = t < 1 ? -3.2 * (1 - t * t) : (t - 1) * 2.0;
    const k = smooth(0.8, 1.6, t);
    return floor * (1 - k) + base * k - pathAmt(x, z) * 0.08;
  }
  const lakePoint = (a, t) => ({ x: LAKE.x + Math.cos(a) * lakeR(a) * t, z: LAKE.z + Math.sin(a) * lakeR(a) * t });
  const SPAWN = lakePoint(Math.PI / 2, PATH_T + 0.04);

  // Dock: a wooden jetty reaching into the lake
  const DOCK_A = Math.PI / 2 + 0.55;
  const dockStart = lakePoint(DOCK_A, 1.03);
  const dockDir = { x: -Math.cos(DOCK_A), z: -Math.sin(DOCK_A) };
  const DOCK_BACK = 1.6, DOCK_LEN = 9, DOCK_HALF = 1.05;
  const DOCK_Y = Math.max(0.5, height(dockStart.x, dockStart.z) + 0.1);
  function onDock(x, z) {
    const rx = x - dockStart.x, rz = z - dockStart.z;
    const s = rx * dockDir.x + rz * dockDir.z;
    const w = rx * dockDir.z - rz * dockDir.x;
    return s > -DOCK_BACK && s < DOCK_LEN && Math.abs(w) < DOCK_HALF;
  }
  const onIce = (x, z) => seasonState.ice > 0.85 && lakeT(x, z) < 1.0 && height(x, z) < 0.3; // frozen lake in winter
  const groundAt = (x, z) => (onDock(x, z) ? Math.max(DOCK_Y + 0.05, height(x, z)) : onIce(x, z) ? Math.max(height(x, z), 0.09) : height(x, z));
  function walkable(x, z) {
    if (onDock(x, z) || onIce(x, z)) return true;
    if (Math.hypot(x, z) > WORLD_LIMIT) return false;
    const h = height(x, z);
    return h > 0.22 && h < 18;
  }
  const animalWalkable = (x, z) => onDock(x, z) || (walkable(x, z) && !onIce(x, z) && height(x, z) > 0.35);

  // Lawn chairs on the east shore (kept clear of trees, rocks and tall grass)
  const CHAIR_A = Math.PI / 2 - 0.95;
  const chairSpots = [lakePoint(CHAIR_A, 1.17), lakePoint(CHAIR_A + 0.05, 1.17)];
  const FIRE_SPOT = lakePoint(Math.PI / 2 + 0.34, 1.68); // campfire pit on the meadow
  const nearChairs = (x, z, r) => chairSpots.some((c) => Math.hypot(x - c.x, z - c.z) < r) || Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) < r + 1.6;

  const obstacles = [];
  const seats = [];
  // Extension points used by the feature modules in /features
  const world = {};                                   // handles to trees, grass, flowers, lily pads…
  const interactables = [];                           // extra things E can act on (campfire…)
  const hooks = { frame: [], pose: [], camera: [] };  // per-frame callbacks
  const seasonState = { name: '', ice: 0, coverFloor: 0, bugs: 1, mapWeather: (k) => k };
  const uiState = { blockActions: false };
  function pushOut(p, r) {
    for (const o of obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const min = o.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = o.x + (dx / d) * min;
        p.z = o.z + (dz / d) * min;
      }
    }
  }

  // ───────────────────────── renderer / scene ─────────────────────────
  const canvas = document.getElementById('world');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    showError('Your browser could not start WebGL, which this world needs to render.');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe5f2, 50, 220);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500);

  const timeU = { value: 0 };
  const windU = { value: 1 };                               // grass/reed sway strength
  const wxU = { snow: { value: 0 }, wet: { value: 0 } };     // snow cover and wetness on surfaces
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.95, metalness: 0 }, extra || {}));

  function addWind(mat, k) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = timeU;
      sh.uniforms.uWind = windU;
      sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float wv = sin(uTime * 1.7 + ip.x * 0.31 + ip.y * 0.23) * 0.6 + sin(uTime * 3.1 + ip.x * 0.8 - ip.y * 0.5) * 0.25;
        float hh = max(position.y, 0.0);
        transformed.x += wv * hh * hh * ${k.toFixed(3)} * uWind;
        transformed.z += wv * hh * hh * ${(k * 0.5).toFixed(3)} * uWind;`);
    };
    mat.customProgramCacheKey = () => 'wind' + k;
    return mat;
  }

  // Lets a surface turn darker/glossy when wet and white on upward faces as snow settles.
  function weatherize(mat, mode) {
    const prev = mat.onBeforeCompile;
    const baseKey = mat.customProgramCacheKey();
    mat.onBeforeCompile = (sh, r) => {
      prev.call(mat, sh, r);
      sh.uniforms.uSnow = wxU.snow;
      sh.uniforms.uWet = wxU.wet;
      sh.fragmentShader = 'uniform float uSnow;\nuniform float uWet;\n' + (mode === 'std'
        ? sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 wN = inverseTransformDirection(normal, viewMatrix);
            float sAmt = uSnow * smoothstep(0.3, 0.75, wN.y);
            diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - uWet * 0.38), vec3(0.93, 0.95, 0.99), sAmt);
            roughnessFactor = mix(roughnessFactor, 0.42, uWet * (1.0 - sAmt));
          }`)
        : sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - uWet * 0.3), vec3(0.93, 0.95, 0.99), uSnow * 0.85);`));
    };
    mat.customProgramCacheKey = () => baseKey + '|wx-' + mode;
    return mat;
  }

  function mergeGeos(geos) {
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0;
    parts.forEach((g) => { n += g.attributes.position.array.length; });
    const pos = new Float32Array(n);
    let o = 0;
    parts.forEach((g) => { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.computeVertexNormals();
    return out;
  }

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  function instanced(geo, mat, items, opts) {
    const o = opts || {};
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      E.set(it.rx || 0, it.ry || 0, it.rz || 0);
      Q.setFromEuler(E);
      V.set(it.x, it.y, it.z);
      S.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
      M4.compose(V, Q, S);
      mesh.setMatrixAt(i, M4);
      if (it.color) mesh.setColorAt(i, it.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = !!o.cast;
    mesh.receiveShadow = o.receive !== false;
    scene.add(mesh);
    return mesh;
  }
  const col = (hex) => new THREE.Color(hex);

  // ───────────────────────── sky ─────────────────────────
  const skyU = {
    topColor: { value: new THREE.Color() },
    horizonColor: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    moonDir: { value: new THREE.Vector3(0, 1, 0) },
    moonAmt: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 18),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDir;
        uniform vec3 moonDir; uniform float moonAmt;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float above = smoothstep(-0.01, 0.015, h);
          vec3 c = mix(horizonColor, topColor, pow(smoothstep(0.0, 1.0, max(h, 0.0)), 0.5));
          c = mix(c, horizonColor * 0.92, smoothstep(0.0, -0.3, h));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 5.0) * 0.16 + pow(s, 40.0) * 0.3) * (1.0 - 0.4 * max(h, 0.0));
          c = mix(c, vec3(1.0, 0.97, 0.9) * (0.6 + 0.6 * sunColor), smoothstep(0.99935, 0.9997, s) * above);
          float m = max(dot(d, normalize(moonDir)), 0.0);
          c += vec3(0.5, 0.58, 0.8) * (pow(m, 60.0) * 0.22 + pow(m, 8.0) * 0.05) * moonAmt * above;
          c = mix(c, vec3(0.97, 0.95, 0.87), smoothstep(0.99955, 0.99975, m) * moonAmt * above);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // Stars ride along with the sky dome
  const starMat = new THREE.PointsMaterial({ size: 1.6 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
  {
    const pos = [], cols = [];
    for (let i = 0; i < 1500; i++) {
      const y = Math.pow(rng(), 0.8) * 0.98 + 0.02, a = rng() * TAU, r = Math.sqrt(1 - y * y);
      pos.push(Math.cos(a) * r * 650, y * 650, Math.sin(a) * r * 650);
      const b = rand(0.45, 1), warm = rng() < 0.2 ? 0.88 : 1;
      cols.push(b, b * (warm < 1 ? 0.95 : 1), b * warm);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const stars = new THREE.Points(g, starMat);
    stars.frustumCulled = false;
    sky.add(stars);
  }

  // ───────────────────────── lights ─────────────────────────
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556633, 0.6);
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 320 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, ambient, sun, sun.target);

  // ───────────────────────── terrain ─────────────────────────
  {
    const SIZE = 360, SEG = 200;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const g1 = col('#6e9a48'), g2 = col('#9dbf5d'), g3 = col('#4b7a3a'), sand = col('#dcc895'), bed = col('#7a7856');
    const dirt = col('#c4ab7c'), moss = col('#5c7444'), rock = col('#8d8b7d');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = height(x, z);
      p.setY(i, h);
      c.copy(g1).lerp(g2, smooth(0.35, 0.7, fbm(x * 0.05 + 11, z * 0.05 - 3)));
      c.lerp(g3, smooth(0.5, 0.75, fbm(x * 0.11 - 5, z * 0.11 + 8)) * 0.6);
      c.lerp(sand, 1 - smooth(1.02, 1.16, lakeT(x, z)));
      c.lerp(bed, smooth(0.05, -0.8, h));
      c.lerp(dirt, pathAmt(x, z) * 0.9);
      c.lerp(moss, smooth(6, 12, h) * 0.6);
      c.lerp(rock, smooth(13, 24, h) * 0.85);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = world.terrain = new THREE.Mesh(geo, weatherize(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }), 'std'));
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    scene.add(terrain);
  }

  // ───────────────────────── water ─────────────────────────
  const waterU = {
    uTime: { value: 0 },
    deep: { value: new THREE.Color() },
    shallow: { value: new THREE.Color() },
    skyTop: skyU.topColor,
    skyHorizon: skyU.horizonColor,
    sunDir: { value: new THREE.Vector3(0, 1, 0) },   // sun by day, moon by night
    sunColor: { value: new THREE.Color() },
    fogColor: { value: new THREE.Color() },
    fogNear: { value: 50 },
    fogFar: { value: 220 },
    lakeC: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
    uRain: { value: 0 },
    uIce: { value: 0 },
    uIceLight: { value: 1 },
    uSnowIce: { value: 0 },
  };
  {
    const geo = new THREE.CircleGeometry(48, 160);
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: waterU,
      vertexShader: `
        varying vec3 vWP;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uRain; uniform float uIce; uniform float uIceLight; uniform float uSnowIce;
        uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyTop; uniform vec3 skyHorizon;
        uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 fogColor;
        uniform float fogNear; uniform float fogFar; uniform vec2 lakeC;
        varying vec3 vWP;
        vec2 wave(vec2 p, vec2 d, float f, float s, float a) {
          return d * cos(dot(p, d) * f + uTime * s) * f * a;
        }
        float hash21(vec2 q) { q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
        vec2 ripples(vec2 p) {
          vec2 g = vec2(0.0);
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            vec2 q = p * 1.1 + fk * 17.3;
            vec2 id = floor(q);
            vec2 f = fract(q) - 0.5;
            float ph = fract(uTime * 0.8 + hash21(id + fk * 3.1));
            vec2 c = (vec2(hash21(id + 1.7), hash21(id + 5.3)) - 0.5) * 0.5;
            vec2 dv = f - c;
            float d = length(dv) + 1e-4;
            float r = ph * 0.45;
            g += dv / d * sin((d - r) * 45.0) * smoothstep(0.07, 0.0, abs(d - r)) * (1.0 - ph);
          }
          return g * 0.5;
        }
        void main() {
          vec2 p = vWP.xz;
          vec2 g = wave(p, normalize(vec2(1.0, 0.3)), 0.9, 1.1, 0.05)
                 + wave(p, normalize(vec2(-0.4, 1.0)), 1.7, 1.7, 0.025)
                 + wave(p, normalize(vec2(0.7, -0.8)), 3.1, 2.4, 0.012)
                 + wave(p, normalize(vec2(-0.9, -0.2)), 5.3, 3.2, 0.006);
          g += ripples(p) * uRain * (1.0 - uIce);
          g *= 1.0 - uIce * 0.9;
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 v = normalize(cameraPosition - vWP);
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 r = reflect(-v, n);
          vec3 skyc = mix(skyHorizon, skyTop, pow(clamp(r.y, 0.0, 1.0), 0.5));
          float edge = smoothstep(16.0, 33.0, length(p - lakeC));
          vec3 base = mix(deep, shallow, edge);
          vec3 c = mix(base, skyc, clamp(fres * 0.85 + 0.12, 0.0, 1.0));
          float sp = pow(max(dot(r, normalize(sunDir)), 0.0), 220.0);
          c += sunColor * sp * 1.8;
          // winter: faceted pale ice, dusted with snow
          vec3 ice = mix(vec3(0.7, 0.8, 0.88), vec3(0.84, 0.9, 0.96), 0.45 + 0.18 * sin(p.x * 0.21 + sin(p.y * 0.13) * 2.0) + 0.12 * sin(p.y * 0.37 + p.x * 0.11)) * uIceLight;
          ice = mix(ice, vec3(0.94, 0.96, 1.0) * uIceLight, uSnowIce * (0.2 + 0.6 * smoothstep(0.3, 0.7, hash21(floor(p * 0.9)))));
          ice += sunColor * pow(max(dot(r, normalize(sunDir)), 0.0), 60.0) * 0.5;
          c = mix(c, ice, uIce);
          float dist = length(cameraPosition - vWP);
          c = mix(c, fogColor, smoothstep(fogNear, fogFar, dist));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    water.position.set(LAKE.x, 0.02, LAKE.z);
    water.receiveShadow = false;
    scene.add(water);
  }

  // ───────────────────────── trees ─────────────────────────
  const treeSpots = [];
  {
    const bench = lakePoint(Math.PI / 2 - 0.5, 1.5);
    let tries = 0;
    while (treeSpots.length < 320 && tries < 30000) {
      tries++;
      const a = rng() * TAU, r = Math.sqrt(rng()) * 155;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (lakeT(x, z) < 1.22 || pathAmt(x, z) > 0.02) continue;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10) continue;
      if (Math.hypot(x - bench.x, z - bench.z) < 4) continue;
      if (nearChairs(x, z, 4)) continue;
      if (Math.hypot(x - dockStart.x, z - dockStart.z) < 5) continue;
      const h = height(x, z);
      if (h > 30) continue;
      const dens = 0.18 + smooth(35, 110, Math.hypot(x, z)) * 0.82;
      const clump = fbm(x * 0.03 + 9, z * 0.03);
      if (rng() > dens * (0.35 + clump)) continue;
      let ok = true;
      for (const t of treeSpots) { if ((t.x - x) ** 2 + (t.z - z) ** 2 < 11) { ok = false; break; } }
      if (!ok) continue;
      const roll = rng();
      treeSpots.push({ x, z, y: h - 0.15, type: roll < 0.42 ? 'pine' : roll < 0.52 ? 'blossom' : 'round', s: rand(0.8, 1.5), ry: rng() * TAU });
    }
    const pines = treeSpots.filter((t) => t.type === 'pine');
    const rounds = treeSpots.filter((t) => t.type !== 'pine');

    const pineTrunk = new THREE.CylinderGeometry(0.16, 0.26, 1.6, 6).translate(0, 0.8, 0);
    const pineTop = mergeGeos([
      new THREE.ConeGeometry(1.6, 2.4, 7).translate(0, 2.4, 0),
      new THREE.ConeGeometry(1.25, 2.0, 7).translate(0, 3.5, 0),
      new THREE.ConeGeometry(0.85, 1.6, 7).translate(0, 4.5, 0),
    ]);
    const roundTrunk = new THREE.CylinderGeometry(0.18, 0.3, 2.4, 6).translate(0, 1.2, 0);
    const roundTop = mergeGeos([
      new THREE.IcosahedronGeometry(1.6, 0).translate(0, 3.3, 0),
      new THREE.IcosahedronGeometry(1.2, 0).translate(0.95, 2.9, 0.4),
      new THREE.IcosahedronGeometry(1.1, 0).translate(-0.85, 3.05, -0.3),
      new THREE.IcosahedronGeometry(1.0, 0).translate(0.1, 4.2, 0.2),
    ]);
    const bark = std('#6b4f3a');
    const leaf = weatherize(std('#ffffff'), 'std');
    const pineCols = ['#2f5a3a', '#3b6a40', '#2a4e37', '#456f43'].map(col);
    const roundCols = ['#5b8f3e', '#6fa04a', '#4d7f3a', '#86a948', '#7a9c3c'].map(col);
    const blossomCols = ['#f2b8c6', '#eaa3b8', '#f7cdd8'].map(col);

    instanced(pineTrunk, bark, pines, { cast: true });
    instanced(pineTop, leaf, pines.map((t) => Object.assign({}, t, { color: pick(pineCols) })), { cast: true });
    instanced(roundTrunk, bark, rounds, { cast: true });
    world.roundItems = rounds.map((t) => Object.assign({}, t, { color: t.type === 'blossom' ? pick(blossomCols) : pick(roundCols) }));
    world.roundTop = instanced(roundTop, leaf, world.roundItems, { cast: true });
    treeSpots.forEach((t) => obstacles.push({ x: t.x, z: t.z, r: 0.32 * t.s }));
  }

  // ───────────────────────── rocks ─────────────────────────
  {
    const rocks = [];
    const rockCols = ['#8f8d82', '#7d7c73', '#a09d90', '#6f6e68'].map(col);
    for (let i = 0; i < 70; i++) {
      const shore = i < 22;
      let x, z, tries = 0;
      do {
        tries++;
        if (shore) { const p = lakePoint(rng() * TAU, rand(0.97, 1.12)); x = p.x; z = p.z; }
        else { const a = rng() * TAU, r = Math.sqrt(rng()) * 120; x = Math.cos(a) * r; z = Math.sin(a) * r; }
      } while (tries < 20 && (onDock(x, z) || pathAmt(x, z) > 0.1 || (!shore && lakeT(x, z) < 1.15) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6 || nearChairs(x, z, 2.6)));
      const s = shore ? rand(0.35, 0.9) : rand(0.4, 1.5);
      rocks.push({ x, z, y: height(x, z) - s * 0.25, s, sx: s * rand(0.9, 1.5), sy: s * rand(0.55, 0.9), sz: s * rand(0.9, 1.3), ry: rng() * TAU, rx: rand(-0.2, 0.2), color: pick(rockCols) });
      if (s > 0.6) obstacles.push({ x, z, r: s * 0.95 });
    }
    instanced(new THREE.IcosahedronGeometry(1, 0), weatherize(std('#ffffff'), 'std'), rocks, { cast: true });
  }

  // ───────────────────────── grass ─────────────────────────
  {
    const blades = [];
    const shape = [[-0.06, 0, 0], [0.06, 0, 0], [-0.04, 0.28, 0], [0.04, 0.28, 0], [0, 0.6, 0]];
    const shade = [0.55, 0.55, 0.85, 0.85, 1.2];
    const pos = [], colr = [], nrm = [], idx = [];
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI + rand(-0.3, 0.3);
      const ox = rand(-0.12, 0.12), oz = rand(-0.12, 0.12), hs = rand(0.75, 1.15);
      const base = pos.length / 3;
      shape.forEach((v, i) => {
        const x = v[0] * Math.cos(a), z = v[0] * Math.sin(a);
        pos.push(x + ox, v[1] * hs, z + oz);
        colr.push(shade[i], shade[i], shade[i]);
        nrm.push(0, 1, 0);
      });
      // both windings, so each side is front-facing and lit with the up-normal
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3, base + 2, base + 4, base + 3);
    }
    const tuft = new THREE.BufferGeometry();
    tuft.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tuft.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    tuft.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    tuft.setIndex(idx);

    const grassCols = ['#6f9c45', '#83ad4f', '#5d8a3e', '#9bb957', '#77a24a'].map(col);
    for (let i = 0; i < 26000; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 100;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (lakeT(x, z) < 1.1 || pathAmt(x, z) > 0.35 || nearChairs(x, z, 1.1)) continue;
      const h = height(x, z);
      if (h > 10) continue;
      if (fbm(x * 0.06 + 40, z * 0.06) < 0.38 && rng() < 0.6) continue;
      const s = rand(0.7, 1.35);
      blades.push({ x, z, y: h - 0.03, s, sy: s * rand(0.7, 1.15), ry: rng() * TAU, color: pick(grassCols) });
    }
    const grassMat = weatherize(addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.55), 'lam');
    world.grassMat = grassMat;
    world.grass = instanced(tuft, grassMat, blades, { cast: false });
  }

  // ───────────────────────── flowers ─────────────────────────
  {
    const flowers = [];
    const petals = ['#ffffff', '#f6d65a', '#f19cb7', '#b7a3e6', '#ff9f7a', '#fdf0b0'].map(col);
    for (let i = 0; i < 9000 && flowers.length < 1800; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 90;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (lakeT(x, z) < 1.14 || pathAmt(x, z) > 0.2 || nearChairs(x, z, 1.1)) continue;
      if (fbm(x * 0.07 + 20, z * 0.07 - 4) < 0.56) continue;
      const patch = Math.floor(vnoise(x * 0.15, z * 0.15) * petals.length) % petals.length;
      flowers.push({ x, z, y: height(x, z) - 0.02, s: rand(0.8, 1.4), ry: rng() * TAU, color: rng() < 0.8 ? petals[patch] : pick(petals) });
    }
    const stemMat = addWind(new THREE.MeshLambertMaterial({ color: '#4f7a36' }), 0.6);
    const headMat = weatherize(addWind(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.6), 'lam');
    world.flowerItems = flowers;
    world.flowerStem = instanced(new THREE.CylinderGeometry(0.012, 0.016, 0.38, 3).translate(0, 0.19, 0), stemMat, flowers);
    const head = new THREE.IcosahedronGeometry(0.075, 0).scale(1, 0.55, 1).translate(0, 0.39, 0);
    world.flowerHead = instanced(head, headMat, flowers);
  }

  // ───────────────────────── reeds & lily pads ─────────────────────────
  {
    const reeds = [];
    for (let c = 0; c < 26; c++) {
      const ca = rng() * TAU, ct = rand(0.93, 1.03);
      if (Math.abs(angDiff(ca, DOCK_A)) < 0.12) continue;
      for (let i = 0; i < 18; i++) {
        const p = lakePoint(ca + rand(-0.06, 0.06), ct + rand(-0.04, 0.04));
        const h = Math.max(height(p.x, p.z), -0.6);
        reeds.push({ x: p.x, z: p.z, y: h, s: rand(0.7, 1.25), rx: rand(-0.12, 0.12), rz: rand(-0.12, 0.12), ry: rng() * TAU, color: pick(['#6b7f3a', '#7f8f45', '#5a7034'].map(col)) });
      }
    }
    instanced(new THREE.ConeGeometry(0.035, 1.5, 3).translate(0, 0.75, 0), addWind(std('#ffffff'), 0.07), reeds);
    instanced(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 5).translate(0, 1.15, 0), addWind(std('#6e4a2e'), 0.07), reeds.filter((_, i) => i % 3 === 0));

    const pads = [], blooms = [];
    for (let c = 0; c < 9; c++) {
      const ca = rng() * TAU, ct = rand(0.45, 0.82);
      for (let i = 0; i < 6; i++) {
        const p = lakePoint(ca + rand(-0.08, 0.08), ct + rand(-0.06, 0.06));
        const s = rand(0.6, 1.1);
        pads.push({ x: p.x, z: p.z, y: 0.05, s, ry: rng() * TAU, color: pick(['#4f8a3c', '#5e9a46', '#447a36'].map(col)) });
        if (rng() < 0.3) blooms.push({ x: p.x + 0.15, z: p.z, y: 0.12, s: 1, color: pick(['#f7c6d6', '#ffffff', '#f3a8c3'].map(col)) });
      }
    }
    world.padItems = pads;
    world.padMesh = instanced(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 9, 1, false, 0.35, TAU - 0.35), std('#ffffff'), pads, { receive: true });
    world.bloomMesh = instanced(new THREE.IcosahedronGeometry(0.13, 0).scale(1, 0.6, 1), std('#ffffff', { emissive: '#3a2a30' }), blooms);
  }

  // ───────────────────────── dock, bench, lamps ─────────────────────────
  {
    const dock = new THREE.Group();
    dock.position.set(dockStart.x, 0, dockStart.z);
    dock.rotation.y = Math.atan2(dockDir.x, dockDir.z);
    const plankCols = ['#9b7653', '#8c6a4a', '#a7815c'];
    for (let s = -DOCK_BACK; s < DOCK_LEN; s += 0.56) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(DOCK_HALF * 2, 0.08, 0.5), weatherize(std(pick(plankCols)), 'std'));
      m.position.set(rand(-0.03, 0.03), DOCK_Y, s + 0.25);
      m.rotation.y = rand(-0.015, 0.015);
      m.castShadow = true; m.receiveShadow = true;
      dock.add(m);
    }
    for (let s = 0.5; s < DOCK_LEN; s += 2.8) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.4, 6), std('#6b4f3a'));
        post.position.set(side * (DOCK_HALF - 0.08), DOCK_Y - 0.9, s);
        post.castShadow = true;
        dock.add(post);
      }
    }
    scene.add(dock);

    const bp = world.benchPos = lakePoint(Math.PI / 2 - 0.5, 1.5);
    const bench = new THREE.Group();
    bench.position.set(bp.x, height(bp.x, bp.z), bp.z);
    bench.rotation.y = Math.atan2(LAKE.x - bp.x, LAKE.z - bp.z);
    const wood = weatherize(std('#8a6646'), 'std'), iron = std('#3a3f3f');
    const parts = [
      [new THREE.BoxGeometry(1.9, 0.07, 0.5), wood, 0, 0.48, 0, 0],
      [new THREE.BoxGeometry(1.9, 0.36, 0.06), wood, 0, 0.8, -0.24, -0.18],
      [new THREE.BoxGeometry(0.08, 0.5, 0.48), iron, -0.85, 0.24, 0, 0],
      [new THREE.BoxGeometry(0.08, 0.5, 0.48), iron, 0.85, 0.24, 0, 0],
    ];
    parts.forEach(([g, m, x, y, z, rx]) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.castShadow = true;
      bench.add(mesh);
    });
    scene.add(bench);
    obstacles.push({ x: bp.x, z: bp.z, r: 0.95 });
    seats.push({ name: 'bench', x: bp.x, z: bp.z, baseY: bench.position.y, top: 0.515, rot: bench.rotation.y, standOff: 1.35 });
  }

  // ───────────────────────── lawn chairs ─────────────────────────
  function makeChair(paint) {
    const g = new THREE.Group();
    const m = weatherize(std(paint), 'std');
    const add = (w, h, d, x, y, z, rx) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z); b.rotation.x = rx || 0;
      b.castShadow = true; b.receiveShadow = true;
      g.add(b);
    };
    [-0.3, 0.3].forEach((x) => {
      add(0.06, 0.62, 0.06, x * 1.18, 0.31, 0.22);           // front legs, up to the armrest
      add(0.06, 0.4, 0.06, x, 0.2, -0.24);                  // back legs
      add(0.1, 0.035, 0.66, x * 1.2, 0.63, 0.02);            // armrests
    });
    for (let i = 0; i < 4; i++) add(0.62, 0.035, 0.12, 0, 0.43 - i * 0.012, 0.2 - i * 0.135, -0.08); // seat slats
    for (let i = 0; i < 5; i++) add(0.1, 0.78, 0.03, -0.24 + i * 0.12, 0.8, -0.34, -0.32);           // back slats
    add(0.62, 0.06, 0.04, 0, 1.12, -0.46, -0.32);
    return g;
  }
  function placeChair(x, z, baseY, rot, paint) {
    const c = makeChair(paint);
    c.position.set(x, baseY, z);
    c.rotation.y = rot;
    scene.add(c);
    obstacles.push({ x, z, r: 0.45 });
    seats.push({ name: 'chair', x, z, baseY, top: 0.44, rot, standOff: 0.9 });
  }
  {
    const paints = ['#efe9dc', '#86aea6'];
    chairSpots.forEach((p, i) => {
      const rot = Math.atan2(LAKE.x - p.x, LAKE.z - p.z) + (i ? -0.12 : 0.12);
      placeChair(p.x, p.z, height(p.x, p.z) - 0.02, rot, paints[i]);
    });
    const s = DOCK_LEN - 1.9, w = -0.5;
    placeChair(dockStart.x + dockDir.x * s + dockDir.z * w, dockStart.z + dockDir.z * s - dockDir.x * w, DOCK_Y + 0.04, Math.atan2(dockDir.x, dockDir.z) - 0.35, '#d8a95e');
  }

  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffbb55', emissiveIntensity: 0, flatShading: true });
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glows = [];
  {
    const postMat = std('#2f3534');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.2;
      if (Math.abs(angDiff(a, DOCK_A)) < 0.2) continue;
      const p = lakePoint(a, PATH_T + 0.085);
      const y = height(p.x, p.z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.2, 6).translate(0, 1.1, 0), postMat);
      post.position.set(p.x, y, p.z); post.castShadow = true;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), lampMat);
      lamp.position.set(p.x, y + 2.35, p.z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 4).rotateY(Math.PI / 4), postMat);
      cap.position.set(p.x, y + 2.58, p.z);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffc979', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.copy(lamp.position); glow.scale.set(2.2, 2.2, 1);
      scene.add(post, lamp, cap, glow);
      glows.push(glow);
      obstacles.push({ x: p.x, z: p.z, r: 0.2 });
    }
  }

  // ───────────────────────── clouds ─────────────────────────
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, flatShading: true, roughness: 1, fog: false });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(5, 9), 1), cloudMat);
      m.position.set(k * rand(5, 7) - n * 3, rand(-1, 2), rand(-3, 3));
      m.scale.y = 0.55;
      g.add(m);
    }
    const a = rng() * TAU, r = rand(170, 300);
    g.position.set(Math.cos(a) * r, rand(75, 120), Math.sin(a) * r);
    g.rotation.y = rand(-0.3, 0.3);
    scene.add(g);
    clouds.push(g);
  }

  // ───────────────────────── fireflies ─────────────────────────
  const FF = 170;
  const ffSeed = [];
  for (let i = 0; i < FF; i++) ffSeed.push({ x: rand(-32, 32), z: rand(-32, 32), y: rand(0.4, 2.2), p: rng() * TAU, s: rand(0.5, 1.1) });
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FF * 3), 3));
  const ffMat = new THREE.PointsMaterial({ size: 0.32, map: glowTex, color: '#fff0a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  // ───────────────────────── butterflies ─────────────────────────
  const butterflies = [];
  {
    const wingGeoL = new THREE.PlaneGeometry(0.17, 0.13).translate(-0.085, 0, 0).rotateX(-Math.PI / 2);
    const wingGeoR = new THREE.PlaneGeometry(0.17, 0.13).translate(0.085, 0, 0).rotateX(-Math.PI / 2);
    const bodyMat = std('#2b2622');
    ['#f4c542', '#ffffff', '#f08ab0', '#8fc6f0', '#ffa552', '#f4c542', '#ffffff', '#c9a7f0', '#f08ab0', '#ffffff', '#8fc6f0', '#ffa552'].forEach((c) => {
      const wingMat = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.12), bodyMat);
      const L = new THREE.Mesh(wingGeoL, wingMat), R = new THREE.Mesh(wingGeoR, wingMat);
      g.add(body, L, R);
      scene.add(g);
      butterflies.push({ g, L, R, bx: rand(-26, 26), bz: rand(-26, 26), p: rng() * TAU, s: rand(0.6, 1.2), last: new THREE.Vector3() });
    });
  }

  // ───────────────────────── characters ─────────────────────────
  function enableShadows(obj) { obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  function box(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }

  function makePerson(c = {}) {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const skin = std(c.skin || '#e7b894'), knit = std(c.knit || '#e2b04a'), pants = std(c.pants || '#3c4a5e'), shoe = std(c.shoe || '#2c2a28'), hair = std(c.hair || '#4a3426'), scarf = std(c.scarf || '#3f7f7a');
    const legs = [], knees = [];
    [-0.13, 0.13].forEach((x) => {
      const hip = pivot(body, x, 0.86, 0);
      box(hip, 0.17, 0.42, 0.19, pants, 0, -0.21, 0);
      const knee = pivot(hip, 0, -0.42, 0);
      box(knee, 0.16, 0.38, 0.18, pants, 0, -0.19, 0);
      box(knee, 0.19, 0.1, 0.3, shoe, 0, -0.39, 0.05);
      legs.push(hip); knees.push(knee);
    });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 8), knit);
    torso.position.y = 1.2; body.add(torso);
    const arms = [-0.34, 0.34].map((x) => {
      const p = pivot(body, x, 1.5, 0);
      box(p, 0.13, 0.62, 0.15, knit, 0, -0.31, 0);
      const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), skin);
      hand.position.y = -0.66; p.add(hand);
      return p;
    });
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 6, 12), scarf);
    sc.rotation.x = Math.PI / 2; sc.position.y = 1.57; body.add(sc);
    const head = pivot(body, 0, 1.8, 0);
    head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), skin));
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 8, 0, TAU, 0, Math.PI * 0.55), hair);
    h.position.set(0, 0.02, -0.02); h.rotation.x = -0.2; head.add(h);
    const eyeMat = std('#2a2220');
    box(head, 0.035, 0.05, 0.02, eyeMat, -0.075, 0.0, 0.2);
    box(head, 0.035, 0.05, 0.02, eyeMat, 0.075, 0.0, 0.2);
    enableShadows(root);
    return { root, body, legs, knees, arms, head };
  }

  function makeDog(c) {
    const root = new THREE.Group();
    const rig = new THREE.Group(); root.add(rig);
    const coat = std(c.coat), accent = std(c.accent), ear = std(c.ear), dark = std('#1d1b1a');
    box(rig, 0.4, 0.36, 0.9, coat, 0, 0.62, 0);
    box(rig, 0.3, 0.26, 0.2, accent, 0, 0.56, 0.38);
    const head = pivot(rig, 0, 0.9, 0.5);
    box(head, 0.34, 0.32, 0.36, coat, 0, 0, 0);
    box(head, 0.2, 0.16, 0.22, accent, 0, -0.06, 0.26);
    box(head, 0.08, 0.06, 0.04, dark, 0, -0.01, 0.38);
    const eyes = [box(head, 0.04, 0.04, 0.02, dark, -0.09, 0.06, 0.18), box(head, 0.04, 0.04, 0.02, dark, 0.09, 0.06, 0.18)];
    [-1, 1].forEach((s) => { const e = box(head, 0.08, 0.22, 0.15, ear, s * 0.18, 0.02, -0.03); e.rotation.z = s * 0.28; });
    const legs = [[-0.13, 0.3], [0.13, 0.3], [-0.13, -0.3], [0.13, -0.3]].map(([x, z]) => {
      const p = pivot(rig, x, 0.46, z);
      box(p, 0.12, 0.46, 0.12, coat, 0, -0.23, 0);
      return p;
    });
    const tail = pivot(rig, 0, 0.74, -0.44);
    const t = box(tail, 0.07, 0.07, 0.4, coat, 0, 0, -0.2);
    tail.rotation.x = -0.6; void t;
    enableShadows(root);
    return { root, rig, head, legs, tail, eyes, sitDrop: 0.12, scale: c.scale || 1 };
  }

  function makeCat(c) {
    const root = new THREE.Group();
    const rig = new THREE.Group(); root.add(rig);
    const fur = std(c.fur), belly = std(c.belly), dark = std('#1d1b1a'), nose = std('#e79aa6'), eye = std(c.eye || '#a6c43b');
    box(rig, 0.26, 0.25, 0.6, fur, 0, 0.37, 0);
    box(rig, 0.2, 0.06, 0.4, belly, 0, 0.25, 0.02);
    const head = pivot(rig, 0, 0.55, 0.35);
    box(head, 0.26, 0.21, 0.23, fur, 0, 0, 0);
    box(head, 0.12, 0.08, 0.06, belly, 0, -0.05, 0.12);
    box(head, 0.035, 0.025, 0.02, nose, 0, -0.02, 0.155);
    const eyes = [box(head, 0.045, 0.04, 0.02, eye, -0.065, 0.03, 0.12), box(head, 0.045, 0.04, 0.02, eye, 0.065, 0.03, 0.12)];
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), fur);
      e.position.set(s * 0.085, 0.15, -0.01); e.rotation.y = Math.PI / 4; head.add(e);
    });
    const legs = [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]].map(([x, z]) => {
      const p = pivot(rig, x, 0.28, z);
      box(p, 0.075, 0.28, 0.075, fur, 0, -0.14, 0);
      return p;
    });
    void dark;
    const tail = pivot(rig, 0, 0.44, -0.29);
    box(tail, 0.055, 0.055, 0.46, fur, 0, 0, -0.22);
    tail.rotation.x = -0.95;
    enableShadows(root);
    return { root, rig, head, legs, tail, eyes, sitDrop: 0.08, scale: 1 };
  }

  // ───────────────────────── player ─────────────────────────
  const hero = makePerson();
  scene.add(hero.root);
  const umbrella = new THREE.Group();
  {
    const cloth = std('#2f6f73', { side: THREE.DoubleSide }), trim = std('#e9e2d0'), dark = std('#2b2622');
    umbrella.add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.2, 5).translate(0, 0.6, 0), dark),
      new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.34, 8, 1, true).translate(0, 1.36, 0), cloth),
      new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5).translate(0, 1.58, 0), trim),
      new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 4, 8, Math.PI).rotateZ(Math.PI).translate(0.05, 0, 0), dark)
    );
    umbrella.position.set(0, -0.64, 0);
    umbrella.rotation.order = 'ZYX'; // set to the inverse of the arm's rotation so the shaft stays upright
    umbrella.visible = false;
    enableShadows(umbrella);
    hero.arms[0].add(umbrella);
  }

  // ───────────────────────── bamboo boat & skipper ─────────────────────────
  const dockAt = (sv, wv) => ({ x: dockStart.x + dockDir.x * sv + dockDir.z * wv, z: dockStart.z + dockDir.z * sv - dockDir.x * wv });
  const BOAT_DECK = 0.14;
  const MOOR = dockAt(DOCK_LEN + 0.85, 0);        // moored across the end of the jetty
  const BOARD_POINT = dockAt(DOCK_LEN - 0.55, 0);
  const T_MOOR = lakeT(MOOR.x, MOOR.z);
  // The tour: one calm loop around the lake that starts and ends at the mooring
  const boatPath = (() => {
    const pts = [], N = 28;
    for (let i = 0; i < N; i++) {
      const p = i === 0 ? MOOR : lakePoint(DOCK_A + (i / N) * TAU, T_MOOR);
      pts.push(new THREE.Vector3(p.x, 0, p.z));
    }
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  })();
  const BOAT_PATH_LEN = boatPath.getLength();

  const boat = new THREE.Group();
  boat.rotation.order = 'YXZ';
  scene.add(boat);
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#f08a4b', emissive: '#ff8a3d', emissiveIntensity: 0, flatShading: true });
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb070', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const lanternPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: '#ffa860', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const lanternLight = new THREE.PointLight('#ffb070', 0, 9, 2);
  {
    const bambooA = weatherize(std('#b9a35e'), 'std'), bambooB = weatherize(std('#a89050'), 'std');
    const weave = weatherize(std('#8f7446', { side: THREE.DoubleSide }), 'std');
    const deckMat = weatherize(std('#7c5f3a'), 'std');
    const dark = std('#3a2e22');
    const add = (mesh, x, y, z, rx) => { mesh.position.set(x, y, z); if (rx) mesh.rotation.x = rx; mesh.castShadow = true; mesh.receiveShadow = true; boat.add(mesh); return mesh; };
    const pole = (r, len, m) => new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 7).rotateX(Math.PI / 2), m);
    // hull: bamboo poles laid in a shallow U, outer ones shorter for a pointed plan
    const xs = [-0.56, -0.38, -0.19, 0, 0.19, 0.38, 0.56], ys = [0.17, 0.07, 0.01, -0.01, 0.01, 0.07, 0.17];
    xs.forEach((x, i) => add(pole(0.085, 5.0 - Math.abs(x) * 1.6, i % 2 ? bambooA : bambooB), x, ys[i], 0));
    [1, -1].forEach((d) => { // upturned bow and stern
      for (let i = -1; i <= 1; i++) add(pole(0.075, 1.1, i ? bambooA : bambooB), i * 0.16, 0.24, d * 2.78, -d * 0.42);
    });
    [-2.1, -1.0, 0.2, 1.4, 2.2].forEach((z) => add(new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.05, 0.06), dark), 0, 0.2, z)); // lashings
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 4.3), deckMat), 0, BOAT_DECK - 0.02, 0);
    [-0.66, 0.66].forEach((x) => add(pole(0.05, 4.4, bambooA), x, 0.3, 0));
    // woven bamboo-mat canopy over the middle, on four posts
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 12, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), weave), 0, 1.15, -0.55);
    [-0.7, 0.7].forEach((x) => [-1.25, 0.15].forEach((z) => add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.02, 5), bambooA), x, BOAT_DECK + 0.51, z)));
    // passenger bench (front, open to the view) and the skipper's stern seat
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.4), deckMat), 0, BOAT_DECK + 0.45, 0.75);
    [-0.42, 0.42].forEach((x) => add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.3), deckMat), x, BOAT_DECK + 0.21, 0.75));
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.32), deckMat), 0, BOAT_DECK + 0.37, -1.85);
    [-0.34, 0.34].forEach((x) => add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.26), deckMat), x, BOAT_DECK + 0.17, -1.85));
    // paper lantern on the front canopy post
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3), dark), 0.7, 1.43, 0.15);
    const lantern = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 8), lanternMat), 0.7, 1.22, 0.15);
    lantern.castShadow = false;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.04, 8), dark), 0.7, 1.37, 0.15);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.04, 8), dark), 0.7, 1.07, 0.15);
    lanternGlow.position.set(0.7, 1.22, 0.15); lanternGlow.scale.set(1.5, 1.5, 1);
    lanternPool.position.set(0.95, -0.01, 0.15); lanternPool.scale.set(3.4, 1, 3.4);
    lanternLight.position.set(0.7, 1.2, 0.15);
    boat.add(lanternGlow, lanternPool, lanternLight);
  }

  // Skipper: older boatman in a conical bamboo hat
  const skipper = makePerson({ skin: '#d6a27c', knit: '#5d6b4c', pants: '#3b3530', shoe: '#2a2522', hair: '#9a958e', scarf: '#b88b4a' });
  {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.26, 12).translate(0, 0.2, 0), weatherize(std('#d9c07e'), 'std'));
    hat.castShadow = true;
    skipper.head.add(hat);
  }
  const skPole = new THREE.Group();
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 4.6, 6).translate(0, -1.3, 0), std('#a8924e'));
    m.castShadow = true;
    skPole.add(m);
    skPole.position.set(0.1, 1.15, 0.3);
    skipper.body.add(skPole);
  }
  skipper.root.position.set(0, BOAT_DECK, -1.85);
  boat.add(skipper.root);

  // Wake: a soft V of foam trailing the stern
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAmt: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) } }]),
    transparent: true, depthWrite: false, fog: true,
    vertexShader: `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uAmt; uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float x = vUv.x * 2.0 - 1.0;
        float y = vUv.y;
        float edge = abs(abs(x) - (0.12 + y * 0.85));
        float foam = smoothstep(0.07, 0.0, edge) * (0.55 + 0.45 * sin(y * 40.0 - uTime * 6.0 + x * 8.0));
        float trail = smoothstep(0.25, 0.0, abs(x)) * smoothstep(0.5, 0.0, y) * 0.35;
        gl_FragColor = vec4(uColor, (foam + trail) * pow(1.0 - y, 1.5) * uAmt * 0.55);
        #include <fog_fragment>
      }`,
  });
  {
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(6, 10).rotateX(-Math.PI / 2), wakeMat);
    wake.position.set(0, -0.015, -7.4);
    wake.renderOrder = 2;
    boat.add(wake);
  }

  // Ripple rings for pole pushes and the bow
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 18, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const ripples = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 2;
    scene.add(m);
    ripples.push({ m, life: 0, size: 1 });
  }
  function spawnRipple(x, z, size) {
    const r = ripples.find((q) => q.life <= 0);
    if (!r) return;
    r.m.position.set(x, 0.045, z); r.life = 1.6; r.size = size; r.m.visible = true;
  }
  function updateRipples(dt) {
    const shade = 0.35 + 0.65 * Math.max(cur.day, 0.15);
    for (const r of ripples) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.m.visible = false; continue; }
      const age = 1.6 - r.life, sc = (0.3 + age * 1.5) * r.size;
      r.m.scale.set(sc, 1, sc);
      r.m.material.opacity = (r.life / 1.6) * 0.55;
      r.m.material.color.setScalar(shade);
    }
  }
  function splashSound(x, z, vol) {
    if (!audio.ctx || !audio.on) return;
    const near = clamp(1 - Math.hypot(x - player.x, z - player.z) / 25, 0, 1);
    if (near <= 0) return;
    const ctx = audio.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = audio.whiteBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(700, 1100); bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol * near, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    src.connect(bp).connect(g).connect(audio.master);
    src.start(t0, rand(0, 3)); src.stop(t0 + 0.4);
  }

  const ferry = { state: 'docked', dist: 0, speed: 0, timer: 0, dockedT: 10, bowT: 0, rideT: 0 };
  const boatSeat = { name: 'boat', boat: true, x: MOOR.x, z: MOOR.z, baseY: BOAT_DECK, top: 0.48, rot: 0, standOff: 0, standTo: BOARD_POINT };
  const sk = { sit: 1, wave: 0, waveT: 0, waved: false, nod: 0, phase: 0, prevSin: 0, look: 0, pole: 0 };
  const bpV = new THREE.Vector3(), btV = new THREE.Vector3(), tmpV = new THREE.Vector3();

  function boardBoat() {
    sitDown(boatSeat);
    ferry.state = 'boarding';
    ferry.timer = 2.6;
    sk.nod = 0.9; sk.waveT = 0;
  }

  function updateBoat(dt, t) {
    const aboard = player.seat === boatSeat;
    if (ferry.state === 'boarding') {
      if (!aboard) ferry.state = 'docked';
      else { ferry.timer -= dt; if (ferry.timer <= 0 && player.sitAmt > 0.8) { ferry.state = 'touring'; ferry.dist = 0; ferry.rideT = 0; } }
    } else if (ferry.state === 'touring') {
      ferry.rideT += dt; // ease away from the jetty over ~5 s, glide in over the last few metres
      ferry.speed = 0.2 + 1.4 * smooth(0, 5, ferry.rideT) * smooth(0, 7, BOAT_PATH_LEN - ferry.dist);
      ferry.dist += ferry.speed * dt;
      if (ferry.dist >= BOAT_PATH_LEN - 0.03) { ferry.dist = 0; ferry.state = 'docked'; ferry.speed = 0; ferry.dockedT = 0; }
    } else {
      ferry.speed = 0;
      ferry.dockedT += dt;
    }

    const u = (ferry.dist / BOAT_PATH_LEN) % 1;
    boatPath.getPointAt(u, bpV);
    boatPath.getTangentAt(u, btV);
    const yaw = Math.atan2(btV.x, btV.z);
    boat.position.set(bpV.x, 0.04 + Math.sin(t * 1.3) * 0.025, bpV.z);
    boat.rotation.set(Math.sin(t * 0.7) * 0.012 - ferry.speed * 0.01, yaw, Math.sin(t * 0.9) * 0.022);
    boat.updateMatrixWorld();
    tmpV.set(0, 0, 0.85); boat.localToWorld(tmpV);
    boatSeat.x = tmpV.x; boatSeat.z = tmpV.z; boatSeat.rot = yaw; boatSeat.baseY = boat.position.y + BOAT_DECK;

    // skipper: rests at the jetty, waves when you come by, nods as you board, poles on the tour
    tmpV.set(0, 0, -1.85); boat.localToWorld(tmpV);
    const dxp = player.x - tmpV.x, dzp = player.z - tmpV.z, dPlayer = Math.hypot(dxp, dzp);
    if (!aboard && dPlayer < 7 && !sk.waved && ferry.state === 'docked') { sk.waved = true; sk.waveT = 2.4; }
    if (dPlayer > 12) sk.waved = false;
    sk.waveT = Math.max(0, sk.waveT - dt);
    sk.wave = damp(sk.wave, sk.waveT > 0 ? 1 : 0, 6, dt);
    sk.nod = Math.max(0, sk.nod - dt);
    sk.sit = damp(sk.sit, ferry.state === 'docked' && !aboard && ferry.dockedT > 2.5 ? 1 : 0, 2.5, dt);
    sk.pole = damp(sk.pole, ferry.state === 'touring' ? 1 : 0, 2, dt);
    sk.phase += dt * (0.6 + ferry.speed * 1.6);
    const sn = Math.sin(sk.phase), push = 0.5 + 0.5 * sn;
    const lookTarget = dPlayer < 10 ? clamp(angDiff(yaw, Math.atan2(dxp, dzp)), -1.1, 1.1) : Math.sin(t * 0.3) * 0.5;
    sk.look = damp(sk.look, aboard ? 0 : lookTarget, 3, dt);
    poseSkipper(push, t);

    if (ferry.state === 'touring' && ferry.speed > 0.3) {
      if (sk.prevSin <= 0 && sn > 0) { // the pole bites the water
        tmpV.set(0, -3.4, 0); skPole.localToWorld(tmpV);
        spawnRipple(tmpV.x, tmpV.z, 1.1);
        splashSound(tmpV.x, tmpV.z, 0.12);
      }
      ferry.bowT -= dt;
      if (ferry.bowT <= 0) { tmpV.set(0, 0, 2.6); boat.localToWorld(tmpV); spawnRipple(tmpV.x, tmpV.z, 0.7); ferry.bowT = 0.55; }
    }
    sk.prevSin = sn;

    wakeMat.uniforms.uAmt.value = clamp(ferry.speed / 1.3, 0, 1);
    wakeMat.uniforms.uTime.value = t;
    wakeMat.uniforms.uColor.value.setScalar(0.35 + 0.65 * Math.max(cur.day, 0.15));
    const eve = cur.eve;
    lanternMat.emissiveIntensity = eve * 1.8;
    lanternGlow.material.opacity = eve * 0.8;
    lanternPool.material.opacity = eve * 0.45;
    lanternLight.intensity = eve * 1.4;
  }

  function poseSkipper(push, t) {
    const S = skipper, s = sk.sit, st = 1 - s, pp = sk.pole * st;
    S.legs[0].rotation.x = lerp(0.2 - pp * push * 0.15, -1.5, s);
    S.legs[1].rotation.x = lerp(-0.25 + pp * push * 0.1, -1.45, s);
    S.knees[0].rotation.x = lerp(0.12 + pp * 0.2, 1.5, s);
    S.knees[1].rotation.x = lerp(0.18, 1.45, s);
    S.body.position.y = lerp(-0.03 * pp * push, 0.40 + 0.07 - 0.86, s);
    S.body.rotation.x = lerp(0.06 + pp * (0.1 + push * 0.22), -0.04, s);
    S.arms[0].rotation.x = lerp(lerp(-0.25, -1.25 + push * 0.55, sk.pole), -0.55, s);
    S.arms[1].rotation.x = lerp(lerp(-0.2, -0.95 + push * 0.55, sk.pole), -0.5, s);
    S.arms[0].rotation.z = lerp(-0.06, 0.38, sk.pole * st);
    S.arms[1].rotation.z = lerp(0.06, -0.3, sk.pole * st);
    if (sk.wave > 0.01) {
      S.arms[1].rotation.x = lerp(S.arms[1].rotation.x, -2.75, sk.wave);
      S.arms[1].rotation.z = lerp(S.arms[1].rotation.z, -0.2 + Math.sin(t * 9) * 0.45, sk.wave);
    }
    skPole.visible = st > 0.5;
    skPole.rotation.x = 0.12 + push * 0.5 * sk.pole;
    S.head.rotation.x = sk.nod > 0 ? Math.sin(((0.9 - sk.nod) / 0.9) * TAU) * 0.35 : 0;
    S.head.rotation.y = sk.look;
  }
  const player = { x: SPAWN.x, z: SPAWN.z, y: height(SPAWN.x, SPAWN.z), rot: 0, phase: 0, move: 0, seat: null, sitAmt: 0, seatTop: 0.44, slide: null, petting: null, petTimer: 0, petAmt: 0, heartT: 0, umbAmt: 0 };
  player.rot = Math.atan2(LAKE.x - SPAWN.x, LAKE.z - SPAWN.z);

  // ───────────────────────── animals ─────────────────────────
  const animals = [];
  function spotNear(cx, cz, r) {
    for (let i = 0; i < 40; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * r;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (animalWalkable(x, z)) return { x, z };
    }
    return { x: cx, z: cz };
  }
  function addAnimal(kind, rigData, near, range) {
    const p = spotNear(near.x, near.z, 6);
    rigData.root.scale.setScalar(rigData.scale);
    rigData.root.position.set(p.x, height(p.x, p.z), p.z);
    scene.add(rigData.root);
    animals.push(Object.assign(rigData, {
      kind, home: { x: p.x, z: p.z }, range, x: p.x, z: p.z,
      state: 'idle', timer: rand(1, 5), sitting: rng() < 0.5, target: null,
      heading: rng() * TAU, speed: 0, phase: rng() * TAU, sit: 0, wag: 0.3, look: 0, side: rng() * TAU,
      bond: 0, petted: false, petAmt: 0, purr: null, shake: 0, shakeDelay: 0,
      radius: kind === 'dog' ? 0.42 * (rigData.scale || 1) : 0.28, nudgeT: 0,
    }));
  }
  const homeA = lakePoint(Math.PI / 2 + 0.12, 1.2);
  const homeB = lakePoint(Math.PI / 2 - 0.18, 1.22);
  const homeC = lakePoint(Math.PI, 1.6);
  addAnimal('dog', makeDog({ coat: '#d9a65a', accent: '#f2dcb0', ear: '#b9853f' }), homeA, 22);
  addAnimal('dog', makeDog({ coat: '#3a3330', accent: '#e9e2d6', ear: '#2a2523', scale: 0.85 }), homeB, 20);
  addAnimal('dog', makeDog({ coat: '#f1ece2', accent: '#ffffff', ear: '#8a5a3a', scale: 0.72 }), homeC, 18);
  addAnimal('cat', makeCat({ fur: '#e0954a', belly: '#f6dcb8' }), homeA, 12);
  addAnimal('cat', makeCat({ fur: '#7f8288', belly: '#c9cbd0', eye: '#d9c14a' }), homeB, 12);
  addAnimal('cat', makeCat({ fur: '#2a2726', belly: '#3a3634', eye: '#d6c23a' }), lakePoint(Math.PI / 2 - 0.5, 1.5), 9);
  addAnimal('cat', makeCat({ fur: '#f3efe7', belly: '#ffffff', eye: '#7fb6d9' }), homeC, 12);

  function pickTarget(a) {
    const dp = Math.hypot(player.x - a.x, player.z - a.z);
    if (a.kind === 'cat' && a.bond > 0.2 && dp < 30 && rng() < a.bond * 0.7) {
      for (let i = 0; i < 12; i++) {
        const ang = rng() * TAU, x = player.x + Math.cos(ang) * 1.2, z = player.z + Math.sin(ang) * 1.2;
        if (animalWalkable(x, z)) { a.target = { x, z }; a.state = 'walk'; return; }
      }
    }
    const p = spotNear(a.home.x, a.home.z, a.range);
    a.target = p;
    a.state = 'walk';
  }

  function updateAnimal(a, dt, t) {
    const dxp = player.x - a.x, dzp = player.z - a.z;
    const dp = Math.hypot(dxp, dzp);
    let want = 0, wantSit = 0;

    a.petAmt = damp(a.petAmt, a.petted ? 1 : 0, 4, dt);

    if (a.petted) {
      // being petted: turn to face you and settle down
      a.heading = turnTo(a.heading, Math.atan2(dxp, dzp), dt * 3);
      wantSit = 1;
    } else if (a.goal) {
      const g = a.goal, d = Math.hypot(g.x - a.x, g.z - a.z);
      a.state = 'goal';
      a.target = { x: g.x, z: g.z };
      if (d > 0.4) want = d > 6 ? (a.kind === 'dog' ? 3.2 : 2.0) : (a.kind === 'dog' ? 1.6 : 1.0);
      else {
        wantSit = g.sit === false ? 0 : 1;
        if (g.faceX !== undefined) a.heading = turnTo(a.heading, Math.atan2(g.faceX - a.x, g.faceZ - a.z), dt * 3);
      }
    } else if (a.kind === 'cat' && (wx.rain > 0.35 || wx.storm > 0.3)) {
      // cats hurry under the nearest tree and curl up until the rain passes
      if (a.state !== 'shelter' || !a.target) { a.target = shelterSpot(a); a.state = 'shelter'; }
      const d = Math.hypot(a.target.x - a.x, a.target.z - a.z);
      if (d > 0.45) want = d > 3 ? 2.2 : 1.1;
      else wantSit = 1;
    } else {
      if (a.state === 'shelter' || a.state === 'goal') { a.state = 'idle'; a.timer = rand(2, 6); a.sitting = false; a.home = { x: a.x, z: a.z }; }
      if (a.kind === 'dog') {
        if (a.state !== 'follow' && dp < 8 + a.bond * 10 && rng() < dt * (0.35 + a.bond * 1.5)) { a.state = 'follow'; a.timer = rand(18, 40) * (1 + a.bond * 2); }
        if (a.state === 'follow') {
          a.timer -= dt;
          if (dp > 26 + a.bond * 20 || a.timer <= 0) { a.state = 'idle'; a.timer = rand(2, 5); a.home = { x: a.x, z: a.z }; }
          else {
            if (player.move > 0.1) a.side += dt * 0.05; // spot beside you only drifts while you walk
          for (const o of animals) { // followers fan out: each dog makes room for the ones before it
            if (o === a) break;
            if (o.state !== 'follow') continue;
            const df = angDiff(o.side, a.side);
            if (Math.abs(df) < 1.2) a.side += (df >= 0 ? 1 : -1) * dt * 1.5; // step away from the other dog
          }
            const tx = player.x + Math.cos(a.side) * 2.3, tz = player.z + Math.sin(a.side) * 2.3;
            a.target = { x: tx, z: tz };
            const d = Math.hypot(tx - a.x, tz - a.z);
            const settle = a.sit > 0.5 ? 1.8 : 0.7; // a seated dog stays put until you actually move off
            if (d > settle) want = d > 5 ? 4.4 : Math.min(2.4, d * 1.1);
            else wantSit = player.move < 0.1 ? 1 : 0;
          }
        }
      } else if (dp < 2.8 && a.state !== 'rest' && !(a.nudgeT > 0)) {
        a.state = 'rest'; a.timer = rand(5, 10) * (1 + a.bond * 2);
      }

      if (a.state === 'walk') {
        const d = Math.hypot(a.target.x - a.x, a.target.z - a.z);
        if (d < 0.5) { a.state = 'idle'; a.timer = rand(3, 10); a.sitting = rng() < 0.65; }
        else want = a.kind === 'dog' ? 1.5 : 0.75;
      }
      if (a.state === 'idle' || a.state === 'rest') {
        a.timer -= dt;
        if (a.sitting || a.state === 'rest') wantSit = 1;
        if (a.timer <= 0) pickTarget(a);
      }
    }

    // Pose gates movement: sit only once stopped, and stand fully before walking or turning.
    const sitTarget = want > 0 || a.speed > 0.15 ? 0 : wantSit;
    a.sit = damp(a.sit, sitTarget, sitTarget > a.sit ? 3.5 : 7, dt);
    if (a.sit < 0.02) a.sit = sitTarget > 0 ? a.sit : 0;
    const canMove = a.sit < 0.12;
    if (want > 0 && a.target && canMove) {
      const ang = Math.atan2(a.target.x - a.x, a.target.z - a.z);
      a.heading = turnTo(a.heading, ang, dt * 4);
      want *= Math.max(0, 1 - Math.abs(angDiff(a.heading, ang)) / 1.3);
    }
    a.speed = damp(a.speed, canMove ? want : 0, 5, dt);
    if (a.speed < 0.01 && !canMove) a.speed = 0;
    const step = a.speed * clamp(1 - a.sit * 10, 0, 1) * dt; // no travel once the sit has begun
    const nx = a.x + Math.sin(a.heading) * step, nz = a.z + Math.cos(a.heading) * step;
    if (animalWalkable(nx, nz)) { a.x = nx; a.z = nz; }
    else if (a.state === 'walk') pickTarget(a);
    const p = { x: a.x, z: a.z };
    pushOut(p, 0.25);
    a.x = p.x; a.z = p.z;

    a.root.position.set(a.x, damp(a.root.position.y, groundAt(a.x, a.z), 10, dt), a.z);
    a.root.rotation.y = a.heading;

    a.phase += dt * a.speed * (a.kind === 'dog' ? 5.2 : 8);
    const amp = Math.min(1, a.speed / 1.2) * 0.7;
    const sw = Math.sin(a.phase) * amp;
    a.legs[0].rotation.x = sw + a.sit * 0.45;
    a.legs[1].rotation.x = -sw + a.sit * 0.45;
    a.legs[2].rotation.x = -sw - a.sit * 1.25;
    a.legs[3].rotation.x = sw - a.sit * 1.25;
    a.rig.rotation.x = -0.45 * a.sit;
    a.rig.position.y = -a.sitDrop * a.sit;
    a.rig.position.y += Math.abs(Math.sin(a.phase)) * 0.025 * amp;

    if (a.kind === 'dog') {
      a.wag = damp(a.wag, a.petted ? 1.7 : a.state === 'follow' || dp < 5 ? 1 : 0.25, 3, dt);
      a.tail.rotation.y = Math.sin(t * (13 + a.petAmt * 5)) * 0.6 * a.wag;
    } else {
      a.tail.rotation.y = Math.sin(t * (1.3 - a.petAmt * 0.6) + a.side) * (0.35 + a.petAmt * 0.25);
    }
    const lookTarget = dp < 6 ? clamp(angDiff(a.heading, Math.atan2(dxp, dzp)), -0.9, 0.9) : Math.sin(t * 0.4 + a.side) * 0.3;
    a.look = damp(a.look, lookTarget, 3, dt);
    a.head.rotation.y = a.look;
    a.head.rotation.x = a.sit * 0.25 - a.petAmt * (a.kind === 'dog' ? 0.6 : 0.45); // looks up at you
    a.head.rotation.z = Math.sin(t * 1.7 + a.side) * 0.18 * a.petAmt;             // happy head tilt
    const squint = 1 - a.petAmt * (a.kind === 'cat' ? 0.85 : 0.55);                // content, half-closed eyes
    a.eyes[0].scale.y = squint; a.eyes[1].scale.y = squint;
    a.rig.rotation.z = 0;
    if (a.shake > 0) { // dogs shake the water off once the rain stops
      if (a.shakeDelay > 0) a.shakeDelay -= dt;
      else {
        a.shake -= dt;
        const e = Math.sin(Math.PI * clamp(a.shake / 1.1, 0, 1));
        a.rig.rotation.z = Math.sin(t * 42) * 0.3 * e;
        a.head.rotation.z += Math.sin(t * 42 + 1.2) * 0.35 * e;
      }
    }
  }

  // Keep animals from walking into each other or into you. Only an animal that is up and about gets
  // nudged; if two have settled on top of each other, one gets up and walks a step aside instead.
  function separateAnimals(dt) {
    const free = (a) => a.speed > 0.1 || a.sit < 0.1;
    const shove = (a, dx, dz) => { const x = a.x + dx, z = a.z + dz; if (animalWalkable(x, z)) { a.x = x; a.z = z; a.root.position.x = x; a.root.position.z = z; } };
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i];
      if (a.nudgeT > 0) a.nudgeT -= dt;
      // you
      const px = a.x - player.x, pz = a.z - player.z, pd = Math.hypot(px, pz), pmin = a.radius + 0.3;
      if (pd < pmin && pd > 1e-4 && free(a) && !a.petted) shove(a, (px / pd) * (pmin - pd), (pz / pd) * (pmin - pd));
      for (let j = i + 1; j < animals.length; j++) {
        const b = animals[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d >= min) continue;
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, over = min - d;
        const fa = free(a), fb = free(b);
        if (!fa && !fb) {
          const mover = !b.goal && !b.petted ? b : !a.goal && !a.petted ? a : null;
          if (!mover || mover.nudgeT > 0) continue;
          const s = mover === b ? 1 : -1;
          if (mover.state === 'follow') mover.side += 1.3;
          else { mover.target = spotNear(mover.x + nx * s * 1.4, mover.z + nz * s * 1.4, 0.6); mover.state = 'walk'; }
          mover.nudgeT = 3;
          continue;
        }
        const wa = fa ? (fb ? 0.5 : 1) : 0, wb = fb ? (fa ? 0.5 : 1) : 0;
        shove(a, -nx * over * wa, -nz * over * wa);
        shove(b, nx * over * wb, nz * over * wb);
      }
    }
  }

  function shelterSpot(a) {
    let best = null, bd = 45;
    for (const tr of treeSpots) {
      const d = Math.hypot(tr.x - a.x, tr.z - a.z);
      if (d < bd) { bd = d; best = tr; }
    }
    if (!best) return { x: a.x, z: a.z };
    const base = Math.atan2(a.z - best.z, a.x - best.x), r = 0.32 * best.s + 0.45;
    for (let i = 0; i < 8; i++) {
      const ang = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.6;
      const x = best.x + Math.cos(ang) * r, z = best.z + Math.sin(ang) * r;
      if (animalWalkable(x, z)) return { x, z };
    }
    return { x: a.x, z: a.z };
  }

  // ───────────────────────── time of day (follows the real clock) ─────────────────────────
  const NIGHT = { top: '#0a1330', horizon: '#1b2747', glow: '#000000', light: '#9fb6ff', lightI: 0.34, hemiSky: '#2b3b6b', hemiGround: '#14181f', hemiI: 0.34, amb: 0.1, deep: '#0a1a2e', shallow: '#1a3350', cloud: '#2b3654', fogNear: 30, fogFar: 170, day: 0, eve: 1, stars: 1 };
  const KEYFRAMES = [
    Object.assign({ h: 0 }, NIGHT),
    Object.assign({ h: 4.8 }, NIGHT),
    { h: 5.9, top: '#2e3f73', horizon: '#d98a8a', glow: '#ff9a7a', light: '#ffb08a', lightI: 0.4, hemiSky: '#6a6a9a', hemiGround: '#3a3a38', hemiI: 0.4, amb: 0.1, deep: '#22305a', shallow: '#7a5a78', cloud: '#d99aa0', fogNear: 30, fogFar: 180, day: 0.3, eve: 0.5, stars: 0.35 },
    { h: 7.2, top: '#86b4e2', horizon: '#f2d0b6', glow: '#ffd7a6', light: '#ffd7a6', lightI: 1.05, hemiSky: '#c9dcf2', hemiGround: '#7a7651', hemiI: 0.5, amb: 0.12, deep: '#2e6276', shallow: '#6aa3a6', cloud: '#ffe7d8', fogNear: 45, fogFar: 210, day: 1, eve: 0, stars: 0 },
    { h: 12.5, top: '#3f86d4', horizon: '#cfe5f4', glow: '#fff6e6', light: '#fff6e6', lightI: 0.92, hemiSky: '#cfe3f7', hemiGround: '#6f7c48', hemiI: 0.42, amb: 0.08, deep: '#1b6a85', shallow: '#4cb0b7', cloud: '#ffffff', fogNear: 60, fogFar: 260, day: 1, eve: 0, stars: 0 },
    { h: 16.3, top: '#5a92d6', horizon: '#e6dcc0', glow: '#ffe0a8', light: '#ffe2b0', lightI: 1.0, hemiSky: '#d2e2f0', hemiGround: '#748048', hemiI: 0.46, amb: 0.1, deep: '#1d6480', shallow: '#5aa8ac', cloud: '#fff2dc', fogNear: 55, fogFar: 240, day: 1, eve: 0, stars: 0 },
    { h: 18.4, top: '#36427e', horizon: '#f39a6b', glow: '#ff9a5c', light: '#ff9a5c', lightI: 1.05, hemiSky: '#8f7db8', hemiGround: '#4f4436', hemiI: 0.52, amb: 0.15, deep: '#27315c', shallow: '#9a6478', cloud: '#ffb08c', fogNear: 35, fogFar: 190, day: 0.15, eve: 0.85, stars: 0 },
    { h: 19.4, top: '#1c2452', horizon: '#7a5a8a', glow: '#ff7a5a', light: '#8a8ac8', lightI: 0.34, hemiSky: '#4a4a80', hemiGround: '#22222a', hemiI: 0.38, amb: 0.1, deep: '#141c3a', shallow: '#3a3a5a', cloud: '#5a4a70', fogNear: 30, fogFar: 170, day: 0, eve: 1, stars: 0.5 },
    Object.assign({ h: 20.6 }, NIGHT),
    Object.assign({ h: 24 }, NIGHT),
  ];
  const COLOR_KEYS = ['top', 'horizon', 'glow', 'light', 'hemiSky', 'hemiGround', 'deep', 'shallow', 'cloud'];
  const NUM_KEYS = ['lightI', 'hemiI', 'amb', 'fogNear', 'fogFar', 'day', 'eve', 'stars'];
  KEYFRAMES.forEach((k) => COLOR_KEYS.forEach((c) => { k[c] = new THREE.Color(k[c]); }));
  const cur = {};
  COLOR_KEYS.forEach((k) => { cur[k] = new THREE.Color(); });

  const SUNRISE = 6.0, SUNSET = 19.0;
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
  function dirFrom(out, elevDeg, azDeg) {
    const el = THREE.MathUtils.degToRad(elevDeg), az = THREE.MathUtils.degToRad(azDeg);
    return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  }
  const wrap24 = (h) => ((h % 24) + 24) % 24;
  function circDiff(a, b) { let d = (b - a) % 24; if (d > 12) d -= 24; if (d < -12) d += 24; return d; }
  function realHour() { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
  function formatHour(h) {
    const total = Math.floor(wrap24(h) * 60 + 1e-6) % 1440;
    const hh = Math.floor(total / 60), mm = total % 60;
    return (hh % 12 || 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm');
  }
  function periodName(h) {
    if (h < 4.5) return 'Night';
    if (h < 6.6) return 'Dawn';
    if (h < 11) return 'Morning';
    if (h < 14) return 'Midday';
    if (h < 17.5) return 'Afternoon';
    if (h < 20.3) return 'Evening';
    return 'Night';
  }

  // hash shortcuts for sharing a moment: #morning, #noon, #evening, #night or an hour like #21.5
  const HASH_HOURS = { morning: 7.5, noon: 12.5, evening: 18.3, night: 22.5 };
  const hashVal = location.hash.slice(1);
  const hashHour = HASH_HOURS[hashVal] !== undefined ? HASH_HOURS[hashVal] : (hashVal !== '' && isFinite(+hashVal) ? wrap24(+hashVal) : null);
  const timeCtl = { live: hashHour === null, hour: hashHour === null ? realHour() : hashHour, target: 0 };
  timeCtl.target = timeCtl.hour;

  const clockEl = document.getElementById('clock');
  const slider = document.getElementById('timeSlider');
  const timeOut = document.getElementById('timeOut');
  const liveBtn = document.getElementById('liveBtn');
  function setManual(h) { timeCtl.live = false; timeCtl.target = wrap24(h); syncTimeUi(true); }
  function goLive() { timeCtl.live = true; timeCtl.target = realHour(); syncTimeUi(true); }
  slider.addEventListener('input', () => setManual(+slider.value / 60));
  liveBtn.addEventListener('click', goLive);
  let lastLabel = '';
  function syncTimeUi(force) {
    const label = periodName(timeCtl.hour) + ' · ' + formatHour(timeCtl.hour) + (timeCtl.live ? ' · live' : '') + (seasonState.name ? ' · ' + seasonState.name : '') + (WX_LABEL[wx.type] ? ' · ' + WX_LABEL[wx.type] : '');
    if (label !== lastLabel || force) {
      lastLabel = label;
      clockEl.textContent = label;
      timeOut.textContent = formatHour(timeCtl.target);
      liveBtn.setAttribute('aria-pressed', String(timeCtl.live));
      slider.value = String(Math.round(timeCtl.target * 60) % 1440);
    }
  }

  function sampleKeyframes(h) {
    let i = 0;
    while (i < KEYFRAMES.length - 2 && h >= KEYFRAMES[i + 1].h) i++;
    const a = KEYFRAMES[i], b = KEYFRAMES[i + 1];
    let t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    t = t * t * (3 - 2 * t);
    COLOR_KEYS.forEach((k) => { cur[k].copy(a[k]).lerp(b[k], t); });
    NUM_KEYS.forEach((k) => { cur[k] = lerp(a[k], b[k], t); });
  }

  const waterLight = new THREE.Color();
  function applyTime(dt) {
    if (timeCtl.live) timeCtl.target = realHour();
    const k = reduceMotion ? 20 : 2.5;
    timeCtl.hour = dt > 0 ? wrap24(timeCtl.hour + circDiff(timeCtl.hour, timeCtl.target) * (1 - Math.exp(-dt * k))) : timeCtl.hour;
    const h = timeCtl.hour;
    sampleKeyframes(h);
    weatherModify();

    const f = (h - SUNRISE) / (SUNSET - SUNRISE);
    const sunElev = 66 * Math.sin(Math.PI * f);
    sunElevNow = sunElev;
    dirFrom(sunDir, sunElev, 65 + f * 230);
    const m = clamp(wrap24(h - 18.5) / 12, 0, 1);
    dirFrom(moonDir, 6 + 22 * Math.sin(Math.PI * m), 290 + m * 140);
    lightDir.copy(moonDir).lerp(sunDir, smooth(-4, 4, sunElev));
    if (lightDir.y < 0.06) lightDir.y = 0.06;
    lightDir.normalize();

    skyU.sunDir.value.copy(sunDir);
    skyU.moonDir.value.copy(moonDir);
    skyU.moonAmt.value = (1 - smooth(-4, 8, sunElev)) * (1 - wx.cloud * 0.9);
    skyU.topColor.value.copy(cur.top);
    skyU.horizonColor.value.copy(cur.horizon);
    skyU.sunColor.value.copy(cur.glow);
    starMat.opacity = cur.stars;
    scene.fog.color.copy(cur.horizon);
    scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;
    waterU.fogColor.value.copy(cur.horizon);
    waterU.fogNear.value = cur.fogNear; waterU.fogFar.value = cur.fogFar;
    waterU.deep.value.copy(cur.deep); waterU.shallow.value.copy(cur.shallow);
    waterU.sunDir.value.copy(lightDir);
    waterU.sunColor.value.copy(waterLight.copy(cur.light).multiplyScalar(clamp(cur.lightI * 1.3, 0.45, 1.3)));
    sun.color.copy(cur.light); sun.intensity = cur.lightI;
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = cur.hemiI;
    ambient.intensity = cur.amb;
    cloudMat.color.copy(cur.cloud); cloudMat.emissive.copy(cur.cloud);
    lampMat.emissiveIntensity = cur.eve * 1.6;
    glows.forEach((g) => { g.material.opacity = cur.eve * 0.75; g.visible = cur.eve > 0.02; });
    ffMat.opacity = cur.eve * 0.95 * (1 - wx.rain) * (1 - wx.snow * 0.8);
    ffMat.opacity *= seasonState.bugs;
    fireflies.visible = cur.eve > 0.02 && seasonState.bugs > 0.05;
    waterU.uIceLight.value = (0.3 + 0.7 * Math.max(cur.day, 0.08)) * (1 - wx.cloud * 0.25);
    const showBf = cur.day > 0.5 && seasonState.bugs > 0.5 && wx.rain < 0.2 && wx.snow < 0.3 && wx.fog < 0.6 && wx.storm < 0.1;
    butterflies.forEach((b) => { b.g.visible = showBf; });
    syncTimeUi(false);
  }

  // ───────────────────────── input ─────────────────────────
  const keys = new Set();
  const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' };
  const typing = (e) => e.target && ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA');
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); if (e.code.startsWith('Arrow')) e.preventDefault(); }
    if (uiState.blockActions) return;
    if (e.code === 'BracketLeft') setManual(timeCtl.target - 0.5);
    if (e.code === 'BracketRight') setManual(timeCtl.target + 0.5);
    if (e.code === 'KeyL') goLive();
    if (e.code === 'KeyE' && !e.repeat) toggleSit();
    if (e.code === 'KeyF' && !e.repeat) togglePet();
    if (e.code === 'KeyQ' && !e.repeat) cycleWeather();
  });
  window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
  window.addEventListener('blur', () => keys.clear());

  const camState = { yaw: 0, pitch: 0.32, dist: 7.5, minDist: 3.5, maxDist: 16 };
  camState.yaw = Math.atan2(-(LAKE.x - SPAWN.x), -(LAKE.z - SPAWN.z));
  const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
  const look = { id: null, lx: 0, ly: 0 };
  const joyEl = document.getElementById('joy'), knobEl = document.getElementById('knob');

  // Mouse look (FPS style): click once to capture the mouse, Esc to release it.
  const lockTip = document.getElementById('lockTip');
  let canLock = !coarsePointer && typeof canvas.requestPointerLock === 'function';
  let locked = false;
  function syncLockUi() {
    lockTip.hidden = locked || !canLock;
    canvas.classList.toggle('locked', locked);
    canvas.classList.toggle('drag-mode', !canLock);
  }
  function requestLock() {
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (err) { /* browser refused; the next click tries again */ }
  }
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) keys.clear();
    syncLockUi();
  });
  document.addEventListener('pointerlockerror', () => {
    if (!locked) { canLock = false; syncLockUi(); }
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    camState.yaw -= e.movementX * 0.0024;
    camState.pitch = clamp(camState.pitch + e.movementY * 0.002, -0.2, 1.25);
  });
  syncLockUi();

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && canLock) {
      if (!locked) requestLock();
      return;
    }
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45 && joy.id === null) {
      joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joy.x = joy.y = 0;
      joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
      knobEl.style.transform = 'translate(0px, 0px)';
      joyEl.hidden = false;
    } else if (look.id === null) {
      look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY;
      canvas.classList.add('dragging');
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
      const len = Math.hypot(dx, dy), max = 46;
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      joy.x = dx / max; joy.y = -dy / max;
    } else if (e.pointerId === look.id) {
      const sens = e.pointerType === 'touch' ? 0.007 : 0.005;
      camState.yaw -= (e.clientX - look.lx) * sens;
      camState.pitch = clamp(camState.pitch + (e.clientY - look.ly) * sens * 0.8, -0.2, 1.25);
      look.lx = e.clientX; look.ly = e.clientY;
    }
  });
  function endPointer(e) {
    if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; joyEl.hidden = true; }
    if (e.pointerId === look.id) { look.id = null; canvas.classList.remove('dragging'); }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); camState.dist = clamp(camState.dist * (1 + e.deltaY * 0.001), camState.minDist, camState.maxDist); }, { passive: false });

  const hintEl = document.getElementById('hint');
  hintEl.innerHTML = coarsePointer
    ? '<b>Drag the left side</b> to walk · <b>drag the right side</b> to look around'
    : '<b>W A S D</b> to walk · <b>move the mouse</b> to look · <b>E</b> sit or use · <b>F</b> pet · <b>H</b> shows every control';
  let walkedFor = 0, hintHidden = false;
  setTimeout(() => { if (!hintHidden) { hintHidden = true; hintEl.classList.add('gone'); } }, 16000);

  // ───────────────────────── sound ─────────────────────────
  const soundBtn = document.getElementById('sound'), soundLabel = document.getElementById('soundLabel');
  const audio = { ctx: null, on: false, master: null, water: null, crickets: null, nextChirp: 2 };
  function noiseBuffer(ctx, brown) {
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  function startAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    const brownBuf = noiseBuffer(ctx, true), whiteBuf = noiseBuffer(ctx, false);
    const wind = ctx.createBufferSource(); wind.buffer = brownBuf; wind.loop = true;
    const windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 420;
    const windG = ctx.createGain(); windG.gain.value = 0.22;
    const windLfo = ctx.createOscillator(); windLfo.frequency.value = 0.07;
    const windLfoG = ctx.createGain(); windLfoG.gain.value = 0.1;
    windLfo.connect(windLfoG).connect(windG.gain);
    wind.connect(windF).connect(windG).connect(master);

    const water = ctx.createBufferSource(); water.buffer = whiteBuf; water.loop = true;
    const waterF = ctx.createBiquadFilter(); waterF.type = 'bandpass'; waterF.frequency.value = 700; waterF.Q.value = 0.8;
    const waterG = ctx.createGain(); waterG.gain.value = 0;
    const lapLfo = ctx.createOscillator(); lapLfo.frequency.value = 0.35;
    const lapG = ctx.createGain(); lapG.gain.value = 250;
    lapLfo.connect(lapG).connect(waterF.frequency);
    water.connect(waterF).connect(waterG).connect(master);

    const cr = ctx.createOscillator(); cr.frequency.value = 4400;
    const crAm = ctx.createGain(); crAm.gain.value = 0.5;
    const crLfo = ctx.createOscillator(); crLfo.type = 'square'; crLfo.frequency.value = 26;
    const crLfoG = ctx.createGain(); crLfoG.gain.value = 0.5;
    crLfo.connect(crLfoG).connect(crAm.gain);
    const crG = ctx.createGain(); crG.gain.value = 0;
    cr.connect(crAm).connect(crG).connect(master);

    [wind, windLfo, water, lapLfo, cr, crLfo].forEach((n) => n.start());
    const rainS = ctx.createBufferSource(); rainS.buffer = whiteBuf; rainS.loop = true; rainS.playbackRate.value = 0.93;
    const rainF = ctx.createBiquadFilter(); rainF.type = 'bandpass'; rainF.frequency.value = 2400; rainF.Q.value = 0.45;
    const rainG = ctx.createGain(); rainG.gain.value = 0;
    rainS.connect(rainF).connect(rainG).connect(master);
    const gale = ctx.createBufferSource(); gale.buffer = brownBuf; gale.loop = true; gale.playbackRate.value = 0.7;
    const galeF = ctx.createBiquadFilter(); galeF.type = 'lowpass'; galeF.frequency.value = 650;
    const galeG = ctx.createGain(); galeG.gain.value = 0;
    gale.connect(galeF).connect(galeG).connect(master);
    rainS.start(); gale.start();
    Object.assign(audio, { ctx, master, water: waterG, crickets: crG, brownBuf, whiteBuf, rain: rainG, gale: galeG, wind: windG });
    return true;
  }
  function chirp() {
    const ctx = audio.ctx, now = ctx.currentTime;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = rand(-0.8, 0.8);
    pan.connect(audio.master);
    const notes = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1600, vol = 0.045 * cur.day;
    for (let k = 0; k < notes; k++) {
      const t0 = now + k * (0.11 + Math.random() * 0.05);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.1), t0);
      o.frequency.exponentialRampToValueAtTime(base * (Math.random() < 0.5 ? 1.45 : 0.75), t0 + 0.08);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      o.connect(g).connect(pan);
      o.start(t0); o.stop(t0 + 0.12);
    }
  }
  function updateAudio(dt) {
    if (!audio.ctx || !audio.on) return;
    const near = 1 - smooth(1.0, 1.9, lakeT(player.x, player.z));
    audio.water.gain.value = damp(audio.water.gain.value, 0.03 + near * 0.12, 2, dt);
    audio.crickets.gain.value = damp(audio.crickets.gain.value, cur.eve * 0.012 * (1 - wx.rain) * (1 - wx.snow) * seasonState.bugs, 2, dt);
    audio.rain.gain.value = damp(audio.rain.gain.value, wx.rain * 0.2 + wx.storm * 0.08, 2, dt);
    audio.gale.gain.value = damp(audio.gale.gain.value, wx.storm * 0.28 + wx.wind * 0.04, 1.5, dt);
    audio.wind.gain.value = 0.22 * (1 - wx.snow * 0.6) + wx.wind * 0.08;
    audio.nextChirp -= dt;
    if (audio.nextChirp <= 0) {
      if (cur.day > 0.3 && wx.rain < 0.2 && wx.snow < 0.4 && wx.storm < 0.1) chirp();
      audio.nextChirp = 1.5 + Math.random() * 5 / Math.max(cur.day, 0.2);
    }
  }
  soundBtn.addEventListener('click', () => {
    if (!audio.ctx && !startAudio()) { soundLabel.textContent = 'No audio'; return; }
    audio.on = !audio.on;
    if (audio.on) audio.ctx.resume();
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setValueAtTime(audio.master.gain.value, now);
    audio.master.gain.linearRampToValueAtTime(audio.on ? 0.9 : 0, now + 1.2);
    soundBtn.setAttribute('aria-pressed', String(audio.on));
    soundLabel.textContent = audio.on ? 'Sound on' : 'Sound off';
  });

  // ───────────────────────── per-frame updates ─────────────────────────
  function updatePlayer(dt) {
    let ix = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + joy.x;
    let iz = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0) + joy.y;
    if (player.freeze) { ix = 0; iz = 0; }
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const mag = Math.min(1, len);
    const running = keys.has('run') || (joy.id !== null && mag > 0.92);
    const speed = (running ? 5.4 : 2.7) * mag;

    const fx = -Math.sin(camState.yaw), fz = -Math.cos(camState.yaw);
    const rx = Math.cos(camState.yaw), rz = -Math.sin(camState.yaw);
    const dx = fx * iz + rx * ix, dz = fz * iz + rz * ix;

    if (player.seat && mag > 0.3 && player.sitAmt > 0.6 && !(player.seat === boatSeat && ferry.state === 'touring')) standUp();

    if (player.seat) {
      const seat = player.seat;
      const hx = seat.x - Math.sin(seat.rot) * 0.1, hz = seat.z - Math.cos(seat.rot) * 0.1;
      const follow = seat.boat && player.sitAmt > 0.7 ? 30 : 8; // ride along snugly once seated on the boat
      player.x = damp(player.x, hx, follow, dt);
      player.z = damp(player.z, hz, follow, dt);
      player.y = damp(player.y, seat.baseY, 12, dt);
      player.rot = turnTo(player.rot, seat.rot, dt * 6);
      player.move = damp(player.move, 0, 8, dt);
      player.sitAmt = damp(player.sitAmt, 1, 5, dt);
      poseHero(dt);
      return;
    }
    player.sitAmt = damp(player.sitAmt, 0, 7, dt);
    if (player.petting && updatePetting(dt, mag)) { poseHero(dt); return; }
    player.petAmt = damp(player.petAmt, 0, 6, dt);
    if (player.slide) {
      player.x = damp(player.x, player.slide.x, 10, dt);
      player.z = damp(player.z, player.slide.z, 10, dt);
      if (mag > 0.05 || Math.hypot(player.slide.x - player.x, player.slide.z - player.z) < 0.03) player.slide = null;
    }

    if (mag > 0.05) {
      const nx = player.x + dx * speed * dt, nz = player.z + dz * speed * dt;
      if (walkable(nx, player.z)) player.x = nx;
      if (walkable(player.x, nz)) player.z = nz;
      const p = { x: player.x, z: player.z };
      pushOut(p, 0.3);
      if (walkable(p.x, p.z)) { player.x = p.x; player.z = p.z; }
      player.rot = turnTo(player.rot, Math.atan2(dx, dz), dt * 9);
      walkedFor += dt;
      if (!hintHidden && walkedFor > 5) { hintHidden = true; hintEl.classList.add('gone'); }
    }
    player.move = damp(player.move, mag > 0.05 ? speed : 0, 8, dt);
    player.y = damp(player.y, Math.max(groundAt(player.x, player.z), player.slide ? player.slide.minY : -99), 14, dt);
    poseHero(dt);
  }

  function poseHero(dt) {
    const sa = player.sitAmt;
    const stride = Math.min(1, player.move / 2.7) * (1 - sa);
    player.phase += dt * (player.move * 2.6);
    const s = Math.sin(player.phase);
    const legAmp = 0.55 * stride + (player.move > 3 ? 0.15 : 0) * (1 - sa);
    hero.legs[0].rotation.x = lerp(s * legAmp, -1.52, sa);
    hero.legs[1].rotation.x = lerp(-s * legAmp, -1.44, sa);
    hero.knees[0].rotation.x = lerp(Math.max(0, s) * 0.6 * stride, 1.5, sa);
    hero.knees[1].rotation.x = lerp(Math.max(0, -s) * 0.6 * stride, 1.38, sa);
    hero.arms[0].rotation.x = lerp(-s * legAmp * 0.8, -0.6, sa);
    hero.arms[1].rotation.x = lerp(s * legAmp * 0.8, -0.55, sa);
    hero.arms[0].rotation.z = lerp(-0.06, 0.12, sa); hero.arms[1].rotation.z = lerp(0.06, -0.12, sa);
    const breathe = Math.sin(timeU.value * 1.6) * 0.012 * (1 - stride);
    const walkY = Math.abs(Math.cos(player.phase)) * 0.05 * stride + breathe;
    hero.body.position.y = lerp(walkY, player.seatTop + 0.07 - 0.86 + breathe, sa);
    hero.body.rotation.x = lerp((player.move > 3 ? 0.12 : 0.03) * stride, -0.07, sa);
    const pa = player.petAmt; // kneel on the left knee and stroke with one hand
    if (pa > 0.001) {
      const st = Math.sin(timeU.value * 4.2);
      hero.legs[1].rotation.x = lerp(hero.legs[1].rotation.x, -1.45, pa);
      hero.knees[1].rotation.x = lerp(hero.knees[1].rotation.x, 1.5, pa);
      hero.legs[0].rotation.x = lerp(hero.legs[0].rotation.x, 0.12, pa);
      hero.knees[0].rotation.x = lerp(hero.knees[0].rotation.x, 1.48, pa);
      hero.body.position.y = lerp(hero.body.position.y, 0.47 - 0.86, pa);
      hero.body.rotation.x = lerp(hero.body.rotation.x, 0.26, pa);
      hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -1.0 + st * 0.22, pa);
      hero.arms[1].rotation.z = lerp(hero.arms[1].rotation.z, -0.12, pa);
      hero.arms[0].rotation.x = lerp(hero.arms[0].rotation.x, -0.5, pa);
    }
    hero.head.rotation.x = 0.35 * pa;
    player.umbAmt = damp(player.umbAmt, (wx.rain > 0.25 || wx.snow > 0.35 || wx.storm > 0.3) && player.seat !== boatSeat ? 1 : 0, 3, dt);
    const ua = player.umbAmt;
    umbrella.visible = ua > 0.02;
    if (umbrella.visible) {
      hero.arms[0].rotation.x = lerp(hero.arms[0].rotation.x, -0.8, ua);
      hero.arms[0].rotation.z = lerp(hero.arms[0].rotation.z, 0.32, ua);
      umbrella.rotation.set(-(hero.arms[0].rotation.x + hero.body.rotation.x), 0, -hero.arms[0].rotation.z);
      umbrella.scale.set(Math.max(ua, 0.05), 1, Math.max(ua, 0.05));
    }
    for (const h of hooks.pose) h(dt);
    hero.root.position.set(player.x, player.y, player.z);
    hero.root.rotation.y = player.rot;
  }

  // ───────────────────────── sitting ─────────────────────────
  const SIT_RANGE = 1.9;
  const sitBtn = document.getElementById('sitPrompt');
  let nearSeat = null, promptState = '';
  function sitDown(seat) {
    player.seat = seat;
    player.seatTop = seat.top;
    player.slide = null;
  }
  function standUp() {
    const seat = player.seat;
    if (!seat) return;
    player.seat = null;
    const tx = seat.standTo ? seat.standTo.x : seat.x + Math.sin(seat.rot) * seat.standOff;
    const tz = seat.standTo ? seat.standTo.z : seat.z + Math.cos(seat.rot) * seat.standOff;
    if (walkable(tx, tz)) player.slide = { x: tx, z: tz, minY: seat.boat ? DOCK_Y + 0.05 : -99 };
  }
  let nearBoat = false, nearAct = null;
  function toggleSit() {
    if (player.seat === boatSeat) { if (ferry.state !== 'touring') standUp(); }
    else if (player.seat) standUp();
    else if (nearBoat) boardBoat();
    else if (nearAct) nearAct.action();
    else if (nearSeat) sitDown(nearSeat);
  }
  sitBtn.addEventListener('click', toggleSit);
  function updateSitPrompt() {
    nearSeat = null;
    nearBoat = false;
    nearAct = null;
    let next = '';
    if (player.seat === boatSeat) next = ferry.state === 'touring' ? 'riding' : 'boat-off';
    else if (player.seat) next = 'stand';
    else if (!player.petting) {
      let best = SIT_RANGE;
      for (const s of seats) {
        const d = Math.hypot(s.x - player.x, s.z - player.z);
        if (d < best) { best = d; nearSeat = s; }
      }
      let choice = nearSeat ? 'sit' : '';
      const dBoat = Math.hypot(BOARD_POINT.x - player.x, BOARD_POINT.z - player.z);
      if (ferry.state === 'docked' && dBoat < 1.8 && dBoat < best) { best = dBoat; choice = seasonState.ice < 0.3 ? 'board' : 'frozen'; }
      for (const it of interactables) {
        if (!it.available()) continue;
        const ip = it.pos(), d = Math.hypot(ip.x - player.x, ip.z - player.z);
        if (d < it.range && ((it.priority && d < it.priority) || d < best)) { best = d; choice = 'act'; nearAct = it; }
      }
      if (choice !== 'act') nearAct = null;
      if (choice !== 'sit') nearSeat = null;
      nearBoat = choice === 'board';
      if (choice === 'sit') next = 'sit:' + nearSeat.name;
      else if (choice === 'act') next = 'act:' + nearAct.label();
      else next = choice;
    }
    if (next === promptState) return;
    promptState = next;
    sitBtn.hidden = !next;
    sitBtn.disabled = next === 'riding' || next === 'frozen';
    const key = coarsePointer ? '' : '<kbd>E</kbd> ';
    if (next === 'stand') sitBtn.innerHTML = coarsePointer ? 'Tap to stand up' : key + 'Stand up';
    else if (next === 'board') sitBtn.innerHTML = key + 'Board the boat';
    else if (next === 'boat-off') sitBtn.innerHTML = key + 'Step off';
    else if (next === 'riding') sitBtn.textContent = 'Riding around the lake';
    else if (next === 'frozen') sitBtn.textContent = 'The lake is frozen';
    else if (next.startsWith('act:')) sitBtn.innerHTML = key + nearAct.label();
    else if (next) sitBtn.innerHTML = (coarsePointer ? 'Tap to sit on the ' : key + 'Sit on the ') + nearSeat.name;
  }

  // ───────────────────────── petting ─────────────────────────
  const PET_RANGE = 2.1, PET_SECONDS = 5;
  const petBtn = document.getElementById('petPrompt');
  let nearAnimal = null, petPromptState = '';

  const heartTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.beginPath();
    g.moveTo(32, 56);
    g.bezierCurveTo(6, 38, 4, 18, 18, 12);
    g.bezierCurveTo(26, 8, 32, 14, 32, 21);
    g.bezierCurveTo(32, 14, 38, 8, 46, 12);
    g.bezierCurveTo(60, 18, 58, 38, 32, 56);
    g.fillStyle = '#ff5f86'; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(20, 21, 5, 3.5, -0.6, 0, TAU); g.fill();
    return new THREE.CanvasTexture(c);
  })();
  const hearts = [];
  for (let i = 0; i < 20; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    scene.add(sp);
    hearts.push({ sp, life: 0, max: 1.7, sway: 0 });
  }
  const headPos = new THREE.Vector3();
  function spawnHeart(a) {
    const h = hearts.find((x) => x.life <= 0);
    if (!h) return;
    a.head.getWorldPosition(headPos);
    h.sp.position.set(headPos.x + rand(-0.15, 0.15), headPos.y + 0.22, headPos.z + rand(-0.15, 0.15));
    h.life = h.max; h.sway = rng() * TAU; h.sp.visible = true;
  }
  function updateHearts(dt) {
    for (const h of hearts) {
      if (h.life <= 0) continue;
      h.life -= dt;
      if (h.life <= 0) { h.sp.visible = false; continue; }
      const age = h.max - h.life;
      h.sp.position.y += dt * 0.55;
      h.sp.position.x += Math.sin(age * 3 + h.sway) * dt * 0.15;
      const sc = 0.16 + Math.min(age * 0.6, 0.14);
      h.sp.scale.set(sc, sc, 1);
      h.sp.material.opacity = Math.min(1, age * 6) * Math.min(1, h.life * 1.6);
    }
  }

  // Purr (cats) or a soft "boof" then happy panting (dogs). Only when sound is on.
  function petSound(kind) {
    if (!audio.ctx || !audio.on) return null;
    const ctx = audio.ctx, now = ctx.currentTime;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.connect(audio.master);
    const nodes = [];
    if (kind === 'cat') {
      const src = ctx.createBufferSource(); src.buffer = audio.brownBuf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      const am = ctx.createGain(); am.gain.value = 0.55;
      const flutter = ctx.createOscillator(); flutter.frequency.value = 24;
      const flutterG = ctx.createGain(); flutterG.gain.value = 0.45;
      flutter.connect(flutterG).connect(am.gain);
      const breath = ctx.createOscillator(); breath.frequency.value = 0.42;
      const breathG = ctx.createGain(); breathG.gain.value = 0.2;
      breath.connect(breathG).connect(am.gain);
      src.connect(lp).connect(am).connect(env);
      env.gain.exponentialRampToValueAtTime(0.4, now + 0.8);
      nodes.push(src, flutter, breath);
    } else {
      if (rng() < 0.7) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(240, now + 0.05);
        o.frequency.exponentialRampToValueAtTime(130, now + 0.2);
        og.gain.setValueAtTime(0.0001, now + 0.05);
        og.gain.linearRampToValueAtTime(0.18, now + 0.07);
        og.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        o.connect(og).connect(audio.master);
        o.start(now + 0.05); o.stop(now + 0.3);
      }
      const src = ctx.createBufferSource(); src.buffer = audio.whiteBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.4;
      const am = ctx.createGain(); am.gain.value = 0.5;
      const pant = ctx.createOscillator(); pant.frequency.value = 3.4;
      const pantG = ctx.createGain(); pantG.gain.value = 0.5;
      pant.connect(pantG).connect(am.gain);
      src.connect(bp).connect(am).connect(env);
      env.gain.setValueAtTime(0.0001, now + 0.3);
      env.gain.exponentialRampToValueAtTime(0.09, now + 0.9);
      nodes.push(src, pant);
    }
    nodes.forEach((n) => n.start(now));
    return {
      stop() {
        const t = ctx.currentTime;
        env.gain.cancelScheduledValues(t);
        env.gain.setValueAtTime(Math.max(env.gain.value, 0.0001), t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        nodes.forEach((n) => n.stop(t + 0.7));
      },
    };
  }

  function startPet(a) {
    if (player.petting === a) { player.petTimer = PET_SECONDS; return; }
    if (player.petting) endPet();
    player.petting = a;
    player.petTimer = PET_SECONDS;
    player.heartT = 0.35;
    player.slide = null;
    a.petted = true;
    a.state = 'petted';
    a.speed = 0;
    a.purr = petSound(a.kind);
  }
  function endPet() {
    const a = player.petting;
    if (!a) return;
    player.petting = null;
    a.petted = false;
    if (a.purr) { a.purr.stop(); a.purr = null; }
    if (a.kind === 'dog') { a.state = 'follow'; a.timer = rand(20, 40) * (1 + a.bond * 2); }
    else { a.state = 'rest'; a.timer = rand(6, 12) * (1 + a.bond * 2); }
  }
  function togglePet() {
    if (player.petting) player.petTimer = PET_SECONDS;
    else if (nearAnimal) startPet(nearAnimal);
  }
  petBtn.addEventListener('click', togglePet);

  // Returns false once the petting session ends (walked away, timed out, animal out of reach).
  function updatePetting(dt, mag) {
    const a = player.petting;
    const d = Math.hypot(a.x - player.x, a.z - player.z);
    player.petTimer -= dt;
    if (mag > 0.3 || player.petTimer <= 0 || d > 3.5 || player.seat) { endPet(); return false; }
    a.bond = Math.min(1, a.bond + dt * 0.06);
    const ang = Math.atan2(a.x - player.x, a.z - player.z);
    player.rot = turnTo(player.rot, ang, dt * 6);
    const reach = a.kind === 'dog' ? 0.95 : 0.8;
    if (d > reach + 0.04) {
      const stepLen = Math.min(d - reach, dt * 1.6);
      const nx = player.x + Math.sin(ang) * stepLen, nz = player.z + Math.cos(ang) * stepLen;
      if (walkable(nx, nz)) { player.x = nx; player.z = nz; }
      player.move = damp(player.move, 1.4, 8, dt);
    } else {
      player.move = damp(player.move, 0, 8, dt);
    }
    player.y = damp(player.y, groundAt(player.x, player.z), 14, dt);
    player.petAmt = damp(player.petAmt, d < reach + 0.3 ? 1 : 0, 5, dt);
    player.heartT -= dt;
    if (player.heartT <= 0 && player.petAmt > 0.6) { spawnHeart(a); player.heartT = rand(0.35, 0.6); }
    return true;
  }

  function updatePetPrompt() {
    nearAnimal = null;
    let next = '';
    if (player.petting) next = 'petting';
    else if (!player.seat) {
      let best = PET_RANGE;
      for (const a of animals) {
        const d = Math.hypot(a.x - player.x, a.z - player.z);
        if (d < best) { best = d; nearAnimal = a; }
      }
      if (nearAnimal) next = 'pet:' + nearAnimal.kind;
    }
    if (next === petPromptState) return;
    petPromptState = next;
    petBtn.hidden = !next;
    if (next === 'petting') petBtn.innerHTML = coarsePointer ? 'Tap to keep petting' : '<kbd>F</kbd> Keep petting';
    else if (next) petBtn.innerHTML = (coarsePointer ? 'Pet the ' : '<kbd>F</kbd> Pet the ') + nearAnimal.kind;
  }

  const camTarget = new THREE.Vector3(), camWant = new THREE.Vector3();
  let camInit = false;
  function updateCamera(dt) {
    let handled = false;
    for (const h of hooks.camera) if (h(dt, camTarget)) { handled = true; break; } // photo mode, stargazing
    if (!handled) {
      camTarget.set(player.x, player.y + 1.55, player.z);
      const cp = Math.cos(camState.pitch);
      camWant.set(
        camTarget.x + Math.sin(camState.yaw) * cp * camState.dist,
        camTarget.y + Math.sin(camState.pitch) * camState.dist,
        camTarget.z + Math.cos(camState.yaw) * cp * camState.dist
      );
      const floor = Math.max(height(camWant.x, camWant.z), 0.05) + 0.6;
      if (camWant.y < floor) camWant.y = floor;
      if (!camInit) { camera.position.copy(camWant); camInit = true; }
      else camera.position.lerp(camWant, 1 - Math.exp(-dt * 7));
      camera.lookAt(camTarget);
    }
    sky.position.copy(camera.position);
    sun.position.set(camTarget.x + lightDir.x * 140, camTarget.y - 1.55 + lightDir.y * 140, camTarget.z + lightDir.z * 140);
    sun.target.position.set(camTarget.x, camTarget.y - 1.55, camTarget.z);
  }

  function updateAmbientLife(dt, t) {
    if (fireflies.visible) {
      const arr = ffGeo.attributes.position.array;
      for (let i = 0; i < FF; i++) {
        const f = ffSeed[i];
        const x = wrap(f.x - player.x, -32, 32) + player.x + Math.sin(t * 0.3 * f.s + f.p) * 1.6;
        const z = wrap(f.z - player.z, -32, 32) + player.z + Math.cos(t * 0.25 * f.s + f.p * 1.3) * 1.6;
        const y = Math.max(height(x, z), 0.1) + f.y + Math.sin(t * 0.8 + f.p) * 0.35;
        arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      }
      ffGeo.attributes.position.needsUpdate = true;
      ffMat.size = 0.26 + Math.sin(t * 2.3) * 0.06;
    }
    if (cur.day > 0.5) {
      for (const b of butterflies) {
        const x = wrap(b.bx - player.x, -26, 26) + player.x + Math.sin(t * 0.32 * b.s + b.p) * 3.5;
        const z = wrap(b.bz - player.z, -26, 26) + player.z + Math.cos(t * 0.27 * b.s + b.p * 2.0) * 3.5;
        const y = Math.max(height(x, z), 0.3) + 0.7 + Math.sin(t * 1.4 * b.s + b.p) * 0.35;
        const dx = x - b.last.x, dz = z - b.last.z;
        if (dx * dx + dz * dz > 1e-6) b.g.rotation.y = Math.atan2(dx, dz);
        b.g.position.set(x, y, z);
        b.last.set(x, y, z);
        const flap = Math.sin(t * 17 * b.s + b.p) * 1.0;
        b.L.rotation.z = flap; b.R.rotation.z = -flap;
      }
    }
    for (const c of clouds) {
      c.position.x += dt * (1.6 + wx.wind * 7);
      if (c.position.x > 320) c.position.x = -320;
    }
  }

  // ───────────────────────── weather ─────────────────────────
  const WX_TYPES = {
    clear: { cloud: 0.08, rain: 0, storm: 0, fog: 0, snow: 0, wind: 0.3 },
    rain: { cloud: 0.78, rain: 0.6, storm: 0, fog: 0.12, snow: 0, wind: 0.5 },
    storm: { cloud: 1, rain: 1, storm: 1, fog: 0.2, snow: 0, wind: 1 },
    fog: { cloud: 0.35, rain: 0, storm: 0, fog: 1, snow: 0, wind: 0.08 },
    snow: { cloud: 0.7, rain: 0, storm: 0, fog: 0.25, snow: 1, wind: 0.25 },
  };
  const WX_KEYS = ['cloud', 'rain', 'storm', 'fog', 'snow', 'wind'];
  const WX_LABEL = { clear: '', rain: 'Rain', storm: 'Thunderstorm', fog: 'Fog', snow: 'Snow' };
  // How likely each weather is to follow the current one (auto mode)
  const WX_NEXT = {
    clear: { clear: 2, rain: 3, fog: 2, snow: 1.2, storm: 0.5 },
    rain: { clear: 4, storm: 1.5, rain: 1, fog: 1 },
    storm: { rain: 3, clear: 1 },
    fog: { clear: 4, rain: 1, fog: 1 },
    snow: { clear: 3, snow: 1, fog: 1 },
  };
  const WX_DURATION = { clear: [240, 480], rain: [150, 300], storm: [90, 180], fog: [150, 300], snow: [180, 360] }; // seconds
  const WX_ORDER = ['auto', 'clear', 'rain', 'storm', 'fog', 'snow'];
  const RAINBOW_SECONDS = 80;

  const wx = { auto: true, type: 'clear', rate: 0.12, nextChange: rand(240, 420), wet: 0, cover: 0, flash: 0, reflash: 0, nextBolt: 6, rainedRecently: false, rainbowT: 0 };
  WX_KEYS.forEach((k) => { wx[k] = WX_TYPES.clear[k]; });
  const wxQuery = new URLSearchParams(location.search).get('weather');
  if (WX_TYPES[wxQuery]) { wx.auto = false; wx.type = wxQuery; WX_KEYS.forEach((k) => { wx[k] = WX_TYPES[wxQuery][k]; }); }
  let sunElevNow = 30;

  const wxButtons = Array.from(document.querySelectorAll('#weather button'));
  function syncWeatherUi() {
    wxButtons.forEach((b) => {
      const v = b.dataset.wx;
      b.setAttribute('aria-pressed', String(v === 'auto' ? wx.auto : !wx.auto && wx.type === v));
      b.classList.toggle('current', wx.auto && v === wx.type);
    });
    lastLabel = '';
  }
  function setWeather(type, manual) {
    wx.type = type;
    if (manual) { wx.auto = false; wx.rate = 0.45; } else wx.rate = 0.12;
    syncWeatherUi();
  }
  function goAutoWeather() {
    wx.auto = true;
    wx.rate = 0.12;
    wx.nextChange = rand(...WX_DURATION[wx.type]) * 0.6;
    syncWeatherUi();
  }
  function cycleWeather() {
    const i = WX_ORDER.indexOf(wx.auto ? 'auto' : wx.type);
    const next = WX_ORDER[(i + 1) % WX_ORDER.length];
    if (next === 'auto') goAutoWeather(); else setWeather(next, true);
  }
  wxButtons.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.wx === 'auto') goAutoWeather(); else setWeather(b.dataset.wx, true);
  }));
  syncWeatherUi();
  function pickNextWeather() {
    const w = Object.assign({}, WX_NEXT[wx.type]);
    if (w.fog !== undefined && timeCtl.hour > 4 && timeCtl.hour < 9.5) w.fog *= 2.5; // misty mornings
    let total = 0;
    for (const k in w) total += w[k];
    let r = rng() * total;
    for (const k in w) { r -= w[k]; if (r <= 0) return seasonState.mapWeather(k); }
    return 'clear';
  }

  // Overcast, fog and snow reshape the time-of-day palette
  const greyTmp = new THREE.Color(), flashC = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  function toGrey(c, amt, dark) {
    const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    greyTmp.setRGB(l, l, l * 1.04);
    c.lerp(greyTmp, amt).multiplyScalar(dark);
  }
  function weatherModify() {
    const oc = wx.cloud, st = wx.storm;
    const dark = 1 - oc * 0.28 - st * 0.25;
    toGrey(cur.top, oc * 0.8, dark);
    toGrey(cur.horizon, oc * 0.7, 1 - oc * 0.18 - st * 0.25);
    toGrey(cur.cloud, oc * 0.6, 1 - oc * 0.35 - st * 0.3);
    toGrey(cur.deep, oc * 0.5, dark);
    toGrey(cur.shallow, oc * 0.5, dark);
    cur.glow.multiplyScalar(1 - oc * 0.85);
    const lightLevel = 0.25 + 0.75 * Math.max(cur.day, 0.05);
    if (wx.snow > 0.001) cur.horizon.lerp(greyTmp.setRGB(0.86, 0.88, 0.92).multiplyScalar(lightLevel), wx.snow * 0.5);
    if (wx.fog > 0.001) cur.horizon.lerp(greyTmp.setRGB(0.8, 0.82, 0.84).multiplyScalar(lightLevel), wx.fog * 0.6);
    cur.lightI *= 1 - oc * 0.62 - st * 0.15;
    cur.hemiI *= 1 + oc * 0.25;
    cur.fogNear = lerp(cur.fogNear, 4, wx.fog) * (1 - wx.rain * 0.4);
    cur.fogFar = lerp(cur.fogFar, 55, wx.fog) * (1 - wx.rain * 0.35 - wx.snow * 0.3);
    cur.stars *= 1 - oc;
    if (wx.flash > 0.001) {
      flashC.setRGB(0.55, 0.6, 0.75).multiplyScalar(wx.flash);
      cur.top.add(flashC); cur.horizon.add(flashC); cur.cloud.add(flashC);
      cur.hemiI += wx.flash * 1.4;
      cur.amb += wx.flash * 0.5;
    }
  }

  // Rain streaks and snowflakes live in a box that wraps around the camera
  const RAIN_N = 2600, SNOW_N = 2600;
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainDrops = [];
  for (let i = 0; i < RAIN_N; i++) rainDrops.push({ x: rand(-20, 20), y: rand(-10, 16), z: rand(-20, 20), v: rand(14, 19) });
  const rainMat = new THREE.LineBasicMaterial({ color: '#c4d0dc', transparent: true, opacity: 0, depthWrite: false });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false; rainLines.visible = false;
  scene.add(rainLines);

  const snowPos = new Float32Array(SNOW_N * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const flakes = [];
  for (let i = 0; i < SNOW_N; i++) flakes.push({ x: rand(-22, 22), y: rand(-6, 18), z: rand(-22, 22), v: rand(0.7, 1.4), p: rng() * TAU });
  const snowMat = new THREE.PointsMaterial({ size: 0.19, map: glowTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const snowPts = new THREE.Points(snowGeo, snowMat);
  snowPts.frustumCulled = false; snowPts.visible = false;
  scene.add(snowPts);

  // Lightning bolt far off in the hills
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  const boltMat = new THREE.LineBasicMaterial({ color: '#eef3ff', transparent: true, opacity: 0, fog: false, depthWrite: false });
  const bolt = new THREE.Line(boltGeo, boltMat);
  bolt.frustumCulled = false; bolt.visible = false;
  scene.add(bolt);
  function thunder(delay, dist) {
    if (!audio.ctx || !audio.on) return;
    const ctx = audio.ctx, t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = audio.brownBuf; src.playbackRate.value = rand(0.45, 0.75);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = rand(140, 260);
    const g = ctx.createGain();
    const vol = 0.9 * (1.4 - dist / 260);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + rand(3, 5.5));
    src.connect(lp).connect(g).connect(audio.master);
    src.start(t0, rand(0, 3)); src.stop(t0 + 6);
  }
  function strike() {
    wx.flash = 1; wx.reflash = rand(0.08, 0.2);
    const az = rng() * TAU, dist = rand(150, 260);
    let x = player.x + Math.cos(az) * dist, z = player.z + Math.sin(az) * dist, y = 95;
    const arr = boltGeo.attributes.position.array;
    for (let i = 0; i < 16; i++) {
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      x += rand(-7, 7); z += rand(-7, 7); y -= 95 / 15;
    }
    boltGeo.attributes.position.needsUpdate = true;
    thunder(rand(0.8, 3.2), dist);
  }

  // Low mist banks drifting over the lake and meadow
  const mistTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 22 + rand(-10, 10), y = 48 + rand(-10, 10), r = rand(26, 44);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 96);
    }
    return new THREE.CanvasTexture(c);
  })();
  const mists = [];
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0 }));
    const pt = lakePoint(rng() * TAU, rand(0.2, 1.7));
    sp.position.set(pt.x, Math.max(height(pt.x, pt.z), 0) + rand(0.6, 1.6), pt.z);
    sp.scale.set(rand(16, 28), rand(3.5, 6), 1);
    sp.visible = false;
    scene.add(sp);
    mists.push({ sp, bx: pt.x, p: rng() * TAU });
  }

  // Rainbow: an arc 42° around the point opposite the sun
  const rainbowMat = new THREE.ShaderMaterial({
    uniforms: { uAmt: { value: 0 } },
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uAmt; varying vec2 vUv;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float band = (length(p) - 0.86) / 0.1;
        if (band < 0.0 || band > 1.0) discard;
        vec3 c = hue((1.0 - band) * 0.78);
        float edge = smoothstep(0.0, 0.25, band) * smoothstep(1.0, 0.75, band);
        gl_FragColor = vec4(c * edge * smoothstep(-0.05, 0.3, p.y) * uAmt * 0.42, 1.0);
      }`,
  });
  const rainbow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rainbowMat);
  rainbow.frustumCulled = false; rainbow.visible = false;
  scene.add(rainbow);

  function updateWeather(dt) {
    if (wx.auto) {
      wx.nextChange -= dt;
      if (wx.nextChange <= 0) { setWeather(pickNextWeather(), false); wx.nextChange = rand(...WX_DURATION[wx.type]); }
    }
    const target = WX_TYPES[wx.type];
    WX_KEYS.forEach((k) => { wx[k] = damp(wx[k], target[k], wx.rate, dt); });
    wx.wet = clamp(wx.wet + (wx.rain > 0.2 ? dt * 0.05 * wx.rain : -dt * 0.006), 0, 1);
    wx.cover = clamp(wx.cover + (wx.snow > 0.4 ? dt * 0.012 * wx.snow : -dt * (0.005 + Math.max(0, sunElevNow) * 0.0003)), 0, 1);
    wx.cover = Math.max(wx.cover, seasonState.coverFloor);
    waterU.uIce.value = seasonState.ice;
    waterU.uSnowIce.value = smooth(0, 1, wx.cover);
    wxU.wet.value = wx.wet * (1 - wx.cover);
    wxU.snow.value = smooth(0, 1, wx.cover);
    windU.value = 0.55 + wx.wind * 1.4;
    waterU.uRain.value = wx.rain;

    if (wx.storm > 0.5) { wx.nextBolt -= dt; if (wx.nextBolt <= 0) { strike(); wx.nextBolt = rand(5, 14); } }
    if (wx.reflash > 0) { wx.reflash -= dt; if (wx.reflash <= 0) wx.flash = Math.max(wx.flash, 0.75); }
    wx.flash = Math.max(0, wx.flash - dt * 3.5);
    bolt.visible = wx.flash > 0.3;
    boltMat.opacity = wx.flash;

    if (wx.rain > 0.4) wx.rainedRecently = true;
    if (wx.rainedRecently && wx.rain < 0.12 && WX_TYPES[wx.type].rain === 0) {
      wx.rainedRecently = false;
      animals.forEach((a) => { if (a.kind === 'dog') { a.shake = 1.1; a.shakeDelay = rand(0.2, 2.5); } });
      if (sunElevNow > 4 && wx.type !== 'snow') wx.rainbowT = RAINBOW_SECONDS;
    }
    if (wx.rainbowT > 0) wx.rainbowT -= dt;
  }

  const antiSun = new THREE.Vector3();
  function updatePrecip(dt, t) {
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;

    const rn = Math.floor(RAIN_N * clamp(wx.rain * 1.15, 0, 1));
    rainLines.visible = rn > 0;
    if (rn > 0) {
      const drift = 1.5 + wx.storm * 5, slant = 0.035 + wx.storm * 0.05;
      for (let i = 0; i < rn; i++) {
        const d = rainDrops[i];
        d.y -= d.v * dt; d.x += drift * dt;
        if (d.y < -10) { d.y += 26; d.x = cx + rand(-20, 20); d.z = cz + rand(-20, 20); }
        const x = cx + wrap(d.x - cx, -20, 20), z = cz + wrap(d.z - cz, -20, 20), y = cy + d.y;
        const o = i * 6;
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z;
        rainPos[o + 3] = x - drift * slant; rainPos[o + 4] = y - 0.6; rainPos[o + 5] = z;
      }
      rainGeo.setDrawRange(0, rn * 2);
      rainGeo.attributes.position.needsUpdate = true;
      rainMat.opacity = 0.32 + wx.storm * 0.25;
      rainMat.color.copy(cur.horizon).lerp(white, 0.45);
    }

    const sn = Math.floor(SNOW_N * clamp(wx.snow * 1.15, 0, 1));
    snowPts.visible = sn > 0;
    if (sn > 0) {
      const drift = 0.4 + wx.wind * 1.5;
      for (let i = 0; i < sn; i++) {
        const f = flakes[i];
        f.y -= f.v * dt;
        f.x += (drift + Math.sin(t * 0.8 + f.p) * 0.5) * dt;
        f.z += Math.cos(t * 0.6 + f.p * 1.3) * 0.3 * dt;
        if (f.y < -6) { f.y += 24; f.x = cx + rand(-22, 22); f.z = cz + rand(-22, 22); }
        snowPos[i * 3] = cx + wrap(f.x - cx, -22, 22);
        snowPos[i * 3 + 1] = cy + f.y;
        snowPos[i * 3 + 2] = cz + wrap(f.z - cz, -22, 22);
      }
      snowGeo.setDrawRange(0, sn);
      snowGeo.attributes.position.needsUpdate = true;
      snowMat.opacity = Math.min(1, wx.snow * 1.4);
      snowMat.color.setScalar(0.35 + 0.65 * Math.max(cur.day, 0.25));
    }

    for (const m of mists) {
      m.sp.visible = wx.fog > 0.02;
      if (!m.sp.visible) continue;
      m.sp.material.opacity = wx.fog * 0.5;
      m.sp.material.color.copy(cur.horizon).lerp(white, 0.35);
      m.sp.position.x = m.bx + Math.sin(t * 0.05 + m.p) * 4;
    }

    let rb = 0;
    if (wx.rainbowT > 0) {
      rb = clamp((RAINBOW_SECONDS - wx.rainbowT) / 8, 0, 1) * clamp(wx.rainbowT / 12, 0, 1)
        * (1 - clamp(wx.cloud * 1.5 - 0.2, 0, 1)) * smooth(2, 8, sunElevNow) * smooth(45, 38, sunElevNow);
    }
    rainbow.visible = rb > 0.01;
    if (rainbow.visible) {
      antiSun.copy(sunDir).negate();
      const D = 420;
      rainbow.position.copy(camera.position).addScaledVector(antiSun, D);
      rainbow.scale.setScalar((D * Math.tan(THREE.MathUtils.degToRad(42))) / 0.91);
      rainbow.lookAt(camera.position);
      rainbowMat.uniforms.uAmt.value = rb;
    }
  }

  // ───────────────────────── loop ─────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let last = performance.now(), elapsed = 0;
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    tick(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function tick(dt) {
    elapsed += dt;
    timeU.value += dt * (reduceMotion ? 0.35 : 1) * (1 + wx.wind * 0.7);
    waterU.uTime.value = elapsed * (reduceMotion ? 0.4 : 1);
    updateWeather(dt);
    applyTime(dt);
    updateBoat(dt, elapsed);
    updatePlayer(dt);
    updateSitPrompt();
    updatePetPrompt();
    updateCamera(dt);
    for (const a of animals) updateAnimal(a, dt, elapsed);
    separateAnimals(dt);
    updateAmbientLife(dt, elapsed);
    updateHearts(dt);
    updatePrecip(dt, elapsed);
    updateRipples(dt);
    updateAudio(dt);
    for (const h of hooks.frame) h(dt, elapsed);
  }
  window.SW = {
    THREE, scene, camera, renderer, canvas, sky, sun,
    player, hero, animals, keys, camState, joy, cur, wx, wxU, waterU, skyU, timeCtl, sunDir, moonDir, lightDir, audio, timeU, starMat,
    rng, rand, pick, clamp, lerp, smooth, damp, TAU, angDiff, turnTo, wrap, col,
    height, lakeT, lakePoint, LAKE, walkable, groundAt, onDock, onIce, animalWalkable, pathAmt, SPAWN, FIRE_SPOT,
    DOCK_Y, DOCK_LEN, dockStart, dockDir, dockAt, seats, obstacles, pushOut, treeSpots, world,
    std, weatherize, glowTex, enableShadows, instanced, mergeGeos,
    sitDown, standUp, spawnRipple, splashSound, spawnHeart, soundBtn, startAudio, setWeather,
    boat, ferry, boatSeat, skipper, sk, BOARD_POINT,
    hooks, interactables, seasonState, uiState, coarsePointer, reduceMotion,
    get sunElev() { return sunElevNow; },
    get elapsed() { return elapsed; },
    renderNow() { renderer.render(scene, camera); },
    tick,
  };
  applyTime(0);
  updateBoat(0, 0);
  updatePlayer(0);
  updateCamera(0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
})();
