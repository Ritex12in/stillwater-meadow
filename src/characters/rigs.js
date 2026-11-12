// Low-poly rigs built from boxes: people, dogs and cats. Pivots are groups so limbs can rotate.
import * as THREE from 'three';
import { TAU } from '../core/math.js';
import { std, enableShadows } from '../core/materials.js';

export function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
export function box(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }

export function makePerson(c = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = std(c.skin || '#e7b894'), knit = std(c.knit || '#e2b04a'), pants = std(c.pants || '#3c4a5e'), shoe = std(c.shoe || '#2c2a28'), hair = std(c.hair || '#4a3426'), scarf = std(c.scarf || '#3f7f7a');
  const legs = [], knees = [];
  [-0.13, 0.13].forEach((x) => {
    const hip = pivot(body, x, 0.86, 0);
    box(hip, 0.17, 0.42, 0.19, pants, 0, -0.21, 0);
    const knee = pivot(hip, 0, -0.42, 0);
    box(knee, 0.16, 0.38, 0.18, pants, 0, -0.19, 0);
    box(knee, 0.19, 0.1, 0.3, shoe, 0, -0.39, 0.05);
    legs.push(hip); knees.push(knee);
  });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 8), knit);
  torso.position.y = 1.2; body.add(torso);
  const arms = [-0.34, 0.34].map((x) => {
    const p = pivot(body, x, 1.5, 0);
    box(p, 0.13, 0.62, 0.15, knit, 0, -0.31, 0);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), skin);
    hand.position.y = -0.66; p.add(hand);
    return p;
  });
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 6, 12), scarf);
  sc.rotation.x = Math.PI / 2; sc.position.y = 1.57; body.add(sc);
  const head = pivot(body, 0, 1.8, 0);
  head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), skin));
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 8, 0, TAU, 0, Math.PI * 0.55), hair);
  h.position.set(0, 0.02, -0.02); h.rotation.x = -0.2; head.add(h);
  const eyeMat = std('#2a2220');
  box(head, 0.035, 0.05, 0.02, eyeMat, -0.075, 0.0, 0.2);
  box(head, 0.035, 0.05, 0.02, eyeMat, 0.075, 0.0, 0.2);
  enableShadows(root);
  return { root, body, legs, knees, arms, head };
}

export function makeDog(c) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // heading first, then the slope tilt
  const rig = new THREE.Group(); root.add(rig);
  const coat = std(c.coat), accent = std(c.accent), ear = std(c.ear), dark = std('#1d1b1a');
  box(rig, 0.4, 0.36, 0.9, coat, 0, 0.62, 0);
  box(rig, 0.3, 0.26, 0.2, accent, 0, 0.56, 0.38);
  const head = pivot(rig, 0, 0.9, 0.5);
  box(head, 0.34, 0.32, 0.36, coat, 0, 0, 0);
  box(head, 0.2, 0.16, 0.22, accent, 0, -0.06, 0.26);
  box(head, 0.08, 0.06, 0.04, dark, 0, -0.01, 0.38);
  const eyes = [box(head, 0.04, 0.04, 0.02, dark, -0.09, 0.06, 0.18), box(head, 0.04, 0.04, 0.02, dark, 0.09, 0.06, 0.18)];
  [-1, 1].forEach((s) => { const e = box(head, 0.08, 0.22, 0.15, ear, s * 0.18, 0.02, -0.03); e.rotation.z = s * 0.28; });
  const legs = [[-0.13, 0.3], [0.13, 0.3], [-0.13, -0.3], [0.13, -0.3]].map(([x, z]) => {
    const p = pivot(rig, x, 0.46, z);
    box(p, 0.12, 0.46, 0.12, coat, 0, -0.23, 0);
    return p;
  });
  const tail = pivot(rig, 0, 0.74, -0.44);
  box(tail, 0.07, 0.07, 0.4, coat, 0, 0, -0.2);
  tail.rotation.x = -0.6;
  enableShadows(root);
  return { root, rig, head, legs, tail, eyes, sitDrop: 0.12, scale: c.scale || 1, length: 0.9 };
}

export function makeCat(c) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const rig = new THREE.Group(); root.add(rig);
  const fur = std(c.fur), belly = std(c.belly), nose = std('#e79aa6'), eye = std(c.eye || '#a6c43b');
  box(rig, 0.26, 0.25, 0.6, fur, 0, 0.37, 0);
  box(rig, 0.2, 0.06, 0.4, belly, 0, 0.25, 0.02);
  const head = pivot(rig, 0, 0.55, 0.35);
  box(head, 0.26, 0.21, 0.23, fur, 0, 0, 0);
  box(head, 0.12, 0.08, 0.06, belly, 0, -0.05, 0.12);
  box(head, 0.035, 0.025, 0.02, nose, 0, -0.02, 0.155);
  const eyes = [box(head, 0.045, 0.04, 0.02, eye, -0.065, 0.03, 0.12), box(head, 0.045, 0.04, 0.02, eye, 0.065, 0.03, 0.12)];
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), fur);
    e.position.set(s * 0.085, 0.15, -0.01); e.rotation.y = Math.PI / 4; head.add(e);
  });
  const legs = [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]].map(([x, z]) => {
    const p = pivot(rig, x, 0.28, z);
    box(p, 0.075, 0.28, 0.075, fur, 0, -0.14, 0);
    return p;
  });
  const tail = pivot(rig, 0, 0.44, -0.29);
  box(tail, 0.055, 0.055, 0.46, fur, 0, 0, -0.22);
  tail.rotation.x = -0.95;
  enableShadows(root);
  return { root, rig, head, legs, tail, eyes, sitDrop: 0.08, scale: 1, length: 0.6 };
}
