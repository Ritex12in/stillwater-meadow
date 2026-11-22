// Cats and dogs: wandering, following you, sheltering from rain, goals set by features
// (campfire circle, fishing buddy, food on the ground), personal space, and body language.
// Until tamed (features/pets.js), cats keep their distance and run from you, and dogs watch
// but don't follow; a tamed animal behaves like a pet.
import { scene } from '../core/render.js';
import { TAU, rng, rand, rnd, clamp, damp, angDiff, turnTo } from '../core/math.js';
import { lakePoint, heightAt, groundAt, animalWalkable, DOCK_A } from '../core/shape.js';
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

function addAnimal(kind, rig, near, range, desc) {
  const p = spotNear(near.x, near.z, 6, rng);
  rig.root.scale.setScalar(rig.scale);
  rig.root.position.set(p.x, heightAt(p.x, p.z), p.z);
  scene.add(rig.root);
  animals.push(Object.assign(rig, {
    kind, home: { x: p.x, z: p.z }, range, x: p.x, z: p.z,
    state: 'idle', timer: rand(1, 5), sitting: rng() < 0.5, target: { x: p.x, z: p.z }, hasTarget: false,
    heading: rng() * TAU, speed: 0, phase: rng() * TAU, sit: 0, wag: 0.3, look: 0, side: rng() * TAU,
    bond: 0, petted: false, petAmt: 0, purr: null, shake: 0, shakeDelay: 0, goal: null, name: '',
    radius: (rig.radius || (kind === 'dog' ? 0.42 : 0.28)) * (rig.scale || 1), nudgeT: 0, tilt: 0,
    desc, tamed: false, trust: 0, cornerT: 0, cornerCool: 0,
  }));
}

export function buildAnimals() {
  // (round the shore from the jetty: by where you arrive, and a way off the other side)
  const homeA = lakePoint(DOCK_A - 0.43, 1.2);
  const homeB = lakePoint(DOCK_A - 0.73, 1.22);
  const homeC = lakePoint(DOCK_A + 1.02, 1.6);
  // (after the owner's sheets: the first dog is the sheet's puppy, the first cat the sheet's calico)
  addAnimal('dog', makeDog({ coat: '#f6eee2', patch: '#d98a4a' }), homeA, 22, 'white-and-ginger dog');
  addAnimal('dog', makeDog({ coat: '#f3efe8', patch: '#3a3330', bandana: '#3f8f86', scale: 0.9 }), homeB, 20, 'black-and-white dog');
  addAnimal('dog', makeDog({ coat: '#e2b46a', patch: '#b9853f', paw: '#f6ead6', bandana: '#4a6fb0', scale: 0.8 }), homeC, 18, 'little golden dog');
  addAnimal('cat', makeCat({ fur: '#fbf6ee', patch: '#e58c3f', eye: '#8a6a2a' }), homeA, 12, 'calico cat');
  addAnimal('cat', makeCat({ fur: '#8f9298', belly: '#e9e7e2', eye: '#d9c14a', collar: '#3f6fa0' }), homeB, 12, 'grey cat');
  addAnimal('cat', makeCat({ fur: '#2d2a29', belly: '#f1ede6', eye: '#d6c23a', collar: '#c4473a' }), lakePoint(DOCK_A - 1.05, 1.5), 9, 'black cat');
  addAnimal('cat', makeCat({ fur: '#e8a35a', belly: '#fbf2e4', patch: '#c9783a', eye: '#6f9a3a' }), homeC, 12, 'ginger cat');
}

const setTarget = (a, x, z) => { a.target.x = x; a.target.z = z; a.hasTarget = true; };

// ── untamed cats: how close you can get before they run ──
const CAT_FLEE_SPEED = 4.0; // faster than your walk (2.7), slower than your run (5.4)
/** Distance at which this untamed cat bolts, given how you're moving (0: it won't). */
function fleeRadius(a, dp) {
  const tr = a.trust;
  if (tr >= 6) return 0;                                    // curious: keeps a step away instead
  const toCat = Math.atan2(a.x - player.x, a.z - player.z);
  const headOn = player.move > 0.3 && Math.abs(angDiff(player.rot, toCat)) < 0.6;
  const running = player.move > 3.5;
  let r = tr <= 2 ? 7 : (running || headOn ? 4 : 0);        // wary cats only mind running or a straight approach
  const behind = Math.abs(angDiff(a.heading, Math.atan2(player.x - a.x, player.z - a.z))) > 2.2;
  if (behind || player.move < 0.2) r *= 0.5;                // creeping up from behind, or standing still
  return dp < 30 ? r : 0;
}
/** A spot to run to, away from you; null if the cat is boxed in (water, fences) and freezes. */
function fleeSpot(a) {
  const away = Math.atan2(a.x - player.x, a.z - player.z);
  for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.4, -1.4]) {
    const ang = away + off;
    let ok = true;
    for (let d = 1.5; d <= 10.5; d += 1.5) if (!animalWalkable(a.x + Math.sin(ang) * d, a.z + Math.cos(ang) * d)) { ok = false; break; }
    if (ok) return { x: a.x + Math.sin(ang) * 10.5, z: a.z + Math.cos(ang) * 10.5 };
  }
  return null;
}

function pickTarget(a) {
  const dp = Math.hypot(player.x - a.x, player.z - a.z);
  if (a.kind === 'cat' && a.tamed && a.bond > 0.2 && dp < 30 && rnd() < a.bond * 0.7) {
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
  if (a.cornerCool > 0) a.cornerCool -= dt;

  if (a.petted) {
    a.heading = turnTo(a.heading, Math.atan2(dxp, dzp), dt * 3);
    wantSit = 1;
  } else if (a.goal) {
    const g = a.goal, d = Math.hypot(g.x - a.x, g.z - a.z);
    a.state = 'goal';
    setTarget(a, g.x, g.z);
    if (d > 0.4) want = g.fast ? 4.8 : d > 6 ? (a.kind === 'dog' ? 3.2 : 2.0) : (a.kind === 'dog' ? 1.6 : 1.0); // (`fast`: running for a thrown stick)
    else {
      wantSit = g.sit === false ? 0 : 1;
      if (g.faceX !== undefined) a.heading = turnTo(a.heading, Math.atan2(g.faceX - a.x, g.faceZ - a.z), dt * 3);
    }
  } else if (a.kind === 'cat' && !a.tamed && (a.state === 'flee' || a.state === 'cornered' || a.state === 'wary' || (a.cornerCool <= 0 && dp < fleeRadius(a, dp)))) {
    // an untamed cat that's been startled: run, look back from a safe distance, or freeze if boxed in
    if (a.state === 'cornered') {
      a.cornerT -= dt; wantSit = 1;
      a.heading = turnTo(a.heading, Math.atan2(dxp, dzp), dt * 4);
      if (a.cornerT <= 0) { a.state = 'idle'; a.timer = 1; a.cornerCool = 4; }
    } else if (a.state === 'wary') {                       // looking back at you from its safe spot
      a.timer -= dt;
      a.heading = turnTo(a.heading, Math.atan2(dxp, dzp), dt * 3);
      if (dp < fleeRadius(a, dp)) a.state = 'idle';       // you came closer: run again
      else if (a.timer <= 0) { a.state = 'idle'; a.timer = 2; a.home = { x: a.x, z: a.z }; }
    } else {
      if (a.state !== 'flee' || !a.hasTarget) {
        const spot = fleeSpot(a);
        if (!spot) { a.state = 'cornered'; a.cornerT = 3; } // nowhere to go: it freezes, crouched
        else { setTarget(a, spot.x, spot.z); a.state = 'flee'; }
      }
      if (a.state === 'flee') {
        const d = Math.hypot(a.target.x - a.x, a.target.z - a.z);
        if (dp > 12 || d < 0.6) { a.state = 'wary'; a.timer = 3; a.hasTarget = false; } // far enough: stop and look back
        else want = CAT_FLEE_SPEED;
      }
    }
  } else if (a.kind === 'cat' && (wx.rain > 0.35 || wx.storm > 0.3)) {
    // cats hurry under the nearest tree and curl up until the rain passes
    if (a.state !== 'shelter') { const s = shelterSpot(a); setTarget(a, s.x, s.z); a.state = 'shelter'; }
    const d = Math.hypot(a.target.x - a.x, a.target.z - a.z);
    if (d > 0.45) want = d > 3 ? 2.2 : 1.1;
    else wantSit = 1;
  } else {
    if (a.state === 'shelter' || a.state === 'goal' || a.state === 'petted' || a.state === 'flee' || a.state === 'cornered' || a.state === 'wary') { a.state = 'idle'; a.timer = rnd(2, 6); a.sitting = false; a.home = { x: a.x, z: a.z }; }
    if (a.kind === 'dog') {
      if (a.state !== 'follow' && a.tamed && dp < 8 + a.bond * 10 && rnd() < dt * (0.35 + a.bond * 1.5)) { a.state = 'follow'; a.timer = rnd(18, 40) * (1 + a.bond * 2); }
      if (a.state === 'follow') {
        a.timer -= dt;
        if (dp > 26 + a.bond * 20 || a.timer <= 0) { a.state = 'idle'; a.timer = rnd(2, 5); a.home = { x: a.x, z: a.z }; }
        else {
          if (player.move > 0.1) a.side += dt * 0.05; // spot beside you only drifts while you walk
          const sideWas = a.side;
          for (const o of animals) { // followers fan out: each dog makes room for the ones before it
            if (o === a) break;
            if (o.state !== 'follow') continue;
            const df = angDiff(o.side, a.side);
            if (Math.abs(df) < 1.2) a.side += (df >= 0 ? 1 : -1) * dt * 1.5;
          }
          const tx = player.x + Math.cos(a.side) * 2.3, tz = player.z + Math.sin(a.side) * 2.3;
          setTarget(a, tx, tz);
          const d = Math.hypot(tx - a.x, tz - a.z);
          const making = Math.abs(a.side - sideWas) > 1e-6; // (still making room: it does not sit down in another dog's place)
          const settle = a.sit > 0.5 && !making ? 1.8 : 0.7; // a seated dog stays put until you actually move off
          if (d > settle) want = d > 5 ? 4.4 : Math.min(2.4, d * 1.1);
          else wantSit = player.move < 0.1 && !making ? 1 : 0;
        }
      } else if (a.beg && dp < 3.5) {
        // a dog that isn't yours yet sits and watches you, hoping for food (features/pets.js sets `beg`)
        a.state = 'idle'; a.timer = Math.max(a.timer, 1); a.sitting = true;
        a.heading = turnTo(a.heading, Math.atan2(dxp, dzp), dt * 3);
      }
    } else if (!a.tamed && a.trust >= 6 && dp < 2) {
      // a curious cat: lets you near, but keeps a step away
      const ang = Math.atan2(a.x - player.x, a.z - player.z);
      setTarget(a, a.x + Math.sin(ang) * 1.2, a.z + Math.cos(ang) * 1.2);
      a.state = 'walk';
    } else if (a.tamed && dp < 2.8 && a.state !== 'rest' && !(a.nudgeT > 0)) {
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
