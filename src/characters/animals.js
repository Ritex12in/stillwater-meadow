// Cats and dogs: wandering, following you, sheltering from rain, goals set by features
// (campfire circle, fishing buddy), personal space, and body language.
import { scene } from '../core/render.js';
import { TAU, rng, rand, rnd, clamp, damp, angDiff, turnTo } from '../core/math.js';
import { lakePoint, heightAt, groundAt, animalWalkable } from '../core/shape.js';
import { pushOut } from '../core/state.js';
import { makeDog, makeCat } from './rigs.js';
import { player } from './player.js';
import { treeSpots } from '../world/vegetation.js';
import { wx } from '../systems/weather.js';

export const animals = [];

function spotNear(cx, cz, r, random = rnd) {
  for (let i = 0; i < 40; i++) {
    const a = random() * TAU, d = Math.sqrt(random()) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (animalWalkable(x, z)) return { x, z };
  }
  return { x: cx, z: cz };
}

function addAnimal(kind, rig, near, range) {
  const p = spotNear(near.x, near.z, 6, rng);
  rig.root.scale.setScalar(rig.scale);
  rig.root.position.set(p.x, heightAt(p.x, p.z), p.z);
  scene.add(rig.root);
  animals.push(Object.assign(rig, {
    kind, home: { x: p.x, z: p.z }, range, x: p.x, z: p.z,
    state: 'idle', timer: rand(1, 5), sitting: rng() < 0.5, target: { x: p.x, z: p.z }, hasTarget: false,
    heading: rng() * TAU, speed: 0, phase: rng() * TAU, sit: 0, wag: 0.3, look: 0, side: rng() * TAU,
    bond: 0, petted: false, petAmt: 0, purr: null, shake: 0, shakeDelay: 0, goal: null, name: '',
    radius: kind === 'dog' ? 0.42 * (rig.scale || 1) : 0.28, nudgeT: 0, tilt: 0,
  }));
}

export function buildAnimals() {
  const homeA = lakePoint(Math.PI / 2 + 0.12, 1.2);
  const homeB = lakePoint(Math.PI / 2 - 0.18, 1.22);
  const homeC = lakePoint(Math.PI, 1.6);
  addAnimal('dog', makeDog({ coat: '#d9a65a', accent: '#f2dcb0', ear: '#b9853f' }), homeA, 22);
  addAnimal('dog', makeDog({ coat: '#3a3330', accent: '#e9e2d6', ear: '#2a2523', scale: 0.85 }), homeB, 20);
  addAnimal('dog', makeDog({ coat: '#f1ece2', accent: '#ffffff', ear: '#8a5a3a', scale: 0.72 }), homeC, 18);
  addAnimal('cat', makeCat({ fur: '#e0954a', belly: '#f6dcb8' }), homeA, 12);
  addAnimal('cat', makeCat({ fur: '#7f8288', belly: '#c9cbd0', eye: '#d9c14a' }), homeB, 12);
  addAnimal('cat', makeCat({ fur: '#2a2726', belly: '#3a3634', eye: '#d6c23a' }), lakePoint(Math.PI / 2 - 0.5, 1.5), 9);
  addAnimal('cat', makeCat({ fur: '#f3efe7', belly: '#ffffff', eye: '#7fb6d9' }), homeC, 12);
}

const setTarget = (a, x, z) => { a.target.x = x; a.target.z = z; a.hasTarget = true; };

function pickTarget(a) {
  const dp = Math.hypot(player.x - a.x, player.z - a.z);
  if (a.kind === 'cat' && a.bond > 0.2 && dp < 30 && rnd() < a.bond * 0.7) {
    for (let i = 0; i < 12; i++) {
      const ang = rnd() * TAU, x = player.x + Math.cos(ang) * 1.2, z = player.z + Math.sin(ang) * 1.2;
      if (animalWalkable(x, z)) { setTarget(a, x, z); a.state = 'walk'; return; }
    }
  }
  const p = spotNear(a.home.x, a.home.z, a.range);
  setTarget(a, p.x, p.z);
  a.state = 'walk';
}

function shelterSpot(a) {
  let best = null, bd = 45;
  for (const tr of treeSpots) {
    const d = Math.hypot(tr.x - a.x, tr.z - a.z);
    if (d < bd) { bd = d; best = tr; }
  }
  if (!best) return { x: a.x, z: a.z };
  const base = Math.atan2(a.z - best.z, a.x - best.x), r = 0.32 * best.s + 0.45;
  for (let i = 0; i < 8; i++) {
    const ang = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.6;
    const x = best.x + Math.cos(ang) * r, z = best.z + Math.sin(ang) * r;
    if (animalWalkable(x, z)) return { x, z };
  }
  return { x: a.x, z: a.z };
}

export function updateAnimal(a, dt, t) {
  const dxp = player.x - a.x, dzp = player.z - a.z;
  const dp = Math.hypot(dxp, dzp);
  let want = 0, wantSit = 0;
  a.petAmt = damp(a.petAmt, a.petted ? 1 : 0, 4, dt);
  if (a.nudgeT > 0) a.nudgeT -= dt;

  if (a.petted) {
    a.heading = turnTo(a.heading, Math.atan2(dxp, dzp), dt * 3);
    wantSit = 1;
  } else if (a.goal) {
    const g = a.goal, d = Math.hypot(g.x - a.x, g.z - a.z);
    a.state = 'goal';
    setTarget(a, g.x, g.z);
    if (d > 0.4) want = d > 6 ? (a.kind === 'dog' ? 3.2 : 2.0) : (a.kind === 'dog' ? 1.6 : 1.0);
    else {
      wantSit = g.sit === false ? 0 : 1;
      if (g.faceX !== undefined) a.heading = turnTo(a.heading, Math.atan2(g.faceX - a.x, g.faceZ - a.z), dt * 3);
    }
  } else if (a.kind === 'cat' && (wx.rain > 0.35 || wx.storm > 0.3)) {
    // cats hurry under the nearest tree and curl up until the rain passes
    if (a.state !== 'shelter') { const s = shelterSpot(a); setTarget(a, s.x, s.z); a.state = 'shelter'; }
    const d = Math.hypot(a.target.x - a.x, a.target.z - a.z);
    if (d > 0.45) want = d > 3 ? 2.2 : 1.1;
    else wantSit = 1;
  } else {
    if (a.state === 'shelter' || a.state === 'goal' || a.state === 'petted') { a.state = 'idle'; a.timer = rnd(2, 6); a.sitting = false; a.home = { x: a.x, z: a.z }; }
    if (a.kind === 'dog') {
      if (a.state !== 'follow' && dp < 8 + a.bond * 10 && rnd() < dt * (0.35 + a.bond * 1.5)) { a.state = 'follow'; a.timer = rnd(18, 40) * (1 + a.bond * 2); }
      if (a.state === 'follow') {
        a.timer -= dt;
        if (dp > 26 + a.bond * 20 || a.timer <= 0) { a.state = 'idle'; a.timer = rnd(2, 5); a.home = { x: a.x, z: a.z }; }
        else {
          if (player.move > 0.1) a.side += dt * 0.05; // spot beside you only drifts while you walk
          for (const o of animals) { // followers fan out: each dog makes room for the ones before it
            if (o === a) break;
            if (o.state !== 'follow') continue;
            const df = angDiff(o.side, a.side);
            if (Math.abs(df) < 1.2) a.side += (df >= 0 ? 1 : -1) * dt * 1.5;
          }
          const tx = player.x + Math.cos(a.side) * 2.3, tz = player.z + Math.sin(a.side) * 2.3;
          setTarget(a, tx, tz);
          const d = Math.hypot(tx - a.x, tz - a.z);
          const settle = a.sit > 0.5 ? 1.8 : 0.7; // a seated dog stays put until you actually move off
          if (d > settle) want = d > 5 ? 4.4 : Math.min(2.4, d * 1.1);
          else wantSit = player.move < 0.1 ? 1 : 0;
        }
      }
    } else if (dp < 2.8 && a.state !== 'rest' && !(a.nudgeT > 0)) {
      a.state = 'rest'; a.timer = rnd(5, 10) * (1 + a.bond * 2);
    }
    if (a.state === 'walk') {
      const d = Math.hypot(a.target.x - a.x, a.target.z - a.z);
      if (d < 0.5) { a.state = 'idle'; a.timer = rnd(3, 10); a.sitting = rnd() < 0.65; }
      else want = a.kind === 'dog' ? 1.5 : 0.75;
    }
    if (a.state === 'idle' || a.state === 'rest') {
      a.timer -= dt;
      if (a.sitting || a.state === 'rest') wantSit = 1;
      if (a.timer <= 0) pickTarget(a);
    }
  }

  // Pose gates movement: sit only once stopped, and stand fully before walking or turning.
  const sitTarget = want > 0 || a.speed > 0.15 ? 0 : wantSit;
  a.sit = damp(a.sit, sitTarget, sitTarget > a.sit ? 3.5 : 7, dt);
  if (a.sit < 0.02) a.sit = sitTarget > 0 ? a.sit : 0;
  const canMove = a.sit < 0.12;
  if (want > 0 && a.hasTarget && canMove) {
    const ang = Math.atan2(a.target.x - a.x, a.target.z - a.z);
    a.heading = turnTo(a.heading, ang, dt * 4);
    want *= Math.max(0, 1 - Math.abs(angDiff(a.heading, ang)) / 1.3);
  }
  a.speed = damp(a.speed, canMove ? want : 0, 5, dt);
  if (a.speed < 0.01 && !canMove) a.speed = 0;
  const step = a.speed * clamp(1 - a.sit * 10, 0, 1) * dt; // no travel once the sit has begun
  const nx = a.x + Math.sin(a.heading) * step, nz = a.z + Math.cos(a.heading) * step;
  if (animalWalkable(nx, nz)) { a.x = nx; a.z = nz; }
  else if (a.state === 'walk') pickTarget(a);
  const p = { x: a.x, z: a.z };
  pushOut(p, 0.25);
  a.x = p.x; a.z = p.z;

  // body follows the slope: compare the ground under the front and back paws
  const half = a.length * 0.5 * a.scale, sh = Math.sin(a.heading), ch = Math.cos(a.heading);
  const slope = Math.atan2(groundAt(a.x + sh * half, a.z + ch * half) - groundAt(a.x - sh * half, a.z - ch * half), half * 2);
  a.tilt = damp(a.tilt, clamp(slope, -0.45, 0.45) * (1 - a.sit * 0.6), 8, dt);
  a.root.position.set(a.x, damp(a.root.position.y, groundAt(a.x, a.z), 10, dt), a.z);
  a.root.rotation.set(-a.tilt, a.heading, 0);

  a.phase += dt * a.speed * (a.kind === 'dog' ? 5.2 : 8);
  const amp = Math.min(1, a.speed / 1.2) * 0.7;
  const sw = Math.sin(a.phase) * amp;
  a.legs[0].rotation.x = sw + a.sit * 0.45;
  a.legs[1].rotation.x = -sw + a.sit * 0.45;
  a.legs[2].rotation.x = -sw - a.sit * 1.25;
  a.legs[3].rotation.x = sw - a.sit * 1.25;
  a.rig.rotation.x = -0.45 * a.sit;
  a.rig.position.y = -a.sitDrop * a.sit + Math.abs(Math.sin(a.phase)) * 0.025 * amp;

  if (a.kind === 'dog') {
    a.wag = damp(a.wag, a.petted ? 1.7 : a.state === 'follow' || dp < 5 ? 1 : 0.25, 3, dt);
    a.tail.rotation.y = Math.sin(t * (13 + a.petAmt * 5)) * 0.6 * a.wag;
  } else {
    a.tail.rotation.y = Math.sin(t * (1.3 - a.petAmt * 0.6) + a.side) * (0.35 + a.petAmt * 0.25);
  }
  const lookTarget = dp < 6 ? clamp(angDiff(a.heading, Math.atan2(dxp, dzp)), -0.9, 0.9) : Math.sin(t * 0.4 + a.side) * 0.3;
  a.look = damp(a.look, lookTarget, 3, dt);
  a.head.rotation.y = a.look;
  a.head.rotation.x = a.sit * 0.25 - a.petAmt * (a.kind === 'dog' ? 0.6 : 0.45); // looks up at you
  a.head.rotation.z = Math.sin(t * 1.7 + a.side) * 0.18 * a.petAmt;             // happy head tilt
  const squint = 1 - a.petAmt * (a.kind === 'cat' ? 0.85 : 0.55);                // content, half-closed eyes
  a.eyes[0].scale.y = squint; a.eyes[1].scale.y = squint;
  a.rig.rotation.z = 0;
  if (a.shake > 0) { // dogs shake the water off once the rain stops
    if (a.shakeDelay > 0) a.shakeDelay -= dt;
    else {
      a.shake -= dt;
      const e = Math.sin(Math.PI * clamp(a.shake / 1.1, 0, 1));
      a.rig.rotation.z = Math.sin(t * 42) * 0.3 * e;
      a.head.rotation.z += Math.sin(t * 42 + 1.2) * 0.35 * e;
    }
  }
}

// Keep animals from walking into each other or into you. Only an animal that is up and about gets
// nudged; if two have settled on top of each other, one gets up and walks a step aside instead.
export function separateAnimals() {
  const free = (a) => a.speed > 0.1 || a.sit < 0.1;
  const shove = (a, dx, dz) => { const x = a.x + dx, z = a.z + dz; if (animalWalkable(x, z)) { a.x = x; a.z = z; a.root.position.x = x; a.root.position.z = z; } };
  for (let i = 0; i < animals.length; i++) {
    const a = animals[i];
    const px = a.x - player.x, pz = a.z - player.z, pd = Math.hypot(px, pz), pmin = a.radius + 0.3;
    if (pd < pmin && pd > 1e-4 && free(a) && !a.petted) shove(a, (px / pd) * (pmin - pd), (pz / pd) * (pmin - pd));
    for (let j = i + 1; j < animals.length; j++) {
      const b = animals[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
      if (d >= min) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, over = min - d;
      const fa = free(a), fb = free(b);
      if (!fa && !fb) {
        const mover = !b.goal && !b.petted ? b : !a.goal && !a.petted ? a : null;
        if (!mover || mover.nudgeT > 0) continue;
        const s = mover === b ? 1 : -1;
        if (mover.state === 'follow') mover.side += 1.3;
        else { const q = spotNear(mover.x + nx * s * 1.4, mover.z + nz * s * 1.4, 0.6); setTarget(mover, q.x, q.z); mover.state = 'walk'; }
        mover.nudgeT = 3;
        continue;
      }
      const wa = fa ? (fb ? 0.5 : 1) : 0, wb = fb ? (fa ? 0.5 : 1) : 0;
      shove(a, -nx * over * wa, -nz * over * wa);
      shove(b, nx * over * wb, nz * over * wb);
    }
  }
}

/** Dogs shake off once the rain stops. */
export function shakeDogs() {
  animals.forEach((a) => { if (a.kind === 'dog') { a.shake = 1.1; a.shakeDelay = rnd(0.2, 2.5); } });
}
