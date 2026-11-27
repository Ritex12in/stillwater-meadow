// A picture of the world as "Plan: a world with places in it" (docs/endless-world.md) would make it:
// oceans, continents and islands, and on the land regions each with a heart. It changes nothing in
// the game: the proposed rule is worked out here, over the game's own climate and lakes.
// One picture per seed, two views side by side, 30 km square with home in the middle:
//   left   land and sea: the land in its country's colours (by latitude, as the game has it), shelf
//          and deep water, pack ice toward the poles, each continent named with its size;
//   right  the same, with the regions' hearts (a dot; a ring where it is a harbour), the trails
//          joining neighbouring hearts, and home.
// And a table: how much is sea, and each continent's size and number of hearts.
//   node tools/world-map.mjs            (dev server running; SEEDS=1,7,42  CELL=9000 the continents' spacing, m)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const SEEDS = (process.env.SEEDS || '1,7,42').split(',');
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
for (const seed of SEEDS) {
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8080/?seed=' + seed + '&weather=clear&season=summer' + (process.env.CELL ? '&cell=' + process.env.CELL : '') + '#12');
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  const out = await p.evaluate(async (seed) => {
    const url = (f) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(f));
    const S = await import(url('/src/core/shape.js')), M = await import(url('/src/core/math.js')), H = S.HOME;
    const { smooth, clamp, fbm, hash } = M;
    // ── the proposed rule ──
    // Continents: the sea is ruled into squares CELL metres wide, and each has one continent or none: a
    // middle (pushed about in its square), a size, and a coast bent by two fields of noise. Each is smaller
    // than its square, so there is sea between neighbours (now and then two touch: an isthmus). Home's
    // square always has one, home a little off its middle. (A plain field of noise will not do: at half
    // land it joins up into one landmass without end.)
    const LEVEL = 0, CELL = +(new URLSearchParams(location.search).get('cell') || 9000), sd = +seed || 7;
    const ox = hash(sd, 211) * 50000, oz = hash(sd, 223) * 50000;
    const hcx = Math.floor(H.x / CELL), hcz = Math.floor(H.z / CELL), cells = new Map();
    const cellOf = (cx, cz) => {
      const k = cx + ',' + cz;
      if (cells.has(k)) return cells.get(k);
      let c = null;
      if (cx === hcx && cz === hcz) { const a = hash(sd, 311) * 6.283; c = { x: H.x + Math.cos(a) * 900, z: H.z + Math.sin(a) * 900, R: 3300 + hash(sd, 313) * 500 }; }
      else if (hash(cx * 13 + sd, cz * 7 + 5) > 0.14) c = { x: (cx + 0.5 + (hash(cx * 3 + sd, cz * 11) - 0.5) * 0.3) * CELL, z: (cz + 0.5 + (hash(cz * 5 + sd, cx * 17) - 0.5) * 0.3) * CELL, R: 2100 + hash(cx + sd * 3, cz * 19) * 1400 };
      cells.set(k, c);
      return c;
    };
    /** How far inland a spot is (above 0: land; a little below: the shelf), by the nearest continents. */
    const land = (x, z) => {
      const wx = x + (fbm((x + ox) * 0.0004 + 3.3, (z + oz) * 0.0004 - 8.1) - 0.5) * 2600, wz = z + (fbm((x + ox) * 0.0004 - 5.7, (z + oz) * 0.0004 + 2.9) - 0.5) * 2600;
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      let best = -9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = cellOf(cx + i, cz + j); if (c) best = Math.max(best, 1 - Math.hypot(wx - c.x, wz - c.z) / c.R); }
      return best + (fbm((x + ox) * 0.0011 - 9.0, (z + oz) * 0.0011 + 6.0) - 0.5) * 0.3;
    };
    /** Islands: small rises in the sea near a continent, more of them toward an equator. */
    const isle = (x, z, c) => {
      if (c >= LEVEL || c < LEVEL - 0.42) return 0;
      const n = fbm((x + oz) * 0.0013 + 31.0, (z + ox) * 0.0013 - 12.0), warm = 1 - smooth(0.15, 0.45, S.latitudeAt(x, z));
      return smooth(0.68 - warm * 0.06, 0.73 - warm * 0.06, n);
    };
    // ── the sample: 30 km square, 50 m a pixel ──
    const STEP = 50, N = 600, x0 = H.x - 15000, z0 = H.z - 15000, kind = new Uint8Array(N * N), fld = new Float32Array(N * N); // (kind: 0 deep, 1 shelf, 2 land, 3 island)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + i * STEP, z = z0 + j * STEP, c = land(x, z); fld[j * N + i] = c; kind[j * N + i] = c >= LEVEL ? 2 : isle(x, z, c) > 0.5 ? 3 : c > LEVEL - 0.13 ? 1 : 0; }
    // continents: land joined to land (islands apart)
    const lab = new Int32Array(N * N).fill(-1), conts = [];
    for (let s0 = 0; s0 < N * N; s0++) {
      if (kind[s0] !== 2 || lab[s0] >= 0) continue;
      const id = conts.length, stack = [s0]; let n = 0, sx = 0, sz = 0, edge = false;
      lab[s0] = id;
      while (stack.length) {
        const q = stack.pop(), i = q % N, j = (q / N) | 0;
        n++; sx += i; sz += j; if (i === 0 || j === 0 || i === N - 1 || j === N - 1) edge = true;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= N || c >= N) continue; const t = c * N + a; if (kind[t] === 2 && lab[t] < 0) { lab[t] = id; stack.push(t); } }
      }
      conts.push({ id, km2: +(n * STEP * STEP / 1e6).toFixed(1), cx: sx / n, cz: sz / n, edge, hearts: 0, harbours: 0 });
    }
    const NA = ['Raven', 'Silver', 'Ember', 'Willow', 'Frost', 'Amber', 'Heron', 'Thistle', 'Dawn', 'Moss', 'Star', 'Lark', 'Mist', 'Golden', 'Hollow', 'Wind'], NB = ['moor', 'reach', 'mark', 'holm', 'wold', 'shore', 'vale', 'fell', 'land', 'haven'];
    const big = conts.filter((c) => c.km2 >= 2).sort((a, c) => c.km2 - a.km2);
    big.forEach((c, k) => { c.name = NA[Math.floor(hash(c.id + (+seed || 7), k + 3) * NA.length)] + NB[Math.floor(hash(k + 11, c.id + (+seed || 7)) * NB.length)]; });
    const homeC = lab[Math.round((H.z - z0) / STEP) * N + Math.round((H.x - x0) / STEP)];
    // ── regions and their hearts: a square of 2 km has one spot (pushed about); its heart is the lake nearest that spot, if it is on land ──
    const REGION = 2000, hearts = [], at = (x, z) => { const i = Math.round((x - x0) / STEP), j = Math.round((z - z0) / STEP); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
    for (let cz = Math.floor(z0 / REGION); cz <= Math.floor((z0 + N * STEP) / REGION); cz++) for (let cx = Math.floor(x0 / REGION); cx <= Math.floor((x0 + N * STEP) / REGION); cx++) {
      const px = (cx + 0.25 + hash(cx * 7 + 1, cz * 3 + (+seed || 7)) * 0.5) * REGION, pz = (cz + 0.25 + hash(cz * 5 + 2, cx * 11 + (+seed || 7)) * 0.5) * REGION;
      let spot = { x: px, z: pz };
      const L = S.lakesNear(px, pz, 700).find((q) => { const k = at(q.x, q.z); return k >= 0 && kind[k] === 2; });
      if (L) spot = { x: L.x, z: L.z, lake: true };
      const k = at(spot.x, spot.z);
      if (k < 0 || kind[k] !== 2) continue;
      // a harbour: the sea within 500 m
      let sea = false;
      for (let a = 0; a < 6.28 && !sea; a += 0.52) for (const r of [250, 500]) { const t = at(spot.x + Math.cos(a) * r, spot.z + Math.sin(a) * r); if (t >= 0 && kind[t] < 2) sea = true; }
      const h = { x: spot.x, z: spot.z, cont: lab[k], harbour: sea, lake: !!spot.lake, home: Math.hypot(spot.x - H.x, spot.z - H.z) < 300 };
      hearts.push(h);
      const C = conts[h.cont]; if (C) { C.hearts++; if (sea) C.harbours++; }
    }
    // ── the picture ──
    const C = { meadow: [128, 174, 94], lush: [70, 130, 74], dry: [204, 184, 112], grove: [233, 170, 198], desert: [231, 204, 143], swamp: [84, 104, 70], tundra: [176, 160, 128], snow: [240, 245, 252], beach: [237, 221, 171], deep: [38, 92, 158], shelf: [78, 160, 196], lagoon: [92, 206, 204], ice: [214, 232, 244] };
    let r, g, bl;
    const set = (c) => { r = c[0]; g = c[1]; bl = c[2]; }, mix = (c, t) => { if (t <= 0) return; if (t > 1) t = 1; r += (c[0] - r) * t; g += (c[1] - g) * t; bl += (c[2] - bl) * t; };
    const colour = (x, z, k, c) => {
      const L = S.latitudeAt(x, z);
      if (k < 2) { set(C.deep); mix(C.shelf, k === 1 ? 0.8 : smooth(LEVEL - 0.4, LEVEL - 0.13, c) * 0.35); if (k === 1) mix(C.lagoon, (1 - smooth(0.15, 0.4, L)) * 0.8); mix(C.ice, smooth(0.84, 0.93, L)); return; }
      const base = S.coldBase(x, z), rain = S.rainAt(x, z), cold = S.coldAt(x, z, 8, base), bio = S.biomesAt(x, z, 8, base, rain), snow = S.snowOf(S.snowCold(cold, rain));
      set(C.meadow); mix(C.lush, S.lushOf(rain)); mix(C.dry, S.dryOf(rain)); mix(C.desert, bio.desert); mix(C.swamp, bio.swamp);
      mix(C.grove, S.groveAt(x, z) * 0.8 * (1 - snow)); mix(C.tundra, smooth(0.45, 0.6, cold) * (1 - snow)); mix(C.snow, snow);
      mix(C.beach, smooth(LEVEL + 0.035, LEVEL, c) * 0.9); // (a strand along the coast)
    };
    const W = N * 2 + 16, cv = document.createElement('canvas'); cv.width = W; cv.height = N + 34;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#12181c'; ctx.fillRect(0, 0, cv.width, cv.height);
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { colour(x0 + i * STEP, z0 + j * STEP, kind[j * N + i], fld[j * N + i]); const o = (j * N + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = bl; img.data[o + 3] = 255; }
    const P = (x, z, off) => [off + (x - x0) / STEP, 30 + (z - z0) / STEP];
    for (const off of [0, N + 16]) {
      ctx.putImageData(img, off, 30);
      // equators and poles
      for (let j = 0; j < N; j++) { const d = z0 + j * STEP - (H.z - S.HOME_SOUTH), u = ((d % S.LAND) + S.LAND) % S.LAND; if (u < STEP) { ctx.fillStyle = 'rgba(159, 216, 232, 0.55)'; ctx.fillRect(off, 30 + j, N, 1); } if (Math.abs(u - S.LAND / 2) < STEP / 2) { ctx.fillStyle = 'rgba(255, 210, 122, 0.7)'; ctx.fillRect(off, 30 + j, N, 1); } }
      const [hx, hy] = P(H.x, H.z, off);
      ctx.strokeStyle = '#ff2fd0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = '#f7f4ec'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Land and sea · seed ' + seed, 4, 20); ctx.fillText('Regions: hearts, harbours and trails', N + 20, 20);
    ctx.font = 'italic 600 15px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const c of big) { const label = `${c.name} · ${c.km2} km²${c.edge ? '+' : ''}`; ctx.strokeStyle = 'rgba(12, 18, 22, 0.85)'; ctx.lineWidth = 3.5; ctx.strokeText(label, c.cx, 30 + c.cz); ctx.fillStyle = c.id === homeC ? '#ffd27a' : '#f7f4ec'; ctx.fillText(label, c.cx, 30 + c.cz); }
    // trails: each heart to its nearest two on the same continent, within 3.5 km
    const off = N + 16;
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.85)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
    for (const h of hearts) { const near = hearts.filter((q) => q !== h && q.cont === h.cont).map((q) => [Math.hypot(q.x - h.x, q.z - h.z), q]).filter((q) => q[0] < 3500).sort((a, c) => a[0] - c[0]).slice(0, 2); for (const [, q] of near) { ctx.beginPath(); ctx.moveTo(...P(h.x, h.z, off)); ctx.lineTo(...P(q.x, q.z, off)); ctx.stroke(); } }
    ctx.setLineDash([]);
    for (const h of hearts) { const [x, y] = P(h.x, h.z, off); ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fillStyle = h.lake ? '#fff6d8' : '#e8c9a0'; ctx.fill(); ctx.strokeStyle = 'rgba(12, 18, 22, 0.9)'; ctx.lineWidth = 1; ctx.stroke(); if (h.harbour) { ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 7); ctx.strokeStyle = '#1b3f8a'; ctx.lineWidth = 2; ctx.stroke(); } }
    ctx.strokeStyle = '#f7f4ec'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, N + 18); ctx.lineTo(10 + 5000 / STEP, N + 18); ctx.stroke();
    ctx.font = '600 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#f7f4ec'; ctx.fillText('5 km', 16 + 5000 / STEP, N + 22);
    let sea = 0, isles = 0; for (let k = 0; k < N * N; k++) { if (kind[k] < 2) sea++; if (kind[k] === 3) isles++; }
    return { png: cv.toDataURL('image/png'), sea: +(sea / (N * N) * 100).toFixed(0), isleKm2: +(isles * STEP * STEP / 1e6).toFixed(1), home: big.find((c) => c.id === homeC), conts: big.slice(0, 8).map((c) => ({ name: c.name, km2: c.km2, runsOff: c.edge, hearts: c.hearts, harbours: c.harbours })), hearts: hearts.length, smallLands: conts.filter((c) => c.km2 < 2).length };
  }, seed);
  writeFileSync('e:/Games/_assets/previews/worldmap-' + seed + (process.env.TAG || '') + '.png', Buffer.from(out.png.split(',')[1], 'base64'));
  delete out.png;
  console.log('seed ' + seed + ': ' + out.sea + '% sea; islands ' + out.isleKm2 + ' km² and ' + out.smallLands + ' scraps of land under 2 km²; ' + out.hearts + ' hearts; home on ' + (out.home ? out.home.name + ' (' + out.home.km2 + ' km²' + (out.home.edge ? ', runs off the picture' : '') + ')' : 'no continent!'));
  for (const c of out.conts) console.log('   ' + c.name.padEnd(14) + String(c.km2).padStart(7) + ' km²' + (c.runsOff ? '+' : ' ') + '  hearts ' + String(c.hearts).padStart(3) + '  harbours ' + c.harbours);
  await p.close();
}
await b.close();
