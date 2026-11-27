// Dev tool: the downloaded pines measured part by part, and the code-grown ones measured the same way,
// so the one can be made after the other's patterns. Open /tools/studio/pine-study.html ; the numbers are
// in window.__study once window.__ready is true (tools/pine-study.mjs prints them).
//
// For each tree (scaled to the height the game gives it): the trunk (height, radius at the ground and
// half way, how far it leans); the foliage as a whole (where it begins, its radius at ten heights: the
// silhouette); and its pieces (each connected piece of the leaf mesh is a bough's worth of cards): how
// many, how big, how they are spread over height and round the trunk, how steeply they slope, which way
// their normals point, how light their vertex colours are, and how much of the leaf picture they use.
import * as THREE from 'three';
import { loadKit, fit } from '/src/core/assets.js';
import { procPines } from '/src/world/procpines.js';
const kit = await loadKit(), gen = procPines();
const copy = (parts) => Object.fromEntries(Object.entries(parts).map(([k, g]) => [k, g.clone()]));
const r2 = (v) => Math.round(v * 100) / 100;
const stat = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = a.reduce((x, y) => x + y, 0) / a.length; return { min: r2(s[0]), med: r2(s[s.length >> 1]), mean: r2(m), max: r2(s[s.length - 1]), sd: r2(Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length)) }; };

/** The connected pieces of a geometry (by shared vertex positions): arrays of triangle numbers. */
function pieces(g) {
  const pos = g.attributes.position, idx = g.index ? g.index.array : [...Array(pos.count).keys()], key = new Map(), of = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const k = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`; if (!key.has(k)) key.set(k, key.size); of[i] = key.get(k); }
  const parent = Int32Array.from({ length: key.size }, (_, i) => i), find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(of[idx[t]]), b = find(of[idx[t + 1]]), c = find(of[idx[t + 2]]); parent[b] = a; parent[c] = a; }
  const out = new Map();
  for (let t = 0; t < idx.length; t += 3) { const k = find(of[idx[t]]); if (!out.has(k)) out.set(k, []); out.get(k).push(t / 3); }
  return { list: [...out.values()], idx };
}

function study(parts, height) {
  const P = fit(copy(parts), height, 0.15), out = {};
  for (const [name, g] of Object.entries(P)) {
    const leaf = /lea|needle/i.test(name), pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color, uv = g.attributes.uv;
    const { list, idx } = pieces(g), tris = idx.length / 3;
    if (!leaf) {
      // the trunk and bare branches: radius by height (from the vertices within 0.5 m of the tree's middle line)
      const band = (y0, y1) => { let r = 0, n = 0, cx = 0, cz = 0; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y >= y0 && y < y1) { cx += pos.getX(i); cz += pos.getZ(i); n++; } } if (!n) return null; cx /= n; cz /= n; let m = 0; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y >= y0 && y < y1) { const d = Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz); if (d < 0.6) { r += d; m++; } } } return { r: r2(r / Math.max(1, m)), cx: r2(cx), cz: r2(cz) }; };
      g.computeBoundingBox();
      out.wood = { triangles: tris, pieces: list.length, top: r2(g.boundingBox.max.y), radiusAtGround: band(0, 0.4), radiusAtQuarter: band(height * 0.22, height * 0.28), radiusAtHalf: band(height * 0.47, height * 0.53), radiusAtThreeQuarters: band(height * 0.72, height * 0.78) };
      continue;
    }
    // the foliage as a whole: its silhouette (the farthest reach from the middle line in ten bands of height)
    g.computeBoundingBox();
    const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, sil = [];
    for (let b = 0; b < 10; b++) { let m = 0; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y >= y0 + (y1 - y0) * b / 10 && y < y0 + (y1 - y0) * (b + 1) / 10) m = Math.max(m, Math.hypot(pos.getX(i), pos.getZ(i))); } sil.push(r2(m)); }
    // its pieces
    const A = V3(), B = V3(), C = V3(), N = V3(), info = [];
    for (const tl of list) {
      let area = 0, cy = 0, cx = 0, cz = 0, ny = 0, nOut = 0, shade = 0, lo = Infinity, hi = -Infinity, rmin = Infinity, rmax = 0, vn = 0, u0 = 1, u1 = 0, v0 = 1, v1 = 0, gy = 0;
      for (const t of tl) {
        const i = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
        A.fromBufferAttribute(pos, i[0]); B.fromBufferAttribute(pos, i[1]); C.fromBufferAttribute(pos, i[2]);
        N.subVectors(B, A).cross(V3().subVectors(C, A)); const a = N.length() / 2; area += a; N.normalize();
        gy += Math.abs(N.y) * a; // (how level the face lies: 1 flat, 0 upright)
        for (const k of i) {
          const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), rr = Math.hypot(x, z);
          cx += x; cy += y; cz += z; lo = Math.min(lo, y); hi = Math.max(hi, y); rmin = Math.min(rmin, rr); rmax = Math.max(rmax, rr); vn++;
          if (nor) { ny += nor.getY(k); nOut += rr > 1e-3 ? (nor.getX(k) * x + nor.getZ(k) * z) / rr : 0; }
          if (col) shade += (col.getX(k) + col.getY(k) + col.getZ(k)) / 3;
          if (uv) { u0 = Math.min(u0, uv.getX(k)); u1 = Math.max(u1, uv.getX(k)); v0 = Math.min(v0, uv.getY(k)); v1 = Math.max(v1, uv.getY(k)); }
        }
      }
      info.push({ tris: tl.length, area, y: cy / vn, az: Math.atan2(cz / vn, cx / vn), r: Math.hypot(cx / vn, cz / vn), lo, hi, rmin, rmax, drop: (hi - lo) / Math.max(0.05, rmax - rmin), level: gy / Math.max(1e-6, area), ny: ny / vn, nOut: nOut / vn, shade: col ? shade / vn : 1, uw: u1 - u0, vh: v1 - v0 });
    }
    info.sort((a, b) => a.y - b.y);
    // tiers: pieces whose middles lie within a twentieth of the foliage's height of each other
    const tiers = []; for (const p of info) { const t = tiers[tiers.length - 1]; if (t && p.y - t.y < (y1 - y0) / 22) { t.n++; t.y = (t.y * (t.n - 1) + p.y) / t.n; t.reach = Math.max(t.reach, p.rmax); } else tiers.push({ y: p.y, n: 1, reach: p.rmax }); }
    const area = info.reduce((a, p) => a + p.area, 0);
    // by thirds of the foliage's height: how steeply the pieces slope there, and how far they reach
    const thirds = [0, 1, 2].map((k) => { const l = info.filter((p) => (p.y - y0) / (y1 - y0) >= k / 3 && (p.y - y0) / (y1 - y0) < (k + 1) / 3 + (k === 2 ? 1 : 0)); return { pieces: l.length, slope: stat(l.map((p) => p.drop)), level: stat(l.map((p) => p.level)), reach: stat(l.map((p) => p.rmax)), normalUp: stat(l.map((p) => p.ny)), shade: stat(l.map((p) => p.shade)) }; });
    out.leaves = {
      triangles: tris, pieces: list.length, trianglesPerPiece: stat(info.map((p) => p.tris)), area: r2(area), areaPerTriangle: r2(area / tris * 100) / 100,
      begins: r2(y0), ends: r2(y1), beginsAtShareOfHeight: r2(y0 / height), silhouette: sil, widestShareOfHeight: r2(Math.max(...sil) / height),
      tiers: tiers.length, tierHeights: tiers.map((t) => r2(t.y)), piecesPerTier: tiers.map((t) => t.n), tierReach: tiers.map((t) => r2(t.reach)),
      gapBetweenTiers: stat(tiers.slice(1).map((t, i) => t.y - tiers[i].y)),
      pieceLength: stat(info.map((p) => p.rmax - p.rmin)), pieceDropPerMetreOut: stat(info.map((p) => p.drop)), faceLevelness: stat(info.map((p) => p.level)),
      normalUp: stat(info.map((p) => p.ny)), normalOutward: stat(info.map((p) => p.nOut)), shade: stat(info.map((p) => p.shade)),
      pictureUsed: { across: stat(info.map((p) => p.uw)), along: stat(info.map((p) => p.vh)) },
      thirds: { bottom: thirds[0], middle: thirds[1], top: thirds[2] },
      // how unevenly the pieces are spread round the trunk: the largest empty angle in each third, in degrees
      biggestGapRound: [0, 1, 2].map((k) => { const l = info.filter((p) => Math.min(2, Math.floor((p.y - y0) / (y1 - y0) * 3)) === k).map((p) => p.az).sort((a, b) => a - b); if (l.length < 2) return 360; let m = l[0] + Math.PI * 2 - l[l.length - 1]; for (let i = 1; i < l.length; i++) m = Math.max(m, l[i] - l[i - 1]); return Math.round(m * 180 / Math.PI); }),
      lopsided: r2(Math.hypot(info.reduce((a, p) => a + Math.cos(p.az) * p.area * p.r, 0), info.reduce((a, p) => a + Math.sin(p.az) * p.area * p.r, 0)) / Math.max(1e-6, info.reduce((a, p) => a + p.area * p.r, 0))),
    };
  }
  return out;
}
function V3() { return new THREE.Vector3(); }
const res = {};
for (let i = 1; i <= 5; i++) {
  res['kit Pine_' + i] = study(kit.models['Pine_' + i], 6.4);
  res['kit PineTree_' + i] = study(kit.models['PineTree_' + i], 7.6);
  res['code Pine_' + i] = study(gen.models['Pine_' + i], 6.4);
  res['code SlimPine_' + i] = study(gen.models['SlimPine_' + i], 7.6);
}
window.__study = res;
window.__ready = true;
document.body.textContent = 'done';
