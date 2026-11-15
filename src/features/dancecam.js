// The cinematic camera for the skating dance: a shot list timed to the routine, cutting between shots
// at the changes of part and moving smoothly within each. Black bars close in top and bottom and the
// buttons fade away; a small hint says how to stop (K or moving; on a touch screen, a tap). Photo mode
// still works mid-dance (its own camera wins while it is open). With reduced motion the shots hold
// still instead of orbiting.
//
//   0-5     wide establishing shot, high, the snowman behind them, pushing slowly in
//   5-12    tracking alongside as they skate
//   12-14.5 full-length two-shot, both in profile
//   14.5-19.5 from high above as she spins, turning with her
//   19.5-24 slow orbit, medium
//   24-28   close on both faces
//   28-32   low, side on: the dip
//   32-36   close on both faces in the dip, side on
//   36-44   tracking ahead of them, looking back
//   44-47.5 slow orbit, full length
//   47.5-51.5 from high above for the second twirl
//   51.5-56 medium on the embrace, turning with them
//   56-     craning up and out, circling round to a last wide shot with the snowman behind them
import * as THREE from 'three';
import { camera } from '../core/render.js';
import { clamp, lerp } from '../core/math.js';
import { reduceMotion, coarsePointer } from '../core/env.js';
import { groundAt } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { hero } from '../characters/player.js';
import { snowSpots } from '../characters/skatedance.js';
import { camState } from '../systems/input.js';
import { treeSpots } from '../world/vegetation.js';
import { friend } from './friend.js';
import { danceNow, snowmanSpotNow, stopDance } from './icedance.js';

const BASE_FOV = camera.fov;
const ease = (u) => u * u * (3 - 2 * u);
const V = () => new THREE.Vector3();
const c = V(), look = V(), pos = V(), hb = V(), hg = V(), L = V(), P = V(), T = V(), Rt = V(), away = V(), F = V();
const UP = new THREE.Vector3(0, 1, 0);
/** A point `d` metres from the centre in direction angle `a` (radians, as rot: 0 = +z), `h` up. */
const around = (out, a, d, h) => out.set(c.x + Math.sin(a) * d, c.y + h, c.z + Math.cos(a) * d);
const angleOf = (v) => Math.atan2(v.x, v.z);
const spinDir = reduceMotion ? 0 : 1;

// Each shot: [start, end, (u, ctx) => fov], setting `pos` and `look`; u runs 0..1 through the shot.
const SHOTS = [
  [0, 5, (u) => { const e = ease(u); around(pos, angleOf(away) + lerp(-0.3, 0.05, e) * spinDir, lerp(12, 7.5, e), lerp(5, 2.6, e)); look.copy(c).y += 0.7; return 50; }],
  [5, 12, (u) => { pos.copy(c).addScaledVector(T, lerp(3.0, 1.0, u)).addScaledVector(Rt, -lerp(3.0, 4.0, u)).y += 1.25; look.copy(c).addScaledVector(T, 0.3).y += 0.75; return 45; }],
  [12, 14.5, (u) => { around(pos, angleOf(P) + 0.15 * u * spinDir, 3.8, 1.3); look.copy(c).y += 0.75; return 45; }],
  [14.5, 19.5, (u) => { around(pos, angleOf(P) - u * Math.PI * 0.8 * spinDir, 3.4, 2.9); look.copy(c).y += 0.6; return 42; }],
  [19.5, 24, (u) => { around(pos, angleOf(P) + u * 0.9 * spinDir, 3.0, 1.45); look.copy(c).y += 0.85; return 42; }],
  [24, 28, (u) => { look.addVectors(hb, hg).multiplyScalar(0.5); pos.copy(look).addScaledVector(P, lerp(2.1, 1.8, u)); return 32; }],
  [28, 32, (u) => { around(pos, angleOf(P) + lerp(-0.1, 0.1, u) * spinDir, 3.4, 0.45); look.copy(c).y += 0.75; return 45; }],
  [32, 36, (u) => { look.lerpVectors(hb, hg, 0.6); pos.copy(look).addScaledVector(P, lerp(2.2, 1.95, u)).addScaledVector(L, -0.3).y += 0.1; return 34; }],
  [36, 44, (u) => { pos.copy(c).addScaledVector(T, lerp(3.6, 3.0, u)).addScaledVector(Rt, 0.6).y += 1.3; look.copy(c).y += 0.8; return 45; }],
  [44, 47.5, (u) => { around(pos, angleOf(P) + u * 1.2 * spinDir, 3.6, 1.5); look.copy(c).y += 0.8; return 45; }],
  [47.5, 51.5, (u) => { around(pos, angleOf(P) - u * Math.PI * 1.2 * spinDir, 3.4, 2.9); look.copy(c).y += 0.6; return 42; }],
  [51.5, 56, () => { pos.copy(c).addScaledVector(F, 2.4).y += 1.3; look.copy(c).y += 0.95; return 40; }],
  [56, Infinity, (u) => { const e = ease(clamp(u, 0, 1)), a0 = angleOf(F), a1 = angleOf(away), a = a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * e; around(pos, a, lerp(2.4, 12, e), lerp(1.3, 5.5, e)); look.copy(c).y += lerp(0.95, 0.7, e); return lerp(40, 50, e); }],
];
// (the last shot's u is measured over 4 s and then held)
const shotAt = (t) => SHOTS.find(([a, b]) => t >= a && t < b) || SHOTS[SHOTS.length - 1];

/** Keep the camera out of the ground and out of tree crowns: slide it in toward what it looks at until clear. */
function clear(p, at) {
  for (let i = 0; i < 24; i++) {
    const g = groundAt(p.x, p.z) + 0.35;
    const inTree = treeSpots.some((tr) => { const r = 1.6 * tr.s; return (p.x - tr.x) ** 2 + (p.z - tr.z) ** 2 < r * r && p.y < tr.y + (tr.top || 5.2 * tr.s) && p.y > tr.y + 0.8 * tr.s; });
    if (p.y >= g && !inTree) return;
    if (p.y < g && !inTree) { p.y = g; return; }
    p.lerp(at, 0.12);
  }
}

export function initDanceCam() {
  // the black bars and the hint
  const top = document.createElement('div'), bottom = document.createElement('div'), hint = document.createElement('div');
  top.className = 'letterbox top'; bottom.className = 'letterbox bottom'; hint.className = 'letterbox-hint';
  hint.textContent = coarsePointer ? 'Tap to stop dancing' : 'K or move to stop dancing';
  bottom.appendChild(hint);
  document.body.append(top, bottom);
  let on = false, fovSet = false;
  const show = (v) => { on = v; document.body.classList.toggle('cinematic', v); };
  // on a touch screen a tap stops it (on a computer a click is for the mouse, so K or moving does)
  window.addEventListener('pointerdown', () => { if (on && coarsePointer) stopDance(); }, { passive: true });

  hooks.camera.push((dt, camTarget) => {
    const D = danceNow();
    if (!D || !friend) {
      if (on) {
        show(false);
        // hand back to the follow camera from where this one is, so it glides rather than jumps
        camState.yaw = Math.atan2(camera.position.x - hero.root.position.x, camera.position.z - hero.root.position.z);
      }
      if (fovSet) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); fovSet = false; }
      return false;
    }
    if (!on) show(true);
    const k = friend.k, t = D.t;
    // where they are: the middle between them, the line from him to her, the way they are going and facing
    c.addVectors(hero.root.position, k.root.position).multiplyScalar(0.5);
    L.subVectors(k.root.position, hero.root.position).setY(0);
    if (L.lengthSq() < 1e-6) L.set(1, 0, 0);
    L.normalize(); P.set(L.z, 0, -L.x);
    const H = snowSpots(D.frame, Math.min(t, 60)).H;
    T.set(Math.sin(H), 0, Math.cos(H)); Rt.set(-Math.cos(H), 0, Math.sin(H));
    const rb = hero.root.rotation.y, rg = k.root.rotation.y;
    F.set(Math.sin(rb) + Math.sin(rg), 0, Math.cos(rb) + Math.cos(rg)).normalize(); // the way they both face (an average of directions, not of angles)
    if (Math.cos(rb - rg) < 0) F.copy(P); // (facing each other: "their front" is side on)
    const sm = snowmanSpotNow();
    if (sm) away.set(c.x - sm.x, 0, c.z - sm.z); else away.copy(T).negate();
    away.normalize();
    hero.head.localToWorld(hb.set(0, 0.3, 0)); k.head.localToWorld(hg.set(0, 0.3, 0));
    // the shot for this moment
    const [a, b, fn] = shotAt(t);
    const u = clamp((t - a) / ((b === Infinity ? a + 4 : b) - a), 0, 1);
    const fov = fn(u);
    clear(pos, look);
    camera.position.copy(pos);
    camera.up.copy(UP);
    camera.lookAt(look);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); fovSet = true; }
    camTarget.copy(c).y += 1.3;   // (lighting and detail follow the dancers)
    return true;
  });
}
