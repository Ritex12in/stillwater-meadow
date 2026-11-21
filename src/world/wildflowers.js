// A wildflower meadow round the places you walk and sit: clumps of daisies and lupins (built
// here), the kit's flower clumps, wispy grass and broad-leaved plants, and pebbles on the shore.
// Decoration only (you pick the meadow's other flowers). Its own random stream: nothing else moves.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, mulberry32 } from '../core/math.js';

import { col, weatherize, addWind, bothSides, slotSet, softEdges, neonAtNight } from '../core/materials.js';
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

/**
 * Make the wildflowers' shapes and the slots they are drawn from: clumps of daisies, lupins and
 * red tulips. world/wilds.js decides where drifts of them grow and refills these for the squares
 * closest to you. They are `world.wild`, which winter and the wildflower setting hide.
 */
export function buildWildflowers() {
  const piece = (name, h, re) => { const p = fit(Object.fromEntries(Object.entries(kit.models[name]).map(([k, g]) => [k, g.clone()])), h); return Object.entries(p).filter(([k]) => re.test(k)).map(([, g]) => g); };
  const mat = (k, map) => bothSides(weatherize(addWind(new THREE.MeshLambertMaterial(map ? { map, alphaTest: 0.5, vertexColors: true } : { vertexColors: true }), k, FADE), 'lam'));
  const lupins = lupinClump(), sub = (k) => (it) => (it.kind === k ? 0 : -1);
  // (the lupin florets have a material of their own: three r128 doesn't recompile a shared one for meshes with per-instance colour)
  const wild = [
    slotSet([daisyClump()], neonAtNight(mat(0.25), 0.7), 420),
    slotSet([lupins.florets], neonAtNight(mat(0.15)), 260, { colored: true }),
    slotSet([lupins.greens], mat(0.15), 260),
    slotSet([piece('Flower_3_Group', 0.5, /Leaves/)[0]], softEdges(mat(0.4, kit.tex.leaves)), 440),
    slotSet([piece('Flower_3_Group', 0.5, /Flowers/)[0]], softEdges(neonAtNight(bothSides(addWind(new THREE.MeshLambertMaterial({ map: kit.tex.flowers, alphaTest: 0.5, vertexColors: true }), 0.4, FADE)))), 440), // (a blossom grove is carpeted with them)
  ];
  world.wild = wild;
  world.setWildFlowers = (list) => {
    wild[0].setItems(list, sub(0));
    wild[1].setItems(list, sub(1)); wild[2].setItems(list, sub(1));
    wild[3].setItems(list, sub(2)); wild[4].setItems(list, sub(2));
    return wild.reduce((a, w) => a + w.dropped, 0);
  };
  /** Lupin colours, for whoever plants them. */
  world.lupinColours = ['#7b5bd6', '#9a6ee0', '#6a63d8', '#c46fd0', '#e58fc9', '#f2f0ff'].map(col);
}
