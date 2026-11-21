// A numeric fingerprint of the generated world: ground heights, lake shape, walkable area, the
// places beside the lake, and the position of every instanced plant. Two runs of the same code
// and seed must give the same fingerprint; a refactor that should move nothing must too.
//
//   node tools/fingerprint.mjs out.json            write one (needs `npm run dev` running; MEADOW_SEED=7 picks a seed)
//   node tools/fingerprint.mjs a.json b.json --compare   say whether two are identical
import { readFileSync } from 'node:fs';
if (process.argv[4] === '--compare') {
  const [a, b] = [2, 3].map((i) => { const d = JSON.parse(readFileSync(process.argv[i], 'utf8')); delete d.urls; return d; });
  const bad = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  console.log(bad.length ? 'DIFFERENT: ' + bad.join(', ') : `IDENTICAL (all ${Object.keys(a).length} sections)`);
  process.exit(bad.length ? 1 : 0);
}
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 640, height: 400 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8080/?weather=clear&season=summer' + (process.env.MEADOW_SEED ? '&seed=' + process.env.MEADOW_SEED : '') + '#14');
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 300000 });
const fp = await p.evaluate(async () => {
  const m = window.__meadow;
  // import the very module instances the game uses (same URL, including any dev-server query)
  const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
  const S = await import(url('/src/core/shape.js')), W = (await import(url('/src/core/state.js'))).world;
  const grid = (fn) => { const o = []; for (let z = -170; z <= 170; z += 5) for (let x = -170; x <= 170; x += 5) o.push(fn(x, z)); return o; };
  const inst = (h) => { // instanced meshes: count + matrix checksum
    const out = []; const visit = (o) => { if (!o) return; if (Array.isArray(o)) return o.forEach(visit); if (o.isInstancedMesh) { let s = 0; const a = o.instanceMatrix.array; for (let i = 0; i < o.count * 16; i++) s += a[i] * ((i % 97) + 1); out.push([o.count, s]); } else if (o.children) o.children.forEach(visit); else if (typeof o === 'object') Object.values(o).forEach((v) => { if (v && (v.isObject3D || Array.isArray(v))) visit(v); }); };
    visit(h); return out; };
  const scene = (await import(url('/src/core/render.js'))).scene;
  return {
    seed: m.seed, height: grid(S.height), farLand: Array.from({ length: 400 }, (_, i) => S.height(Math.cos(i * 2.4) * i * 55, Math.sin(i * 2.4) * i * 55)), heightAt: grid(S.heightAt), lakeT: grid(S.lakeT), pathAmt: grid(S.pathAmt),
    walk: grid((x, z) => +S.walkable(x, z)), animalWalk: grid((x, z) => +S.animalWalkable(x, z)), ground: grid(S.groundAt), dock: grid((x, z) => +S.onDock(x, z)), reserved: grid((x, z) => +S.nearReserved(x, z, 1.4)),
    consts: [S.LAKE.x, S.LAKE.z, S.SPAWN, S.dockStart, S.dockDir, S.DOCK_Y, S.DOCK_A, S.FIRE_SPOT, S.BENCH_SPOT, S.chairSpots, S.CHAIR_A, S.PATH_T, S.WORLD_LIMIT, S.ICE_Y],
    lakeR: Array.from({ length: 200 }, (_, i) => S.lakeR(i * 0.0317)), lakePoint: Array.from({ length: 60 }, (_, i) => S.lakePoint(i * 0.11, 0.2 + i * 0.03)),
    shore: Array.from({ length: 40 }, (_, i) => S.nearestShore(6 + Math.cos(i) * i * 0.6, -30 + Math.sin(i) * i * 0.6)),
    ahead: Array.from({ length: 40 }, (_, i) => S.waterAhead(S.lakePoint(i * 0.157, 1.05), { x: -Math.cos(i * 0.157), z: -Math.sin(i * 0.157) })),
    trees: m.trees().map((t) => [t.x, t.z, t.type, t.s]), shrine: W.shrine, player: [m.player.x, m.player.z, m.player.rot],
    animals: m.animals.map((a) => [a.x, a.z]), sceneInst: inst(scene), sceneCount: (() => { let n = 0; scene.traverse(() => n++); return n; })(),
    rngNext: m.rng(), baked: S.heightAt(10.3, 40.7) !== S.height(10.3, 40.7), urls: [url('/src/core/shape.js')],
  };
});
writeFileSync(process.argv[2], JSON.stringify(fp));
console.log('fingerprint', JSON.stringify(fp).length, 'bytes; trees', fp.trees.length, 'instanced', fp.sceneInst.length, 'objects', fp.sceneCount, errs.length ? 'ERR ' + errs.join('|') : '');
await b.close();
