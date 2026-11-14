// The girl: a friend who lives in the meadow. She strolls from place to place round the lake, stops
// to look about (hands in her hoodie pocket after a while), and when you come near she turns to
// you, smiles and waves. She keeps out of the water and steps aside if you walk into her. Far away
// she isn't posed or drawn. Her wandering draws from its own random stream.
import { scene } from '../core/render.js';
import { TAU, damp, lerp, turnTo, mulberry32 } from '../core/math.js';
import { SPAWN, lakePoint, groundAt, animalWalkable } from '../core/shape.js';
import { hooks, pushOut } from '../core/state.js';
import { windU } from '../core/materials.js';
import { makeKid, KIDS } from '../characters/kid.js';
import { poseKid, STRIDE_RATE } from '../characters/kidpose.js';
import { player } from '../characters/player.js';

const WALK = 1.7, GREET = 4.2, SHOW = 95, POSE = 60;

export let friend = null;
/** For tests: where she is and what she is doing. */
export const friendView = () => friend && { x: friend.st.x, z: friend.st.z, state: friend.st.state, wave: friend.st.wave };

export function initFriend() {
  const r = mulberry32(90417), k = makeKid(KIDS.girl);
  scene.add(k.root);
  // she starts a little way along the shore from where you do
  let home = lakePoint(Math.PI / 2 + 0.55, 1.28);
  if (!animalWalkable(home.x, home.z)) home = { x: SPAWN.x + 6, z: SPAWN.z + 3 };
  const st = { x: home.x, z: home.z, y: groundAt(home.x, home.z), rot: r() * TAU, move: 0, phase: 0, sitAmt: 0, petAmt: 0, idleT: 0, turn: 0, t: 0,
    state: 'idle', timer: 2 + r() * 3, target: null, wave: 0, greeted: 0 };
  friend = { k, st };

  /** Somewhere to stroll to: a spot round the lake shore or out in the meadow, reachable in a straight line. */
  const pickTarget = () => {
    for (let i = 0; i < 20; i++) {
      const p = r() < 0.6 ? lakePoint(r() * TAU, 1.15 + r() * 0.5) : { x: st.x + (r() - 0.5) * 40, z: st.z + (r() - 0.5) * 40 };
      const d = Math.hypot(p.x - st.x, p.z - st.z);
      if (d < 6 || d > 45) continue;
      let ok = true;
      for (let s = 1; s <= 10 && ok; s++) ok = animalWalkable(lerp(st.x, p.x, s / 10), lerp(st.z, p.z, s / 10));
      if (ok) return p;
    }
    return null;
  };

  hooks.frame.push((dt, t, camera) => {
    const camD = Math.hypot(camera.position.x - st.x, camera.position.z - st.z);
    k.root.visible = camD < SHOW;
    const dxp = player.x - st.x, dzp = player.z - st.z, dp = Math.hypot(dxp, dzp);
    let want = 0;
    const prevRot = st.rot;

    if (dp < GREET && player.sitAmt < 0.5) {
      // you're close: she stops, turns to you and waves (once each time you come up to her)
      if (st.state !== 'greet') { st.state = 'greet'; st.greeted = 0; }
      st.rot = turnTo(st.rot, Math.atan2(dxp, dzp), dt * 5);
      st.greeted += dt;
    } else {
      if (st.state === 'greet') { st.state = 'idle'; st.timer = 2 + r() * 3; }
      if (st.state === 'idle') {
        st.timer -= dt;
        if (st.timer <= 0) { st.target = pickTarget(); if (st.target) st.state = 'walk'; else st.timer = 3; }
      } else if (st.state === 'walk') {
        const dx = st.target.x - st.x, dz = st.target.z - st.z, d = Math.hypot(dx, dz);
        if (d < 0.6) { st.state = 'idle'; st.timer = 5 + r() * 12; }
        else {
          st.rot = turnTo(st.rot, Math.atan2(dx, dz), dt * 4);
          want = WALK;
          const nx = st.x + Math.sin(st.rot) * WALK * dt, nz = st.z + Math.cos(st.rot) * WALK * dt;
          if (animalWalkable(nx, nz)) { st.x = nx; st.z = nz; } else { st.state = 'idle'; st.timer = 1; } // blocked: think again
        }
      }
    }
    // she steps out of your way, and round trees and rocks
    if (dp < 0.7 && dp > 0.01) { st.x -= (dxp / dp) * (0.7 - dp); st.z -= (dzp / dp) * (0.7 - dp); }
    const p = { x: st.x, z: st.z }; pushOut(p, 0.3);
    if (animalWalkable(p.x, p.z)) { st.x = p.x; st.z = p.z; }
    st.move = damp(st.move, want, 6, dt);
    st.y = damp(st.y, groundAt(st.x, st.z), 12, dt);
    k.root.position.set(st.x, st.y, st.z);
    k.root.rotation.y = st.rot;
    if (camD > POSE) return; // too far to see her move

    st.phase += dt * st.move * STRIDE_RATE;
    let dr = st.rot - prevRot; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    st.turn = damp(st.turn, dt > 0 ? dr / dt : 0, 8, dt);
    st.idleT = st.move < 0.15 && st.state !== 'greet' ? st.idleT + dt : 0;
    st.t = t + 11.3; // (out of step with the player's own idle sway)
    poseKid(k, st, dt);
    // the wave: arm up, forearm swinging from the elbow, for the first few seconds of a greeting
    st.wave = damp(st.wave, st.state === 'greet' && st.greeted < 3.2 ? 1 : 0, 6, dt);
    if (st.wave > 0.01) {
      const w = st.wave;
      k.arms[1].rotation.x = lerp(k.arms[1].rotation.x, -0.2, w); k.arms[1].rotation.z = lerp(k.arms[1].rotation.z, 2.35, w);
      k.elbows[1].rotation.set(lerp(k.elbows[1].rotation.x, 0, w), 0, w * (0.55 + Math.sin(t * 9) * 0.45));
      k.head.rotation.z = lerp(k.head.rotation.z, 0.12, w);
    } else k.elbows[1].rotation.z = 0;
    if (st.state === 'greet') { k.head.rotation.y = lerp(k.head.rotation.y, 0, 0.8); k.face.set(st.greeted < 4 ? 'happy' : 'calm'); } else k.face.set('calm');
    k.root.updateMatrixWorld(true);
    k.face.update(dt, t);
    k.sway(dt, t, Math.min(1.5, windU.value));
  });
}
