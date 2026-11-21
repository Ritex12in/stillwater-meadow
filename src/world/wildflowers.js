// A wildflower meadow round the places you walk and sit: clumps of daisies and lupins (built
// here), the kit's flower clumps, wispy grass and broad-leaved plants, and pebbles on the shore.
// Decoration only (you pick the meadow's other flowers). Its own random stream: nothing else moves.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, mulberry32, fbm } from '../core/math.js';
import { height, lakeT, lakeR, pathAmt, nearReserved, onDock, LAKE, PATH_T, BENCH_SPOT, SPAWN, WORLD_LIMIT } from '../core/shape.js';
import { col, weatherize, addWind, bothSides, instancedVariants, slotSet, softEdges, neonAtNight } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';
import { world } from '../core/state.js';

const FADE = [22, 42];
const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const merge = (parts) => BufferGeometryUtils.mergeBufferGeometries(parts.map((g) => {
  const n = g.index ? g.toNonIndexed() : g;
  if (n.attributes.uv) n.deleteAttribute('uv');
  return n;
}));
const GREEN = [0.36, 0.55, 0.22], DARK = [0.25, 0.42, 0.17];
/** Dark at the root, light at the tips, lit from above (the kit grass has no colour of its own). */
function greenByHeight(g) {
  g.computeBoundingBox();
  const p = g.attributes.position, c = g.attributes.color, n = g.attributes.normal, top = g.boundingBox.max.y || 1;
  for (let i = 0; i < p.count; i++) { const v = 0.45 + 0.7 * Math.max(0, p.getY(i)) / top; c.setXYZ(i, v, v * 1.02, v * 0.9); n.setXYZ(i, 0, 1, 0); }
  return g;
}

/** One daisy: a thin stem and a flat star of white petals round a golden centre. */
function daisy(h, tilt, turn) {
  const stem = paint(new THREE.CylinderGeometry(0.006, 0.009, h, 3, 1, true).translate(0, h / 2, 0), GREEN);
  const head = [];
  const petals = 10;
  for (let i = 0; i < petals; i++) {
    head.push(paint(new THREE.PlaneGeometry(0.022, 0.07).translate(0, 0.045, 0).rotateX(-Math.PI / 2 + 0.25).rotateY((i / petals) * TAU), [1.15, 1.15, 1.1]));
  }
  head.push(paint(new THREE.SphereGeometry(0.02, 5, 2, 0, TAU, 0, Math.PI / 2).scale(1, 0.55, 1), [1.25, 0.9, 0.2]));
  return merge([stem, merge(head).rotateX(tilt).rotateY(turn).translate(0, h, 0)]);
}
function daisyClump() {
  const r = mulberry32(811), parts = [];
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 0.22;
    parts.push(daisy(0.22 + r() * 0.2, (r() - 0.5) * 0.4, r() * TAU).translate(Math.cos(a) * d, 0, Math.sin(a) * d));
  }
  for (let i = 0; i < 6; i++) { // a rosette of leaves
    const leaf = new THREE.PlaneGeometry(0.035, 0.14).translate(0, 0.07, 0).rotateX(-1.1).rotateY(r() * TAU);
    parts.push(paint(leaf, DARK));
  }
  return merge(parts);
}

/** Lupins: tapering spikes of little florets (tinted per clump) over stems and a fan of leaves. */
function lupinClump() {
  const r = mulberry32(1709), florets = [], greens = [];
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU, d = r() * 0.16, ox = Math.cos(a) * d, oz = Math.sin(a) * d, h = 0.55 + r() * 0.3, turn = r() * TAU;
    greens.push(paint(new THREE.CylinderGeometry(0.008, 0.012, h, 3, 1, true).translate(ox, h / 2, oz), GREEN));
    const rows = 8;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), y = h * (0.5 + 0.5 * t), rad = 0.045 * (1 - t * 0.75), n = Math.max(3, Math.round(6 - t * 3));
      for (let k = 0; k < n; k++) {
        const fa = (k / n) * TAU + j * 0.6 + turn, lift = 0.8 + 0.4 * t; // paler toward the tip
        florets.push(paint(new THREE.TetrahedronGeometry(0.022 * (1 - t * 0.4)).translate(ox + Math.cos(fa) * rad, y, oz + Math.sin(fa) * rad), [lift, lift, lift]));
      }
    }
  }
  for (let i = 0; i < 9; i++) greens.push(paint(new THREE.PlaneGeometry(0.03, 0.18).translate(0, 0.09, 0).rotateX(-0.9).rotateY((i / 9) * TAU), GREEN));
  return { florets: merge(florets), greens: merge(greens) };
}

export function buildWildflowers() {
  const R = mulberry32(27182), r = (a, b) => a + (b - a) * R();
  const free = (x, z) => lakeT(x, z) > 1.13 && pathAmt(x, z) < 0.12 && !nearReserved(x, z, 1.2) && !onDock(x, z) && Math.hypot(x - BENCH_SPOT.x, z - BENCH_SPOT.z) > 1.6 && Math.hypot(x - SPAWN.x, z - SPAWN.z) > 2.5 && Math.hypot(x, z) < WORLD_LIMIT - 6;
  const items = [];
  // clusters: along both sides of the path, round the bench and lamps, and out in the meadow
  const centres = [];
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, Rr = lakeR(a), side = R() < 0.5 ? -1 : 1;
    centres.push({ x: LAKE.x + Math.cos(a) * (Rr * PATH_T + side * r(2.2, 5)), z: LAKE.z + Math.sin(a) * (Rr * PATH_T + side * r(2.2, 5)), n: 8 + Math.floor(R() * 10), rad: r(1.5, 3.5) });
  }
  for (let i = 0; i < 6; i++) centres.push({ x: BENCH_SPOT.x + r(-3, 3), z: BENCH_SPOT.z + r(-3, 3), n: 10, rad: 2 });
  for (let i = 0; i < 40; i++) {
    const a = R() * TAU, d = 40 + Math.sqrt(R()) * 60, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (fbm(x * 0.05 + 3, z * 0.05 - 7) > 0.5) centres.push({ x, z, n: 6 + Math.floor(R() * 8), rad: r(2, 5) });
  }
  const purples = ['#7b5bd6', '#9a6ee0', '#6a63d8', '#c46fd0', '#e58fc9', '#f2f0ff'].map(col);
  for (const c of centres) {
    // each cluster has a favourite kind
    const fav = Math.floor(R() * 5);
    for (let k = 0; k < c.n; k++) {
      const a = R() * TAU, d = c.rad * Math.sqrt(R()), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (!free(x, z)) continue;
      let kind = R() < 0.6 ? fav : Math.floor(R() * 5);
      if (kind === 4) kind = 0; // (no broad plant: more daisies)
      if (kind === 3) kind = R() < 0.5 ? 0 : 2; // the kit's yellow bells are too heavy (1,700 triangles) to scatter
      items.push({ x, z, y: height(x, z) - 0.02, s: r(0.8, 1.25), ry: r(0, TAU), kind, color: kind === 1 ? purples[Math.floor(R() * purples.length)] : null });
    }
  }
  // (the wispy grass tufts are gone: the GPU grass field covers the meadow)
  for (let i = 0, n = 0; i < 0 && n < 600; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 100, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (free(x, z) && fbm(x * 0.09 - 2, z * 0.09 + 4) > 0.5) { items.push({ x, z, y: height(x, z) - 0.03, s: r(0.7, 1.2), ry: r(0, TAU), kind: 5, color: null }); n++; }
  }
  // pebbles in the sand round the lake
  const pebbles = [];
  for (let i = 0; i < 260; i++) {
    const a = R() * TAU, t = r(1.0, 1.1), x = LAKE.x + Math.cos(a) * lakeR(a) * t, z = LAKE.z + Math.sin(a) * lakeR(a) * t;
    if (!onDock(x, z) && !nearReserved(x, z, 0.8)) pebbles.push({ x, z, y: height(x, z) - 0.03, s: r(0.5, 1.4), ry: r(0, TAU), kind: Math.floor(R() * 3) });
  }

  // geometry for kinds: 0 daisy, 1 lupin (tinted), 2 red tulip clump, 3 yellow bells, 4 broad plant, 5 wispy grass
  const piece = (name, h, re) => { const p = fit(Object.fromEntries(Object.entries(kit.models[name]).map(([k, g]) => [k, g.clone()])), h); return Object.entries(p).filter(([k]) => re.test(k)).map(([, g]) => g); };
  const plain = neonAtNight(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.25, FADE), 'lam')), 0.7);
  const leaves = softEdges(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ map: kit.tex.leaves, alphaTest: 0.5, vertexColors: true }), 0.4, FADE), 'lam')));
  const blooms = softEdges(neonAtNight(bothSides(addWind(new THREE.MeshLambertMaterial({ map: kit.tex.flowers, alphaTest: 0.5, vertexColors: true }), 0.4, FADE))));
  const grassMat = bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ color: '#9cb85a', vertexColors: true }), 0.6, [16, 34]), 'lam')); // dense model: kept near
  const o = { cell: 30, far: FADE[1] }, lupins = lupinClump();
  const sub = (k) => (it) => (it.kind === k ? 0 : -1), daisyGeo = daisyClump();
  world.wild = [
    instancedVariants([daisyGeo], plain, items, sub(0), o),
    // its own material: three r128 doesn't recompile a shared one for meshes with per-instance colour
    instancedVariants([lupins.florets], neonAtNight(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.15, FADE), 'lam'))), items, sub(1), o),
    instancedVariants([lupins.greens], bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.15, FADE), 'lam')), items.map((it) => Object.assign({}, it, { color: null })), sub(1), o), // same sway as the florets
    instancedVariants([piece('Flower_3_Group', 0.5, /Leaves/)[0], piece('Flower_4_Group', 0.5, /Leaves/)[0]], leaves, items, (it) => (it.kind === 2 || it.kind === 3 ? it.kind - 2 : -1), o),
    instancedVariants([piece('Flower_3_Group', 0.5, /Flowers/)[0], piece('Flower_4_Group', 0.5, /Flowers/)[0]], blooms, items, (it) => (it.kind === 2 || it.kind === 3 ? it.kind - 2 : -1), o),
    instancedVariants([greenByHeight(piece('Grass_Wispy_Tall', 0.55, /Grass/)[0])], grassMat, items, sub(5), { cell: 20, far: 34 }),
  ];
  const rockMat = weatherize(new THREE.MeshStandardMaterial({ map: kit.tex.pathrocks, roughness: 0.9, vertexColors: true }), 'std');
  instancedVariants(['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3'].map((n) => piece(n, 0.12, /./)[0]), rockMat, pebbles, (p) => p.kind, { cell: 40, far: 60, cast: false });
  world.wildCount = items.length;
  // The same clumps out in the wilds (world/wilds.js): daisies, lupins and red tulips, in fixed
  // slots refilled as you walk. They join world.wild, so winter and the wildflower setting hide
  // them with the rest. (Each set shares its material with the valley's set of the same flower.)
  const wild = [
    slotSet([daisyGeo], plain, 420),
    slotSet([lupins.florets], world.wild[1].material, 260, { colored: true }),
    slotSet([lupins.greens], world.wild[2].material, 260),
    slotSet([piece('Flower_3_Group', 0.5, /Leaves/)[0]], leaves, 200),
    slotSet([piece('Flower_3_Group', 0.5, /Flowers/)[0]], blooms, 200),
  ];
  world.wild.push(...wild);
  world.setWildFlowers = (list) => {
    wild[0].setItems(list, sub(0));
    wild[1].setItems(list, sub(1)); wild[2].setItems(list, sub(1));
    wild[3].setItems(list, sub(2)); wild[4].setItems(list, sub(2));
    return wild.reduce((a, w) => a + w.dropped, 0);
  };
  /** Lupin colours, for whoever plants them. */
  world.lupinColours = purples;
}
