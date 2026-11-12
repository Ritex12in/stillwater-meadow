/* Seasons: follow the real calendar (or pick one). Spring blossom and petals, summer green,
   autumn colours and falling leaves, winter snow cover and a frozen lake you can walk on. */
(() => {
  'use strict';
  const SW = window.SW;
  if (!SW) return;
  const { THREE, rand, clamp, lerp, damp, TAU, wrap } = SW;
  const st = SW.seasonState;

  const ORDER = ['auto', 'spring', 'summer', 'autumn', 'winter'];
  const LABEL = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
  const calendarSeason = () => {
    const m = new Date().getMonth(); // northern hemisphere
    return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  };
  const query = new URLSearchParams(location.search).get('season');
  let mode = ORDER.includes(query) ? query : SW.store.season || 'auto';
  let season = mode === 'auto' ? calendarSeason() : mode;

  // per-season targets
  const P = {
    spring: { ice: 0, cover: 0, bugs: 0.6, flowers: 1, grass: [0.95, 1.12, 0.9], ground: [1, 1.05, 0.96] },
    summer: { ice: 0, cover: 0, bugs: 1, flowers: 1, grass: [1, 1, 1], ground: [1, 1, 1] },
    autumn: { ice: 0, cover: 0, bugs: 0.3, flowers: 0.3, grass: [1.3, 1.05, 0.62], ground: [1.12, 1.0, 0.78] },
    winter: { ice: 1, cover: 0.72, bugs: 0, flowers: 0, grass: [1.05, 0.95, 0.75], ground: [1, 0.96, 0.88] },
  };

  // tree colours for each season, chosen once per tree
  const items = SW.world.roundItems || [];
  const mesh = SW.world.roundTop;
  const pickFrom = (arr) => new THREE.Color(arr[Math.floor(Math.random() * arr.length)]);
  const palettes = {
    spring: items.map((it) => (it.type === 'blossom' || Math.random() < 0.3 ? pickFrom(['#f4c1d0', '#f7d6e0', '#ffffff', '#eeb0c4']) : pickFrom(['#86c25a', '#9ccd62', '#7ab84e']))),
    summer: items.map((it) => it.color.clone()),
    autumn: items.map(() => pickFrom(['#d9822b', '#e3a33b', '#c4542d', '#e8c547', '#b0452a', '#cf6a2c', '#9aa040'])),
    winter: items.map(() => pickFrom(['#7d7264', '#6f665a', '#857a6a'])),
  };
  const shown = items.map((it) => it.color.clone());
  let blend = 1;

  function apply(next, instant) {
    season = next;
    st.name = LABEL[season];
    blend = instant ? 1 : 0;
    if (instant) {
      shown.forEach((c, i) => c.copy(palettes[season][i]));
      writeTrees();
      st.ice = P[season].ice; st.coverFloor = P[season].cover; st.bugs = P[season].bugs;
      if (SW.world.grassMat) SW.world.grassMat.color.setRGB(...P[season].grass);
      if (SW.world.terrain) SW.world.terrain.material.color.setRGB(...P[season].ground);
    }
    st.flowerFrac = P[season].flowers;
    // winter turns rain to snow, summer turns snow to rain
    st.mapWeather = (k) => {
      if (season === 'winter' && (k === 'rain' || k === 'storm')) return 'snow';
      if (season === 'summer' && k === 'snow') return 'rain';
      if ((season === 'spring' || season === 'autumn') && k === 'snow' && Math.random() < 0.7) return 'rain';
      return k;
    };
    if (SW.wx.auto) {
      if (season === 'winter' && (SW.wx.type === 'rain' || SW.wx.type === 'storm')) SW.setWeather('snow', false);
      if (season !== 'winter' && SW.wx.type === 'snow' && season === 'summer') SW.setWeather('rain', false);
    }
    setParticles();
    syncUi();
  }
  function writeTrees() {
    if (!mesh) return;
    shown.forEach((c, i) => mesh.setColorAt(i, c));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // ── falling leaves (autumn) and petals (spring) ───────────────
  const N = 500;
  const pos = new Float32Array(N * 3), colors = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.16, map: SW.glowTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  SW.scene.add(pts);
  const flakes = [];
  for (let i = 0; i < N; i++) flakes.push({ x: rand(-24, 24), y: rand(-4, 10), z: rand(-24, 24), v: rand(0.5, 1.0), p: Math.random() * TAU });
  function setParticles() {
    const pal = season === 'autumn' ? ['#d9822b', '#e3a33b', '#c4542d', '#e8c547', '#b0452a'] : ['#f7c6d6', '#ffffff', '#f3a8c3', '#fde3ea'];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) { c.set(pal[i % pal.length]); colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    geo.attributes.color.needsUpdate = true;
  }
  let particleAmt = 0;

  SW.hooks.frame.push((dt, t) => {
    if (mode === 'auto' && season !== calendarSeason()) apply(calendarSeason(), false);
    const p = P[season];
    // colours drift over ~4 s; the lake freezes or thaws over ~25 s
    if (blend < 1) {
      blend = Math.min(1, blend + dt / 4);
      shown.forEach((c, i) => c.lerp(palettes[season][i], clamp(dt * 1.5, 0, 1)));
      if (blend >= 1) shown.forEach((c, i) => c.copy(palettes[season][i]));
      writeTrees();
    }
    st.ice = clamp(st.ice + Math.sign(p.ice - st.ice) * dt / 25, Math.min(st.ice, p.ice), Math.max(st.ice, p.ice));
    st.coverFloor = damp(st.coverFloor, p.cover, 0.25, dt);
    st.bugs = damp(st.bugs, p.bugs, 0.5, dt);
    if (SW.world.grassMat) { const g = SW.world.grassMat.color; g.setRGB(damp(g.r, p.grass[0], 1, dt), damp(g.g, p.grass[1], 1, dt), damp(g.b, p.grass[2], 1, dt)); }
    if (SW.world.terrain) { const g = SW.world.terrain.material.color; g.setRGB(damp(g.r, p.ground[0], 1, dt), damp(g.g, p.ground[1], 1, dt), damp(g.b, p.ground[2], 1, dt)); }
    const padsOn = st.ice < 0.4;
    if (SW.world.padMesh) SW.world.padMesh.visible = padsOn;
    if (SW.world.bloomMesh) SW.world.bloomMesh.visible = padsOn && season !== 'autumn';

    // leaves and petals drifting down around you
    const want = season === 'autumn' ? 1 : season === 'spring' ? 0.6 : 0;
    particleAmt = damp(particleAmt, want * (1 - SW.wx.rain * 0.7), 0.6, dt);
    pts.visible = particleAmt > 0.02;
    if (pts.visible) {
      const cam = SW.camera.position, wind = 0.4 + SW.wx.wind * 2;
      const n = Math.floor(N * particleAmt);
      for (let i = 0; i < n; i++) {
        const f = flakes[i];
        f.y -= f.v * dt;
        f.x += (wind + Math.sin(t * 1.3 + f.p) * 0.8) * dt;
        f.z += Math.cos(t * 0.9 + f.p * 1.7) * 0.6 * dt;
        if (f.y < -4) { f.y += 14; f.x = cam.x + rand(-24, 24); f.z = cam.z + rand(-24, 24); }
        pos[i * 3] = cam.x + wrap(f.x - cam.x, -24, 24);
        pos[i * 3 + 1] = cam.y + f.y;
        pos[i * 3 + 2] = cam.z + wrap(f.z - cam.z, -24, 24);
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.min(1, particleAmt * 1.3) * (0.35 + 0.65 * Math.max(SW.cur.day, 0.2));
    }
  });

  // ── picker ────────────────────────────────────────────────────
  const buttons = Array.from(document.querySelectorAll('#season button'));
  function syncUi() {
    buttons.forEach((b) => {
      const v = b.dataset.season;
      b.setAttribute('aria-pressed', String(v === 'auto' ? mode === 'auto' : mode !== 'auto' && season === v));
      b.classList.toggle('current', mode === 'auto' && v === season);
    });
  }
  function setMode(m) {
    mode = m;
    SW.store.season = m;
    SW.saveSoon();
    const next = m === 'auto' ? calendarSeason() : m;
    if (next !== season) { apply(next, false); SW.toast(`${LABEL[next]} comes to the meadow.`); }
    else syncUi();
  }
  buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.season)));
  SW.onKey('KeyN', () => setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]));

  apply(season, true);
})();
