// The meadow's plants and rocks built from Quaternius' Stylized Nature MegaKit (CC0), when it
// loaded. Placement stays with vegetation.js; this file only supplies shapes and materials, plus
// the undergrowth (bushes, ferns, clover, mushrooms), which draws from its own random stream so
// it can never move a tree or a flower.
import * as THREE from 'three';
import { TAU, lerp, mulberry32, fbm } from '../core/math.js';
import { height, lakeT, pathAmt, SPAWN, nearReserved } from '../core/shape.js';
import { std, col, weatherize, addWind, bothSides, instancedVariants, lodSet, cutoutDepth, treeWarp, softEdges, neonAtNight } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';
import { variantAt } from './detail.js';
import { world } from '../core/state.js';

export const KIT_GRASS_FADE = [6, 22];   // detailed grass thins out from near you; the light tufts fill in
export const KIT_FLOWER_FADE = [26, 54];
const UNDERGROWTH_FADE = [40, 55];
const FAR_KEEP = 0.4; // share of leaf cards a far tree keeps

const tex = (n) => kit.tex[n];
/** Tree crowns: the leaf material, swaying a little at the top and rustling as gusts pass. */
const crownStd = (map) => softEdges(weatherize(addWind(std('#ffffff', { map, alphaTest: 0.5, side: THREE.DoubleSide, flatShading: false, vertexColors: true }), 0.0022, null, null, 0.07), 'std'));
const pieces = (name) => kit.models[name];
const first = (parts, re) => Object.entries(parts).find(([k]) => re.test(k))[1];
/** The kit keeps wind weights in its vertex colours; give small plants a root-to-tip shade instead. */
function shadeByHeight(geo, lo, hi) {
  const p = geo.attributes.position, c = geo.attributes.color, top = geo.boundingBox.max.y || 1;
  for (let i = 0; i < p.count; i++) { const v = lerp(lo, hi, Math.max(0, p.getY(i)) / top); c.setXYZ(i, v, v, v); }
  c.needsUpdate = true;
  return upNormals(geo);
}
/** Thin blades and leaves lit evenly from above (as the hand-built grass is), not edge-on dark. */
function upNormals(geo) {
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  n.needsUpdate = true;
  return geo;
}
/** Leafy clumps lit like a ball, so the cards read as one soft mass. */
function roundNormals(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, c = new THREE.Vector3(), v = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i) - c.x, (p.getY(i) - c.y) * 0.7 + 0.3, p.getZ(i) - c.z).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  n.needsUpdate = true;
  return geo;
}

// ───────────── trees ─────────────
// Far trees are the same models, thinned: the crown keeps a share of its leaf cards, each grown
// so the crown stays as full, and the trunk keeps only what shows below and through the leaves.
// Same textures and material as up close, so a tree doesn't change look when it switches.
function subset(geo, keepTri, move) {
  const idx = geo.index.array, src = geo.attributes, out = new THREE.BufferGeometry();
  const tris = [];
  for (let t = 0; t < idx.length / 3; t++) if (keepTri(t)) tris.push(t);
  const remap = new Map(), order = [];
  const index = [];
  tris.forEach((t) => { for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; if (!remap.has(v)) { remap.set(v, order.length); order.push(v); } index.push(remap.get(v)); } });
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const a = src[name];
    if (!a) continue;
    const arr = new Float32Array(order.length * a.itemSize);
    order.forEach((v, i) => { for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.array[v * a.itemSize + c]; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  out.setIndex(index);
  if (move) move(out.attributes.position, order);
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}
/**
 * The separate pieces of a model (leaf cards, or trunk and branches), as triangle lists.
 * `weld` also joins vertices that share a position (split only for their texture seams).
 */
function pieces3(geo, weld) {
  const idx = geo.index.array, p = geo.attributes.position, parent = new Int32Array(p.count).map((_, i) => i);
  const find = (v) => { while (parent[v] !== v) v = parent[v] = parent[parent[v]]; return v; };
  if (weld) {
    const at = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
      if (at.has(k)) parent[find(i)] = find(at.get(k)); else at.set(k, i);
    }
  }
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]); parent[find(idx[t + 1])] = a; parent[find(idx[t + 2])] = a; }
  const byRoot = new Map();
  for (let t = 0; t < idx.length / 3; t++) { const r = find(idx[t * 3]); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(t); }
  return [...byRoot.values()];
}
function farLeaves(leaf, keep) {
  const list = pieces3(leaf, false), p = leaf.attributes.position, idx = leaf.index.array;
  const grow = 1 / Math.sqrt(keep); // same total leaf area
  const kept = new Set(), centre = new Map();
  list.forEach((tris, i) => {
    if (((i * 2654435761) >>> 0) / 4294967296 >= keep) return;
    const c = new THREE.Vector3(), seen = new Set();
    tris.forEach((t) => { for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; if (!seen.has(v)) { seen.add(v); c.x += p.getX(v); c.y += p.getY(v); c.z += p.getZ(v); } } });
    c.divideScalar(seen.size);
    tris.forEach((t) => { kept.add(t); for (let k = 0; k < 3; k++) centre.set(idx[t * 3 + k], c); });
  });
  return subset(leaf, (t) => kept.has(t), (pos, order) => {
    order.forEach((v, i) => {
      const c = centre.get(v);
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * grow, c.y + (pos.getY(i) - c.y) * grow, c.z + (pos.getZ(i) - c.z) * grow);
    });
  });
}
/**
 * The trunk (one piece in these models) and its `boughs` biggest branches. Leafy crowns are
 * airy, so a few boughs show through them; a pine's are hidden by its needles.
 */
function farBark(bark, boughs) {
  const list = pieces3(bark, true).sort((a, b) => b.length - a.length).slice(0, 1 + boughs);
  const kept = new Set(list.flat());
  return subset(bark, (t) => kept.has(t));
}

/**
 * Which kind of tree stands at a spot: pines are the kit's or the meadow pack's slender ones;
 * the others the kit's common trees, maples, birches or airy "normal" trees; blossom trees are
 * the twisted ones. Decided by a fixed hash of where it stands, so a tree is the same every visit.
 */
export function treeFamily(t) {
  if (t.type === 'pine') return kit.models.PineTree_1 && variantAt(t.x, t.z, 100, 16) < 40 ? 'slimpine' : 'pine';
  if (t.type === 'blossom') return 'blossom';
  if (!kit.models.MapleTree_1) return 'common';
  const h = variantAt(t.x, t.z, 100, 13);
  return h < 30 ? 'common' : h < 56 ? 'maple' : h < 76 ? 'birch' : kit.models.NormalTree_1 ? 'normal' : 'common';
}
/** How tall each family's model stands at scale 1 (the far cards are sized to match). */
export const TREE_HEIGHT = { pine: 6.4, slimpine: 7.6, common: 6.2, blossom: 6.6, maple: 6.6, birch: 7.4, normal: 6.8 };

/**
 * Kit trees in place of the hand-built ones. `lists` holds four lists of trees: `pines` and
 * `rounds` (drawn as trunks), and `pineItems` and `roundItems` (the same trees with a colour,
 * drawn as leaves). Returns a handle: the seasons recolour the round crowns through it, and
 * `setItems(lists)` swaps in new lists as trees stream in and out.
 */
export function kitTrees(lists, lod) {
  const sets = [];
  const tag = (l) => { for (const k in l) l[k].forEach((t) => { if (!t.family) t.family = treeFamily(t); }); };
  tag(lists);
  // (leaf lists carry colours; trunk lists don't)
  const lodSetOf = (near, far, mat, role, kind, o) => { const set = lodSet(near, far, mat, lists[role], kind, Object.assign({ colored: /Items$/.test(role) }, o)); sets.push([role, set]); return set; };
  const pineModels = [1, 2, 3, 4, 5].map((i) => fit(pieces('Pine_' + i), 6.4, 0.15));
  const roundModels = [1, 2, 3, 4, 5].map((i) => fit(pieces('CommonTree_' + i), 6.2, 0.15));
  const bark = weatherize(std('#ffffff', { map: tex('bark'), flatShading: false, vertexColors: true }), 'std');
  const pineLeaf = crownStd(tex('leaves_pine')), roundLeaf = treeWarp(crownStd(tex('leaves_round')));
  // broadleaf trees each take their own shape (treeWarp): bark, leaves and both shadows bent alike
  const warpedBark = (map) => treeWarp(weatherize(std('#ffffff', { map, flatShading: false, vertexColors: true }), 'std'));
  const barkDepth = () => treeWarp(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const leafDepth = (map) => treeWarp(cutoutDepth(map));
  const meadow = !!kit.models.MapleTree_1, slim = !!kit.models.PineTree_1;
  const pineKind = (t) => (t.family === 'pine' ? variantAt(t.x, t.z, 5, 3) : -1), roundKind = (t) => variantAt(t.x, t.z, 5, 8);
  const pl = pineModels.map((m) => first(m, /Leaves/)), rl = roundModels.map((m) => first(m, /Leaves/));
  const pb = pineModels.map((m) => first(m, /Bark/)), rb = roundModels.map((m) => first(m, /Bark/));
  const L = Object.assign({}, lod, { lift: 3.2, radius: 4 });
  lodSetOf(pb, pb.map((b) => farBark(b, 0)), bark, 'pines', pineKind, L);
  lodSetOf(pl, pl.map((l) => farLeaves(l, FAR_KEEP)), pineLeaf, 'pineItems', pineKind, Object.assign({}, L, { depthMat: cutoutDepth(tex('leaves_pine')) }));
  // the round trees are a mix of three families (by a fixed hash, so nothing moves): the kit's
  // common trees, and maples and birches from the meadow pack; blossom trees are the twisted trees
  const commonKind = (t) => (t.family === 'common' ? roundKind(t) : -1), blossomKind = (t) => (t.type === 'blossom' ? variantAt(t.x, t.z, 5, 9) : -1);
  lodSetOf(rb, rb.map((b) => farBark(b, 3)), warpedBark(tex('bark')), 'rounds', commonKind, Object.assign({}, L, { depthMat: barkDepth() }));
  const common = lodSetOf(rl, rl.map((l) => farLeaves(l, FAR_KEEP)), roundLeaf, 'roundItems', commonKind, Object.assign({}, L, { depthMat: leafDepth(tex('leaves_round')) }));
  const twisted = [1, 2, 3, 4, 5].map((i) => fit(pieces('TwistedTree_' + i), 6.6, 0.15));
  const tl = twisted.map((m) => first(m, /Leaves/)), tb = twisted.map((m) => first(m, /Bark/));
  lodSetOf(tb, tb.map((b) => farBark(b, 3)), warpedBark(tex('bark_twisted')), 'rounds', blossomKind, Object.assign({}, L, { depthMat: barkDepth() }));
  const blossom = lodSetOf(tl, tl.map((l) => farLeaves(l, FAR_KEEP)), treeWarp(crownStd(tex('leaves_bush'))), 'roundItems', blossomKind, Object.assign({}, L, { depthMat: leafDepth(tex('leaves_bush')) }));
  const crowns = [common, blossom];
  if (meadow) {
    // maples (broad, spreading), birches (tall, white-barked) and light, airy common trees
    const fams = [['MapleTree_', 6.6, 'maple', 14], ['BirchTree_', 7.4, 'birch', 15]];
    if (kit.models.NormalTree_1) fams.push(['NormalTree_', 6.8, 'normal', 17]);
    fams.forEach(([prefix, h, fam, salt]) => {
      const models = [1, 2, 3, 4, 5].map((i) => fit(pieces(prefix + i), h, 0.15));
      const ml = models.map((m) => first(m, /Leaves/)), mb = models.map((m) => first(m, /Bark/));
      const kind = (t) => (t.family === fam ? variantAt(t.x, t.z, 5, salt) : -1);
      lodSetOf(mb, mb.map((b) => farBark(b, 3)), warpedBark(tex(fam + '_bark')), 'rounds', kind, Object.assign({}, L, { depthMat: barkDepth() }));
      crowns.push(lodSetOf(ml, ml.map((l) => farLeaves(l, FAR_KEEP)), treeWarp(crownStd(tex(fam + '_leaves'))), 'roundItems', kind, Object.assign({}, L, { depthMat: leafDepth(tex(fam + '_leaves')) })));
    });
  }
  if (slim) {
    // the slender pines: their own bark and needles, green from the pine palette like the others
    const models = [1, 2, 3, 4, 5].map((i) => fit(pieces('PineTree_' + i), 7.6, 0.15));
    const sl = models.map((m) => first(m, /Leaves/)), sb = models.map((m) => first(m, /Bark/));
    const kind = (t) => (t.family === 'slimpine' ? variantAt(t.x, t.z, 5, 18) : -1);
    lodSetOf(sb, sb.map((b) => farBark(b, 0)), weatherize(std('#ffffff', { map: tex('slimpine_bark'), flatShading: false, vertexColors: true }), 'std'), 'pines', kind, L);
    lodSetOf(sl, sl.map((l) => farLeaves(l, FAR_KEEP)), crownStd(tex('slimpine_leaves')), 'pineItems', kind, Object.assign({}, L, { depthMat: cutoutDepth(tex('slimpine_leaves')) }));
  }
  // one handle for the seasons, whichever set draws each tree
  return {
    get count() { return lists.roundItems.length; },
    material: roundLeaf,
    setColorAt(i, c) { crowns.forEach((h) => h.setColorAt(i, c)); },
    commit() {},
    set visible(v) { crowns.forEach((h) => { h.visible = v; }); },
    setItems(next) { lists = next; tag(lists); sets.forEach(([role, set]) => set.setItems(lists[role])); },
    get dropped() { return sets.reduce((a, [, set]) => a + set.dropped, 0); },
  };
}

// ───────────── rocks ─────────────
export function kitRocks(rocks, opts) {
  const geos = [1, 2, 3].map((i) => first(fit(pieces('Rock_Medium_' + i), 1.45), /Rock/));
  const mat = weatherize(std('#ffffff', { map: tex('rocks'), flatShading: false }), 'std');
  // the rock texture is dark and mossy; lift the per-rock greys so the shore reads as before
  const items = rocks.map((r) => Object.assign({}, r, { sx: r.sx * 0.95, sz: r.sz * 0.95, sy: r.sy * 1.2, color: r.color.clone().multiplyScalar(2.4) }));
  if (!kit.models.Rock_1) { instancedVariants(geos, mat, items, (r) => variantAt(r.x, r.z, 3, 11), opts); return; }
  // with the meadow pack, half the rocks are its light, craggy boulders
  const pick = (r) => variantAt(r.x, r.z, 8, 11);
  instancedVariants(geos, mat, items, (r) => (pick(r) < 3 ? pick(r) : -1), opts);
  const crags = [1, 2, 3, 4, 5].map((i) => first(fit(pieces('Rock_' + i), 1.2), /Rock/));
  const cragMat = weatherize(std('#ffffff', { map: tex('crag'), flatShading: false }), 'std');
  const cragItems = rocks.map((r) => Object.assign({}, r, { color: r.color.clone().multiplyScalar(1.6) }));
  instancedVariants(crags, cragMat, cragItems, (r) => (pick(r) >= 3 ? pick(r) - 3 : -1), opts);
}

// ───────────── grass near you ─────────────
export function kitGrass(blades) {
  const short = shadeByHeight(first(fit(pieces('Grass_Common_Short'), 0.62), /Grass/), 0.5, 1.2), tall = shadeByHeight(first(fit(pieces('Grass_Common_Tall'), 0.8), /Grass/), 0.5, 1.2);
  // (the kit's grass texture is only a palette strip; the meadow's own grass colours do that job)
  world.grassKitMat = bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.55, KIT_GRASS_FADE), 'lam'));
  // a kit clump is fuller than a light tuft, so it takes the place of only some of them
  const kind = (b) => { const h = variantAt(b.x, b.z, 100, 31); return h < 52 ? 0 : h < 62 ? 1 : -1; };
  instancedVariants([short, tall], world.grassKitMat, blades, kind, { cast: false, cell: 16, far: KIT_GRASS_FADE[1] });
}

// ───────────── two more flower kinds ─────────────
/** Kinds 5 (cup flower) and 6 (yellow bells) come from the kit; their colour is in the texture. */
export const KIT_FLOWER_COLOURS = { 5: col('#e7785c'), 6: col('#f2c53d') };
export function kitFlowerParts(flowers) {
  const f3 = fit(pieces('Flower_3_Single'), 0.62), f4 = fit(pieces('Flower_4_Single'), 0.6);
  [f3, f4].forEach((m) => Object.values(m).forEach((g) => shadeByHeight(g, 0.7, 1.1)));
  const fade = (m) => softEdges(bothSides(addWind(m, 0.6, KIT_FLOWER_FADE)));
  const leafMat = fade(new THREE.MeshLambertMaterial({ map: tex('leaves'), alphaTest: 0.5, vertexColors: true }));
  const petalMat = softEdges(neonAtNight(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ map: tex('flowers'), alphaTest: 0.5, vertexColors: true }), 0.6, KIT_FLOWER_FADE), 'lam'))));
  const plain = flowers.map((f) => Object.assign({}, f, { color: null }));
  const kind = (f) => (f.kind >= 5 ? f.kind - 5 : -1);
  const o = { cell: 40, far: KIT_FLOWER_FADE[1] };
  return [
    instancedVariants([first(f3, /Leaves/), first(f4, /Leaves/)], leafMat, plain, kind, o),
    instancedVariants([first(f3, /Flowers/), first(f4, /Flowers/)], petalMat, plain, kind, o),
  ];
}

// ───────────── undergrowth ─────────────
export function buildUndergrowth(treeSpots) {
  const R = mulberry32(51507), r = (a, b) => a + (b - a) * R();
  const free = (x, z, room) => lakeT(x, z) > 1.15 && pathAmt(x, z) < 0.05 && !nearReserved(x, z, room) && Math.hypot(x - SPAWN.x, z - SPAWN.z) > 5 && Math.hypot(x, z) < 125;
  const bushes = [], ferns = [], clover = [], shrooms = [];
  const greens = ['#7aa84a', '#86b352', '#6b9a40', '#93bb5a'].map(col);
  for (const t of treeSpots) {
    if (R() < 0.38) {
      const a = r(0, TAU), d = r(2.2, 3.6), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (free(x, z, 1.6)) bushes.push({ x, z, y: height(x, z) - 0.05, s: r(0.75, 1.3), ry: r(0, TAU), flowers: R() < 0.3, color: greens[Math.floor(R() * greens.length)] });
    }
    if (t.type === 'pine' && R() < 0.5) {
      const a = r(0, TAU), d = r(1.0, 2.2), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (free(x, z, 1.2)) ferns.push({ x, z, y: height(x, z) - 0.03, s: r(0.8, 1.3), ry: r(0, TAU) });
    }
    if (t.type !== 'pine' && R() < 0.28) {
      for (let k = 0; k < 1 + Math.floor(R() * 3); k++) {
        const a = r(0, TAU), d = r(0.7, 1.4), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (free(x, z, 1)) shrooms.push({ x, z, y: height(x, z) - 0.02, s: r(0.7, 1.3), ry: r(0, TAU) });
      }
    }
  }
  for (let i = 0; i < 900 && clover.length < 150; i++) {
    const a = r(0, TAU), d = Math.sqrt(R()) * 95, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (fbm(x * 0.08 - 13, z * 0.08 + 5) < 0.55 || !free(x, z, 1.1)) continue;
    clover.push({ x, z, y: height(x, z) - 0.02, s: r(0.8, 1.4), ry: r(0, TAU) });
  }

  const wind = (m, k) => addWind(m, k, UNDERGROWTH_FADE);
  const bushPlain = roundNormals(first(fit(pieces('Bush_Common'), 1.0, 0.1), /Leaves/));
  const bushFl = fit(pieces('Bush_Common_Flowers'), 1.0, 0.1);
  Object.values(bushFl).forEach(roundNormals);
  const leafMat = (map) => softEdges(weatherize(wind(std('#ffffff', { map, alphaTest: 0.5, side: THREE.DoubleSide, flatShading: false, vertexColors: true }), 0.05), 'std'));
  // the two bushes are laid out on different leaf textures
  const o = { cast: true, shadowRange: UNDERGROWTH_FADE[1], cell: 40, far: UNDERGROWTH_FADE[1] };
  world.bushes = instancedVariants([bushPlain], leafMat(tex('leaves_bush')), bushes, (b) => (b.flowers ? -1 : 0), Object.assign({ depthMat: cutoutDepth(tex('leaves_bush')) }, o));
  world.bushesInBloom = instancedVariants([first(bushFl, /Leaves/)], leafMat(tex('leaves_round')), bushes, (b) => (b.flowers ? 0 : -1), Object.assign({ depthMat: cutoutDepth(tex('leaves_round')) }, o));
  const bloom = softEdges(neonAtNight(bothSides(wind(new THREE.MeshLambertMaterial({ map: tex('flowers'), alphaTest: 0.5, vertexColors: true }), 0.05)), 0.8));
  world.bushBlooms = instancedVariants([first(bushFl, /Flowers/)], bloom, bushes.map((b) => Object.assign({}, b, { color: null })), (b) => (b.flowers ? 0 : -1), { cell: 40, far: UNDERGROWTH_FADE[1] });
  const leafy = softEdges(bothSides(wind(new THREE.MeshLambertMaterial({ map: tex('leaves'), alphaTest: 0.5, vertexColors: true }), 0.3)));
  world.ferns = instancedVariants([shadeByHeight(first(fit(pieces('Fern_1'), 0.45), /Leaves/), 0.6, 1.1)], leafy, ferns, () => 0, { cell: 40, far: UNDERGROWTH_FADE[1] });
  const leafyNear = softEdges(bothSides(addWind(new THREE.MeshLambertMaterial({ map: tex('leaves'), alphaTest: 0.5, vertexColors: true }), 0.3, [22, 32])));
  world.clover = instancedVariants([shadeByHeight(first(fit(pieces('Clover_1'), 0.3), /Leaves/), 0.6, 1.1)], leafyNear, clover, () => 0, { cell: 30, far: 32 });
  const shroomMat = wind(std('#ffffff', { map: tex('mushrooms'), flatShading: false }), 0);
  world.mushrooms = instancedVariants([first(fit(pieces('Mushroom_Common'), 0.22), /Mushroom/)], shroomMat, shrooms, () => 0, { cell: 40, far: UNDERGROWTH_FADE[1] });
  world.undergrowth = { bushes: bushes.length, ferns: ferns.length, clover: clover.length, mushrooms: shrooms.length };
}
