// Scout places for the film: writes tools/film/places.json (seed 1).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8080/?seed=1&weather=clear&season=summer#12');
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 120000 });
const out = await p.evaluate(async () => {
  const url = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
  const S = await import(url('/src/core/shape.js')), C = await import(url('/src/ui/countries.js')), m = window.__meadow, H = S.HOME;
  const pt = (o) => o && { x: +o.x.toFixed(2), z: +o.z.toFixed(2), y: +S.height(o.x, o.z).toFixed(2) };
  const P = { home: { x: H.x, z: H.z, r: H.r(0), rmax: H.rmax }, spawn: pt(S.SPAWN), fire: pt(S.FIRE_SPOT), bench: pt(S.BENCH_SPOT), dockStart: pt(S.dockStart), dockDir: S.dockDir, board: pt(m.BOARD_POINT), shrine: S.homeShrineSite && pt(S.homeShrineSite()) };
  // the cascade nearest home, the bridge, the island with its stones
  const rv = S.riversNear(H.x, H.z, 1500).find((v) => v.id === '-1:0');
  P.cascade = { pts: Array.from({ length: rv.n }, (_, i) => [+rv.x[i].toFixed(1), +rv.lv[i].toFixed(2), +rv.z[i].toFixed(1)]), fall: Array.from(rv.fall) };
  const brs = []; for (const v of S.riversNear(H.x, H.z, 6000)) for (const b of S.bridgesOf(v)) brs.push({ x: b.x, z: b.z, ux: b.ux, uz: b.uz, half: b.half, deck: S.deckY(b, 0), lv: b.lv, river: v.id });
  brs.sort((a, b) => Math.hypot(a.x - H.x, a.z - H.z) - Math.hypot(b.x - H.x, b.z - H.z)); P.bridges = brs.slice(0, 3);
  const isl = S.lakesNear(H.x, H.z, 3000).filter((L) => L.isle).sort((a, b) => Math.hypot(a.x - H.x, a.z - H.z) - Math.hypot(b.x - H.x, b.z - H.z)).slice(0, 3);
  P.islands = isl.map((L) => ({ lake: { x: L.x, z: L.z, R0: L.R0 }, isle: { x: L.isle.x, z: L.isle.z, r: L.isle.r, top: L.isle.top }, stones: (({ ax, az, bx, bz }) => ({ ax, az, bx, bz }))(S.stonesOf(L)) }));
  for (const k of ['pagoda', 'castle', 'windmill', 'ship', 'volcano', 'circle', 'skyisle', 'beachhut']) { const s = S.sitesNear(H.x, H.z, 7000, k)[0]; if (s) P[k] = { x: s.x, z: s.z, y: s.y, turn: s.turn, d: Math.round(Math.hypot(s.x - H.x, s.z - H.z)) }; }
  P.countries = C.nearestCountries(H.x, H.z);
  return P;
});
writeFileSync('tools/film/places.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).join(' '));
for (const k of ['pagoda', 'castle', 'windmill', 'ship', 'volcano', 'circle', 'skyisle']) console.log(k, JSON.stringify(out[k]));
console.log('countries', Object.entries(out.countries).map(([k, v]) => k + ':' + v.far).join(' '));
await b.close();
