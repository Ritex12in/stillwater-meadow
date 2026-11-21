// Built things: the jetty, the bench, lawn chairs and the path lamps.
//
// Each is made once and then *placed*: put where the lake's landmarks are (core/shape.js). The
// landmarks can move to another lake (anchorTo), and then everything here is placed again, along
// with its seat to sit on, the obstacle that stops you walking through it, and the lamps' light.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../core/render.js';
import { TAU, rand, pick, angDiff } from '../core/math.js';
import { height, LAKE, lakePoint, PATH_T, dockStart, dockDir, DOCK_A, DOCK_BACK, DOCK_LEN, DOCK_HALF, DOCK_Y, chairSpots, BENCH_SPOT } from '../core/shape.js';
import { std, weatherize, glowTex } from '../core/materials.js';
import { world, obstacles, seats, hooks } from '../core/state.js';
import { kitBench } from './kitprops.js';

export const lampMat = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffbb55', emissiveIntensity: 0, transparent: true, opacity: 0.85, roughness: 0.2 });
export const lampGlows = [];

let dock = null, bench = null, benchSeat = null, benchBlock = null;

export function buildDockAndBench() {
  // the jetty: planks and posts, made round the point where it leaves the shore, deck at height 0
  dock = new THREE.Group();
  const plankCols = ['#9b7653', '#8c6a4a', '#a7815c'];
  const plankMats = new Map(); // one material per colour instead of one per plank
  const plankGeo = new THREE.BoxGeometry(DOCK_HALF * 2, 0.08, 0.5);
  for (let s = -DOCK_BACK; s < DOCK_LEN; s += 0.56) {
    const c = pick(plankCols);
    if (!plankMats.has(c)) plankMats.set(c, weatherize(std(c), 'std'));
    const m = new THREE.Mesh(plankGeo, plankMats.get(c));
    m.position.set(rand(-0.03, 0.03), 0, s + 0.25);
    m.rotation.y = rand(-0.015, 0.015);
    m.castShadow = true; m.receiveShadow = true;
    dock.add(m);
  }
  const postMat = std('#6b4f3a'), postGeo = new THREE.CylinderGeometry(0.09, 0.1, 2.4, 6);
  for (let s = 0.5; s < DOCK_LEN; s += 2.8) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(side * (DOCK_HALF - 0.08), -0.9, s);
      post.castShadow = true;
      dock.add(post);
    }
  }
  scene.add(dock);

  world.benchPos = BENCH_SPOT;
  bench = new THREE.Group();
  const wood = weatherize(std('#8a6646'), 'std'), iron = std('#3a3f3f');
  if (!kitBench(bench)) [
    [new THREE.BoxGeometry(1.9, 0.07, 0.5), wood, 0, 0.48, 0, 0],
    [new THREE.BoxGeometry(1.9, 0.36, 0.06), wood, 0, 0.8, -0.24, -0.18],
    [new THREE.BoxGeometry(0.08, 0.5, 0.48), iron, -0.85, 0.24, 0, 0],
    [new THREE.BoxGeometry(0.08, 0.5, 0.48), iron, 0.85, 0.24, 0, 0],
  ].forEach(([g, m, x, y, z, rx]) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.castShadow = true;
    bench.add(mesh);
  });
  scene.add(bench);
  benchBlock = { x: 0, z: 0, r: 0.95 };
  benchSeat = { name: 'bench', x: 0, z: 0, baseY: 0, top: 0.515, rot: 0, standOff: 1.35 };
  obstacles.push(benchBlock);
  seats.push(benchSeat);
  placeDockAndBench();
  hooks.anchor.push(placeDockAndBench);
}
/** Put the jetty at the lake's jetty spot, and the bench at its bench spot, facing the water. */
function placeDockAndBench() {
  dock.position.set(dockStart.x, DOCK_Y, dockStart.z);
  dock.rotation.y = Math.atan2(dockDir.x, dockDir.z);
  const bp = BENCH_SPOT;
  bench.position.set(bp.x, height(bp.x, bp.z), bp.z);
  bench.rotation.y = Math.atan2(LAKE.x - bp.x, LAKE.z - bp.z);
  benchBlock.x = bp.x; benchBlock.z = bp.z;
  benchSeat.x = bp.x; benchSeat.z = bp.z; benchSeat.baseY = bench.position.y; benchSeat.rot = bench.rotation.y;
}

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
// two lawn chairs by the water, and one at the end of the jetty
const chairs = [];
function addChair(paint) {
  const c = { g: makeChair(paint), block: { x: 0, z: 0, r: 0.45 }, seat: { name: 'chair', x: 0, z: 0, baseY: 0, top: 0.44, rot: 0, standOff: 0.9 } };
  scene.add(c.g);
  obstacles.push(c.block);
  seats.push(c.seat);
  chairs.push(c);
}
function setChair(c, x, z, baseY, rot) {
  c.g.position.set(x, baseY, z);
  c.g.rotation.y = rot;
  c.block.x = x; c.block.z = z;
  c.seat.x = x; c.seat.z = z; c.seat.baseY = baseY; c.seat.rot = rot;
}

export function buildChairs() {
  ['#efe9dc', '#86aea6', '#d8a95e'].forEach(addChair);
  placeChairs();
  hooks.anchor.push(placeChairs);
}
function placeChairs() {
  chairSpots.forEach((p, i) => {
    const rot = Math.atan2(LAKE.x - p.x, LAKE.z - p.z) + (i ? -0.12 : 0.12);
    setChair(chairs[i], p.x, p.z, height(p.x, p.z) - 0.02, rot);
  });
  const s = DOCK_LEN - 1.9, w = -0.5;
  setChair(chairs[2], dockStart.x + dockDir.x * s + dockDir.z * w, dockStart.z + dockDir.z * s - dockDir.x * w, DOCK_Y + 0.04, Math.atan2(dockDir.x, dockDir.z) - 0.35);
}

/** A classic park lamp: stepped base, slim fluted post, collar, and a glass lantern with a peaked roof. */
function lampGeos() {
  const iron = [], glass = [];
  const add = (list, g) => list.push(g.toNonIndexed());
  add(iron, new THREE.CylinderGeometry(0.17, 0.21, 0.16, 8).translate(0, 0.08, 0));
  add(iron, new THREE.CylinderGeometry(0.11, 0.15, 0.22, 8).translate(0, 0.27, 0));
  add(iron, new THREE.CylinderGeometry(0.045, 0.065, 1.75, 8).translate(0, 1.25, 0));
  add(iron, new THREE.TorusGeometry(0.06, 0.018, 5, 10).rotateX(Math.PI / 2).translate(0, 0.5, 0));
  add(iron, new THREE.CylinderGeometry(0.09, 0.05, 0.12, 8).translate(0, 2.16, 0));          // collar
  add(iron, new THREE.CylinderGeometry(0.15, 0.13, 0.04, 4).rotateY(Math.PI / 4).translate(0, 2.24, 0)); // lantern floor
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(iron, new THREE.BoxGeometry(0.022, 0.36, 0.022).translate(x * 0.105, 2.44, z * 0.105));
  add(iron, new THREE.ConeGeometry(0.21, 0.2, 4).rotateY(Math.PI / 4).translate(0, 2.72, 0));      // roof
  add(iron, new THREE.SphereGeometry(0.035, 6, 4).translate(0, 2.85, 0));                          // finial
  add(glass, new THREE.BoxGeometry(0.2, 0.34, 0.2).translate(0, 2.44, 0));
  return { iron: BufferGeometryUtils.mergeBufferGeometries(iron), glass: BufferGeometryUtils.mergeBufferGeometries(glass) };
}

/** Where the lanterns hang (for the light they throw on the ground). */
export const lampSpots = [];
// The lamps stand round the lake's path, twelve to the circle less the one that would block the
// jetty. Each remembers its place in that circle *relative to the jetty* (`off`), so when the
// landmarks stand at another lake, turned another way, the lamps turn with them.
const lamps = [];

export function buildLamps() {
  const postMat = std('#22282a', { flatShading: false, roughness: 0.55, metalness: 0.3 });
  const { iron, glass } = lampGeos();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffc979', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.2;
    if (Math.abs(angDiff(a, DOCK_A)) < 0.2) continue;
    const post = new THREE.Mesh(iron, postMat);
    post.castShadow = true;
    const lamp = new THREE.Mesh(glass, lampMat);
    const glow = new THREE.Sprite(glowMat); // all lamps share one material: one opacity update per frame
    glow.scale.set(2.4, 2.4, 1);
    scene.add(post, lamp, glow);
    const l = { post, lamp, glow, spot: new THREE.Vector3(), block: { x: 0, z: 0, r: 0.2 }, a, off: a - DOCK_A };
    lamps.push(l);
    lampGlows.push(glow);
    lampSpots.push(l.spot);
    obstacles.push(l.block);
  }
  placeLamps(true);
  hooks.anchor.push(() => placeLamps(false));
}
function placeLamps(first) {
  for (const l of lamps) {
    const a = first ? l.a : DOCK_A + l.off, p = lakePoint(a, PATH_T + 0.085), y = height(p.x, p.z);
    l.post.position.set(p.x, y, p.z); l.post.rotation.y = a;
    l.lamp.position.copy(l.post.position); l.lamp.rotation.y = a;
    l.glow.position.set(p.x, y + 2.44, p.z);
    l.spot.set(p.x, y + 2.44, p.z);
    l.block.x = p.x; l.block.z = p.z;
  }
}
