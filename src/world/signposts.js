// Signposts where a trail leaves a place: a post with a board pointing along the trail, naming the
// place at its other end and how far it is. A few, reused for the trail ends near you.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { trailEndsNear, heightAt } from '../core/shape.js';
import { hooks, obstacles } from '../core/state.js';
import { std } from '../core/materials.js';
import { placeName } from './landmarks.js';

const POOL = 10;
const nameOf = (p) => p.name || placeName({ kind: p.kind, variant: p.variant || 0 });
function makeSign() {
  const g = new THREE.Group(), wood = std('#7a5236');
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2, 6).translate(0, 1, 0), wood));
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const tex = new THREE.CanvasTexture(c);
  const face = new THREE.MeshStandardMaterial({ map: tex });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.05), [wood, wood, wood, wood, face, face]);
  board.position.set(0.6, 1.65, 0);
  g.add(board);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, c, tex, board, end: null, block: { x: 4e5, z: 4e5, r: 0.25 } };
}
function write(sign, e) {
  const x = sign.c.getContext('2d');
  x.fillStyle = '#c9a26b'; x.fillRect(0, 0, 512, 96);
  x.fillStyle = '#3b2a1c'; x.font = 'bold 40px Georgia, serif'; x.textBaseline = 'middle';
  const far = e.far < 1000 ? `${Math.round(e.far / 10) * 10} m` : `${(e.far / 1000).toFixed(1)} km`;
  x.fillText(`${nameOf(e.to)} · ${far}`.slice(0, 26), 18, 50);
  x.beginPath(); x.moveTo(470, 22); x.lineTo(500, 48); x.lineTo(470, 74); x.fill();
  sign.tex.needsUpdate = true;
}
let signs = [];
/** For tests: how many signposts stand (each blocks the way a little). */
export const signBlocks = () => signs.filter((s) => s.end).length;
export function initSignposts() {
  signs = Array.from({ length: POOL }, () => { const s = makeSign(); s.g.visible = false; s.g.userData.pooledLandmark = true; scene.add(s.g); return s; });
  let lookIn = 0;
  hooks.frame.push((dt, t, camera) => {
    lookIn -= dt;
    if (lookIn > 0) return;
    lookIn = 1.5;
    const ends = trailEndsNear(camera.position.x, camera.position.z, 260).slice(0, POOL), ids = new Set(ends.map((e) => e.id));
    for (const s of signs) if (s.end && !ids.has(s.end.id)) { s.end = null; s.g.visible = false; const i = obstacles.indexOf(s.block); if (i >= 0) obstacles.splice(i, 1); }
    for (const e of ends) {
      if (signs.some((s) => s.end && s.end.id === e.id)) continue;
      const s = signs.find((q) => !q.end);
      if (!s) break;
      s.end = e;
      s.g.position.set(e.x, heightAt(e.x, e.z) - 0.05, e.z);
      s.g.rotation.y = e.toward - Math.PI / 2;
      s.g.visible = true;
      s.block.x = e.x; s.block.z = e.z;
      if (!obstacles.includes(s.block)) obstacles.push(s.block);
      write(s, e);
    }
  });
}
/** For tests: the trail ends signposted near a spot. */
export const signsNear = (x, z) => trailEndsNear(x, z, 260).map((e) => ({ to: nameOf(e.to), far: e.far }));
