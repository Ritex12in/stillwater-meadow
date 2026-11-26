// The climate from above, as it is and as the plan for seasons by latitude would make it
// (docs/endless-world.md "Plan: seasons by latitude"), without changing the game: the proposed
// rule is worked out here and handed to the game's own functions (coldAt, biomesAt), which take the
// country's cold and rain as arguments. One picture per seed, four views side by side:
//   as it is, in summer | by latitude, in home's summer | as it is, in midwinter | by latitude, in home's midwinter
// with the belts marked, home a ring. And a sweep: how far from home each kind of country is, before
// and after (snow and tundra counted on low ground only: every seed has snowy peaks near home). The
// country's cold is drawn as on its low ground, and mountains apart in grey with white tops, so the
// belts can be seen. WANDER (m) and PATCH (how much the old patches add) can be tried. (The land's own shape is today's in every view: where plains and cliffs lie would move
// a little with the climate, which this does not show.)
//   node tools/climate-map.mjs            (dev server running; SEEDS=1,7,42 PICS=1,7,42)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const SEEDS = (process.env.SEEDS || '1,2,3,7,42,1234').split(','), PICS = new Set((process.env.PICS || '1,7,42').split(','));
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const rows = [];
for (const seed of SEEDS) {
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8080/?seed=' + seed + '&weather=clear&season=summer' + (process.env.WANDER ? '&wander=' + process.env.WANDER : '') + (process.env.PATCH ? '&patch=' + process.env.PATCH : '') + '#12');
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  const out = await p.evaluate(async (picture) => {
    const url = (f) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(f));
    const S = await import(url('/src/core/shape.js')), M = await import(url('/src/core/math.js')), H = S.HOME;
    const { smooth, clamp, fbm } = M;
    // ── the proposed rule ──
    const HALF = 6000, HOME_SOUTH = 2700, W = 0.75; // (pole to equator; home's distance south of its pole; the midwinter season value)
    // (a belt's edge wanders: broadly by up to about WANDER metres, and a little more finely)
    const WANDER = +(new URLSearchParams(location.search).get('wander') || 900), PATCH = +(new URLSearchParams(location.search).get('patch') || 0.5);
    const wander = (x, z) => (fbm(x * 0.00025 + 91.7, z * 0.00025 - 37.1) - 0.5) * 2 * WANDER + (fbm(x * 0.0012 - 13.3, z * 0.0012 + 55.9) - 0.5) * 2 * 250;
    const latOf = (d) => Math.abs(1 - ((((d % (2 * HALF)) + 2 * HALF) % (2 * HALF)) / HALF));
    const T_PTS = [[0, -0.6], [0.3, -0.3], [0.55, 0], [0.75, 0.3], [0.9, 0.7], [1, 0.9]];
    const T = (L) => { for (let i = 1; i < T_PTS.length; i++) if (L <= T_PTS[i][0]) { const [a, ta] = T_PTS[i - 1], [c, tc] = T_PTS[i]; return ta + (tc - ta) * (L - a) / (c - a); } return 0.9; };
    const mild = (x, z) => smooth(140, 330, Math.hypot(x - H.x, z - H.z));
    const at = (x, z) => {
      const d = z - (H.z - HOME_SOUTH), L = latOf(d), Lw = latOf(d + wander(x, z)), k = Math.floor(d / HALF), off = (((Math.floor((k + 1) / 2)) % 2) + 2) % 2;
      const patches = S.coldBase(x, z), mi = mild(x, z);
      const base = clamp(T(Lw) + PATCH * patches, -0.6, 1) * mi;
      const rain = S.rainAt(x, z) + (0.06 * (1 - smooth(0, 0.2, Lw)) - 0.07 * smooth(0.15, 0.3, Lw) * (1 - smooth(0.3, 0.45, Lw))) * mi;
      // (how much the year moves this place; and which half-year it keeps, eased across the equator)
      // (lands are mirror images: in every other land it is the north half that runs half a year apart, so the two sides of a pole agree)
      const A = smooth(0.2, 0.55, Lw), u = (((d % (2 * HALF)) + 2 * HALF) % (2 * HALF)), south = smooth(-300, 300, u - HALF), odd = ((Math.floor(d / (2 * HALF)) % 2) + 2) % 2;
      const m = odd ? 1 - south : south;
      void off;
      return { L, base, rain, A, m };
    };
    const BELT = (L) => (L < 0.2 ? 'tropical' : L < 0.4 ? 'subtropical' : L < 0.7 ? 'temperate' : L < 0.87 ? 'subpolar' : 'polar');
    const swingOld = (c) => 1 - 0.55 * (1 - smooth(-0.5, 0, c));

    // ── what a spot looks like: [r, g, b] ──
    const C = { meadow: [128, 174, 94], lush: [70, 130, 74], dry: [204, 184, 112], grove: [233, 170, 198], plains: [162, 200, 110], desert: [231, 204, 143], swamp: [84, 104, 70], enchanted: [60, 150, 140], volcanic: [62, 54, 58], beach: [237, 221, 171], tundra: [176, 160, 128], rock: [150, 146, 138], snow: [240, 245, 252], lake: [92, 166, 226], ice: [208, 230, 244], sea: [58, 122, 192] };
    let r, g, bl;
    const set = (c) => { r = c[0]; g = c[1]; bl = c[2]; }, mix = (c, t) => { if (t <= 0) return; if (t > 1) t = 1; r += (c[0] - r) * t; g += (c[1] - g) * t; bl += (c[2] - bl) * t; };
    /** `neu`: by latitude; `s`: the season value at home (0 midsummer .. 0.75 midwinter). */
    const look = (x, z, neu, s) => {
      const h = S.rawHeight(x, z), q = neu ? at(x, z) : null, base = neu ? q.base : S.coldBase(x, z), rain = neu ? q.rain : S.rainAt(x, z);
      const cold = S.coldAt(x, z, Math.min(Math.max(h, 1), 60), base), today = // (the cold of the country, as on its low ground: the peaks' own snow is drawn apart, below)
        neu ? cold + (s + q.m * (W - 2 * s)) * q.A : cold + s * swingOld(cold);
      if (h < 0) { const L = S.lakeAt(x, z); if (L.t(x, z) < 1.1 || S.seaAt(x, z) <= 0) set(smooth(0.5, 0.6, today) > 0.5 ? C.ice : C.lake); else set(C.sea); return { h, base, rain, cold, today, water: true }; }
      const bio = S.biomesAt(x, z, h, base, rain);
      set(C.meadow); mix(C.lush, S.lushOf(rain)); mix(C.dry, S.dryOf(rain)); mix(C.plains, bio.plains * 0.8); mix(C.desert, bio.desert); mix(C.swamp, bio.swamp); mix(C.enchanted, bio.enchanted); mix(C.volcanic, bio.volcanic);
      mix(C.grove, S.groveAt(x, z) * 0.85 * (1 - S.snowOf(cold)));
      const snowHere = smooth(0.47, 0.6, S.snowCold(today, rain));
      mix(C.tundra, smooth(0.45, 0.6, cold) * (1 - snowHere));

      mix(C.beach, bio.beach);
      mix(C.snow, snowHere);
      // (mountains: grey rock above the trees, their tops white whatever the country)
      mix([122, 118, 112], smooth(70, 110, h) * 0.85); mix([236, 240, 246], smooth(125, 170, h) * 0.9);
      return { h, base, rain, cold, today, bio, snow: snowHere };
    };

    // ── how far from home each kind of country is, as it is and by latitude (in summer) ──
    const KINDS = { meadow: (c) => c.mild, plains: (c) => c.bio.plains > 0.6, lush: (c) => c.lush > 0.6 && c.snow < 0.3, heath: (c) => c.dry > 0.6 && c.bio.desert < 0.3 && c.snow < 0.3, grove: (c) => c.grove > 0.6, snow: (c) => c.snow > 0.6 && c.h < 60, tundra: (c) => c.cold > 0.55 && c.snow < 0.3 && c.h < 60, desert: (c) => c.bio.desert > 0.6, swamp: (c) => c.bio.swamp > 0.6, enchanted: (c) => c.bio.enchanted > 0.6, volcanic: (c) => c.bio.volcanic > 0.6, coast: (c) => c.bio.beach > 0.6 };
    const sweep = (neu) => {
      const found = {}, names = Object.keys(KINDS), where = {};
      for (let rr = 60; rr <= 9000 && Object.keys(found).length < names.length; rr += 120) {
        const n = Math.max(8, Math.ceil((2 * Math.PI * rr) / 120));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 2 * Math.PI, x = H.x + Math.cos(a) * rr, z = H.z + Math.sin(a) * rr, c = look(x, z, neu, 0);
          if (c.water || c.h < 1) continue;
          c.lush = S.lushOf(c.rain); c.dry = S.dryOf(c.rain); c.grove = S.groveAt(x, z);
          c.mild = c.snow + c.dry + c.lush < 0.1 && c.grove < 0.3 && Math.max(c.bio.desert, c.bio.swamp, c.bio.enchanted, c.bio.volcanic, c.bio.plains, c.bio.beach) < 0.2;
          for (const k of names) if (!(k in found) && KINDS[k](c)) { found[k] = rr; where[k] = z < H.z ? 'N' : 'S'; }
        }
      }
      return names.map((k) => (k in found ? (found[k] / 1000).toFixed(1) + where[k] : '-'));
    };
    const res = { names: Object.keys(KINDS), old: sweep(false), neu: sweep(true) };
    if (!picture) return res;

    // ── the picture: 10 km east to west, from 5 km north of home to 13 km south (a whole land and more) ──
    const STEP = 20, PW = 500, PH = 900, GAP = 14, LEFT = 96, TOP = 40, views = [['As it is · summer', false, 0], ['By latitude · home\'s summer', true, 0], ['As it is · midwinter', false, W], ['By latitude · home\'s midwinter', true, W]];
    const c = document.createElement('canvas'); c.width = LEFT + views.length * (PW + GAP); c.height = TOP + PH + 16;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#12181c'; ctx.fillRect(0, 0, c.width, c.height);
    const x0 = H.x - 5000, z0 = H.z - 5000;
    views.forEach(([title, neu, s], vi) => {
      const img = ctx.createImageData(PW, PH), ox = LEFT + vi * (PW + GAP);
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) { look(x0 + i * STEP, z0 + j * STEP, neu, s); const o = (j * PW + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = bl; img.data[o + 3] = 255; }
      ctx.putImageData(img, ox, TOP);
      ctx.fillStyle = '#f7f4ec'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(title, ox + 4, 26);
      // home, and (by latitude) the belts' edges
      const hx = ox + (H.x - x0) / STEP, hy = TOP + (H.z - z0) / STEP;
      ctx.strokeStyle = '#ff2fd0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, 7); ctx.stroke();
      if (neu) {
        let last = null;
        for (let j = 0; j < PH; j++) {
          const d = z0 + j * STEP - (H.z - HOME_SOUTH), L = latOf(d), belt = BELT(L), L1 = latOf(d - STEP);
          if (last !== null && belt !== last) { ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(ox, TOP + j); ctx.lineTo(ox + PW, TOP + j); ctx.stroke(); ctx.setLineDash([]); }
          if ((L1 - 0.0001) * (L - 0.0001) < 0 || (L < 0.004 && L1 >= 0.004)) { ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ox, TOP + j); ctx.lineTo(ox + PW, TOP + j); ctx.stroke(); }
          last = belt;
        }
      }
    });
    // the belts named down the left, and a scale
    ctx.font = '600 12px sans-serif'; ctx.textAlign = 'right';
    let start = 0, lastBelt = null;
    for (let j = 0; j <= PH; j++) {
      const belt = j < PH ? BELT(latOf(z0 + j * STEP - (H.z - HOME_SOUTH))) : null;
      if (belt !== lastBelt) { if (lastBelt) { ctx.fillStyle = '#f7f4ec'; ctx.fillText(lastBelt, LEFT - 8, TOP + (start + j) / 2 + 4); } start = j; lastBelt = belt; }
    }
    ctx.fillStyle = '#ffd27a'; ctx.fillText('equator', LEFT - 8, TOP + (H.z - HOME_SOUTH + HALF - z0) / STEP + 4);
    ctx.fillStyle = '#9fd8e8'; ctx.fillText('pole', LEFT - 8, TOP + (H.z - HOME_SOUTH - z0) / STEP + 4); ctx.fillText('pole', LEFT - 8, TOP + (H.z - HOME_SOUTH + 2 * HALF - z0) / STEP + 4);
    ctx.strokeStyle = '#f7f4ec'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LEFT + 10, TOP + PH - 12); ctx.lineTo(LEFT + 10 + 1000 / STEP, TOP + PH - 12); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#f7f4ec'; ctx.fillText('1 km', LEFT + 14 + 1000 / STEP, TOP + PH - 8);
    res.png = c.toDataURL('image/png');
    return res;
  }, PICS.has(seed));
  if (out.png) { writeFileSync('e:/Games/_assets/previews/climate-' + seed + (process.env.TAG || '') + '.png', Buffer.from(out.png.split(',')[1], 'base64')); delete out.png; }
  rows.push({ seed, ...out });
  await p.close();
}
await b.close();
// the sweep: km from home to the nearest of each kind (N or S of home), as it is / by latitude ('-': none within 9 km)
const names = rows[0].names;
console.log(['seed'.padEnd(6), ...names.map((n) => n.padEnd(13))].join(''));
for (const r of rows) console.log([String(r.seed).padEnd(6), ...names.map((n, i) => (r.old[i] + ' > ' + r.neu[i]).padEnd(13))].join(''));
