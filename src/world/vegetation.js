// Trees, rocks, grass, flowers, reeds and lily pads. Placement order and random draws are kept
// exactly as before so the landscape looks the same; big sets are split into culled chunks.
import * as THREE from 'three';
import { TAU, rng, rand, pick, smooth, fbm, vnoise, angDiff } from '../core/math.js';
import { height, lakeT, lakePoint, pathAmt, SPAWN, onDock, dockStart, DOCK_A, nearReserved, BENCH_SPOT } from '../core/shape.js';
import { std, col, weatherize, addWind, bothSides, instanced, instancedChunks, instancedVariants } from '../core/materials.js';
import { pineGeos, crownGeos, grassTuftGeos, flowerHeadGeos, flowerCentreGeo, flowerStemGeo, variantAt, FLOWER_KINDS, FLOWER_CENTRE } from './detail.js';
import { world, obstacles } from '../core/state.js';

export const treeSpots = [];

export function buildTrees() {
  let tries = 0;
  while (treeSpots.length < 320 && tries < 30000) {
    tries++;
    const a = rng() * TAU, r = Math.sqrt(rng()) * 155;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (lakeT(x, z) < 1.22 || pathAmt(x, z) > 0.02) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10) continue;
    if (Math.hypot(x - BENCH_SPOT.x, z - BENCH_SPOT.z) < 4) continue;
    if (nearReserved(x, z, 4)) continue;
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

  const bark = std('#6b4f3a');
  const leaf = weatherize(std('#ffffff', { vertexColors: true }), 'std');
  const pineCols = ['#2f5a3a', '#3b6a40', '#2a4e37', '#456f43'].map(col);
  const roundCols = ['#5b8f3e', '#6fa04a', '#4d7f3a', '#86a948', '#7a9c3c'].map(col);
  const blossomCols = ['#f2b8c6', '#eaa3b8', '#f7cdd8'].map(col);

  // colours are drawn in the original order (all pines, then all the others) so nothing shifts
  const pineItems = pines.map((t) => Object.assign({}, t, { color: pick(pineCols) }));
  world.roundItems = rounds.map((t) => Object.assign({}, t, { color: t.type === 'blossom' ? pick(blossomCols) : pick(roundCols) }));
  const pg = pineGeos(), cg = crownGeos();
  const pineKind = (t) => variantAt(t.x, t.z, pg.length, 3), crownKind = (t) => variantAt(t.x, t.z, cg.length, 8);
  instancedVariants(pg.map((g) => g.trunk), bark, pines, pineKind, { cast: true, cell: 90 });
  instancedVariants(pg.map((g) => g.top), leaf, pineItems, pineKind, { cast: true, cell: 90 });
  instancedVariants(cg.map((g) => g.trunk), bark, rounds, crownKind, { cast: true, cell: 90 });
  world.roundTop = instancedVariants(cg.map((g) => g.top), leaf, world.roundItems, crownKind, { cast: true, cell: 90 });
  treeSpots.forEach((t) => obstacles.push({ x: t.x, z: t.z, r: 0.32 * t.s }));
}

export function buildRocks() {
  const rocks = [];
  const rockCols = ['#8f8d82', '#7d7c73', '#a09d90', '#6f6e68'].map(col);
  for (let i = 0; i < 70; i++) {
    const shore = i < 22;
    let x, z, tries = 0;
    do {
      tries++;
      if (shore) { const p = lakePoint(rng() * TAU, rand(0.97, 1.12)); x = p.x; z = p.z; }
      else { const a = rng() * TAU, r = Math.sqrt(rng()) * 120; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    } while (tries < 20 && (onDock(x, z) || pathAmt(x, z) > 0.1 || (!shore && lakeT(x, z) < 1.15) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6 || nearReserved(x, z, 2.6)));
    const s = shore ? rand(0.35, 0.9) : rand(0.4, 1.5);
    rocks.push({ x, z, y: height(x, z) - s * 0.25, s, sx: s * rand(0.9, 1.5), sy: s * rand(0.55, 0.9), sz: s * rand(0.9, 1.3), ry: rng() * TAU, rx: rand(-0.2, 0.2), color: pick(rockCols) });
    if (s > 0.6) obstacles.push({ x, z, r: s * 0.95 });
  }
  instancedChunks(new THREE.IcosahedronGeometry(1, 0), weatherize(std('#ffffff'), 'std'), rocks, { cast: true, cell: 60 });
}

export function buildGrass() {
  const blades = [];
  for (let i = 0; i < 12; i++) rng(); // the old tuft shape used twelve layout draws; keep the stream in step
  const tufts = grassTuftGeos();

  const grassCols = ['#6f9c45', '#83ad4f', '#5d8a3e', '#9bb957', '#77a24a'].map(col);
  for (let i = 0; i < 26000; i++) {
    const a = rng() * TAU, r = Math.sqrt(rng()) * 100;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (lakeT(x, z) < 1.1 || pathAmt(x, z) > 0.35 || nearReserved(x, z, 1.1)) continue;
    const h = height(x, z);
    if (h > 10) continue;
    if (fbm(x * 0.06 + 40, z * 0.06) < 0.38 && rng() < 0.6) continue;
    const s = rand(0.7, 1.35);
    blades.push({ x, z, y: h - 0.03, s, sy: s * rand(0.7, 1.15), ry: rng() * TAU, color: pick(grassCols) });
  }
  world.grassMat = bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.55), 'lam'));
  // seed stalks gather in drifts; low clumps fill in between the upright ones
  const tuftKind = (it) => { const h = variantAt(it.x, it.z, 100, 21); return vnoise(it.x * 0.09 + 3, it.z * 0.09 - 7) > 0.62 && h < 45 ? 2 : h < 58 ? 0 : h < 90 ? 1 : 2; };
  world.grass = instancedVariants(tufts, world.grassMat, blades, tuftKind, { cast: false, cell: 36 });
}

export function buildFlowers() {
  const flowers = [];
  const petals = ['#ffffff', '#f6d65a', '#f19cb7', '#b7a3e6', '#ff9f7a', '#fdf0b0'].map(col);
  for (let i = 0; i < 9000 && flowers.length < 1800; i++) {
    const a = rng() * TAU, r = Math.sqrt(rng()) * 90;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (lakeT(x, z) < 1.14 || pathAmt(x, z) > 0.2 || nearReserved(x, z, 1.1)) continue;
    if (fbm(x * 0.07 + 20, z * 0.07 - 4) < 0.56) continue;
    const patch = Math.floor(vnoise(x * 0.15, z * 0.15) * petals.length) % petals.length;
    flowers.push({ x, z, y: height(x, z) - 0.02, s: rand(0.8, 1.4), ry: rng() * TAU, color: rng() < 0.8 ? petals[patch] : pick(petals) });
  }
  // kinds grow in drifts, with a few strays; stems vary in height
  flowers.forEach((f) => {
    const drift = Math.floor(vnoise(f.x * 0.12 + 7, f.z * 0.12 + 3) * FLOWER_KINDS.length * 1.6) % FLOWER_KINDS.length;
    f.kind = variantAt(f.x, f.z, 10, 5) < 7 ? drift : variantAt(f.x, f.z, FLOWER_KINDS.length, 6);
    f.sy = f.s * (0.75 + 0.6 * variantAt(f.x, f.z, 100, 7) / 100);
  });
  const stemMat = bothSides(addWind(new THREE.MeshLambertMaterial({ color: '#4f7a36', vertexColors: true }), 0.6));
  const headMat = bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), 0.6), 'lam'));
  const centreMat = addWind(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.6);
  const centres = flowers.map((f) => Object.assign({}, f, { color: FLOWER_CENTRE[FLOWER_KINDS[f.kind]] ? col(FLOWER_CENTRE[FLOWER_KINDS[f.kind]]) : null }));
  world.flowerItems = flowers;
  const parts = [
    instancedChunks(flowerStemGeo(), stemMat, flowers.map((f) => Object.assign({}, f, { color: null })), { cell: 50 }),
    instancedVariants(flowerHeadGeos(), headMat, flowers, (f) => f.kind, { cell: 50 }),
    instancedVariants([flowerCentreGeo()], centreMat, centres, (f) => (f.color ? 0 : -1), { cell: 50 }),
  ];
  /** Every part of flower `i` shows or hides together. */
  world.flowerSet = { setVisibleAt(i, on) { parts.forEach((p) => p.setVisibleAt(i, on)); }, commit() { parts.forEach((p) => p.commit()); } };
}

export function buildReedsAndPads() {
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
  instancedChunks(new THREE.ConeGeometry(0.035, 1.5, 3).translate(0, 0.75, 0), addWind(std('#ffffff'), 0.07), reeds, { cell: 30 });
  instancedChunks(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 5).translate(0, 1.15, 0), addWind(std('#6e4a2e'), 0.07), reeds.filter((_, i) => i % 3 === 0), { cell: 30 });

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
