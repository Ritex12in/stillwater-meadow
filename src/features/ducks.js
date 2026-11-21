// Ducks paddling on the lake. Toss bread (B) and they race over for it.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, lerp, rnd, turnTo } from '../core/math.js';
import { lakeAt, lakeT, lakePoint, heightAt, onDock, waterAhead } from '../core/shape.js';
import { std } from '../core/materials.js';
import { hooks, seasonState } from '../core/state.js';
import { player, hero } from '../characters/player.js';
import { boat, boatSeat } from '../characters/boat.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { camForward } from '../systems/input.js';
import { spawnRipple } from '../world/effects.js';
import { toast } from '../ui/hud.js';
import { quack, plop } from './voices.js';

const ducks = [];
const crumbs = [];
const frozen = () => seasonState.ice > 0.5;
const duckWater = (x, z) => lakeT(x, z) < 0.97 && heightAt(x, z) < -0.05 && !onDock(x, z);
const canToss = () => (activity.free || (activity.is('sit') && player.seat === boatSeat));

function makeDuck(male) {
  const g = new THREE.Group();
  const bodyMat = std(male ? '#8b7d68' : '#8a6b4a');
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), bodyMat);
  body.scale.set(0.17, 0.11, 0.27); body.position.y = 0.07;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), bodyMat);
  tail.position.set(0, 0.12, -0.25); tail.rotation.x = -2.1;
  const wingMat = std(male ? '#6f6556' : '#735a3e');
  [-1, 1].forEach((s) => {
    const w = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), wingMat);
    w.scale.set(0.04, 0.07, 0.19); w.position.set(s * 0.14, 0.11, -0.03);
    g.add(w);
  });
  const head = new THREE.Group();
  head.position.set(0, 0.17, 0.2);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.09), std('#e8b23a'));
  beak.position.set(0, -0.015, 0.09);
  head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), std(male ? '#2e6b40' : '#7a5b3c')), beak);
  if (male) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10), std('#f2efe6'));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.065; head.add(ring);
  }
  [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.01), std('#111111')); e.position.set(s * 0.055, 0.02, 0.05); head.add(e); });
  g.add(body, tail, head);
  scene.add(g);
  return { g, head };
}

const crumbGeo = new THREE.BoxGeometry(0.07, 0.03, 0.07);
const crumbMat = std('#e2c48a');
function tossBread() {
  if (frozen()) { toast('The lake is frozen, and the ducks have flown south for the winter.'); return; }
  const p = waterAhead(player, camForward());
  if (!p) { toast('Face the water to toss some bread.'); return; }
  const f = camForward();
  if (!player.seat) player.rot = Math.atan2(f.x, f.z);
  player.throwT = 0.5;
  const m = new THREE.Mesh(crumbGeo, crumbMat);
  m.position.set(player.x, player.y + 1.0, player.z);
  scene.add(m);
  crumbs.push({ m, from: m.position.clone(), to: new THREE.Vector3(p.x + rnd(-0.4, 0.4), 0.05, p.z + rnd(-0.4, 0.4)), t: 0, life: 45, landed: false, skip: null });
}

export function initDucks() {
  for (let i = 0; i < 5; i++) {
    const d = makeDuck(i % 2 === 0);
    const p = lakePoint(rnd() * TAU, rnd(0.25, 0.75));
    Object.assign(d, { x: p.x, z: p.z, heading: rnd() * TAU, target: null, next: 0, dip: 0, dipIn: rnd(5, 15), rip: 0, quackIn: rnd(10, 50), seed: rnd() * 10, chasing: false, stuckT: 0 });
    ducks.push(d);
  }
  let nearestDuck = Infinity;
  registerAction({
    id: 'bread', key: 'KeyB', keyLabel: 'B',
    available: () => !frozen() && nearestDuck < 45 && canToss() && waterAhead(player, camForward()),
    label: () => 'Toss bread for the ducks', score: () => 0, run: tossBread,
  });
  // the throwing arm
  hooks.pose.push((dt) => {
    if (!player.throwT) return;
    player.throwT = Math.max(0, player.throwT - dt);
    const e = Math.sin((1 - player.throwT / 0.5) * Math.PI);
    hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -2.2 + (1 - player.throwT / 0.5) * 1.4, e);
    hero.elbows[1].rotation.x = lerp(hero.elbows[1].rotation.x, -0.9 * (player.throwT / 0.5), e); // wound up, then flung straight
  });

  hooks.frame.push((dt, t) => {
    const fz = frozen();
    nearestDuck = Infinity;
    for (const d of ducks) {
      d.g.visible = !fz;
      if (fz) continue;
      nearestDuck = Math.min(nearestDuck, Math.hypot(d.x - player.x, d.z - player.z));
      let goal = null, gd = 30;
      for (const c of crumbs) {
        if (!c.landed || (c.skip && c.skip.has(d))) continue;
        const cd = Math.hypot(c.m.position.x - d.x, c.m.position.z - d.z);
        if (cd < gd) { gd = cd; goal = c; }
      }
      let speed = 0.35;
      if (goal) { d.target = { x: goal.m.position.x, z: goal.m.position.z }; speed = 1.2; d.chasing = true; }
      else {
        if (d.chasing) { d.chasing = false; d.target = null; } // the bread is gone: drift off somewhere new
        d.next -= dt;
        if (d.next <= 0 || !d.target) { const lake = lakeAt(d.x, d.z); d.target = lake.point(Math.atan2(d.z - lake.z, d.x - lake.x) + rnd(-0.6, 0.6), rnd(0.2, 0.8)); d.next = rnd(6, 16); } // (somewhere else on the lake it is on)
      }
      const bx = boat.position.x - d.x, bz = boat.position.z - d.z;
      if (Math.hypot(bx, bz) < 4) { d.target = { x: d.x - bx * 2, z: d.z - bz * 2 }; speed = 0.9; }
      const tx = d.target.x - d.x, tz = d.target.z - d.z, td = Math.hypot(tx, tz);
      let moving = false;
      if (td > 0.3) {
        d.heading = turnTo(d.heading, Math.atan2(tx, tz), dt * 2.2);
        const nx = d.x + Math.sin(d.heading) * speed * dt, nz = d.z + Math.cos(d.heading) * speed * dt;
        if (duckWater(nx, nz)) { d.x = nx; d.z = nz; moving = true; } else d.next = 0;
      }
      // blocked on the way to the bread (the jetty or the shore is in the way): give up on that piece
      d.stuckT = goal && !moving && td > 0.3 ? d.stuckT + dt : 0;
      if (goal && d.stuckT > 2) { (goal.skip || (goal.skip = new Set())).add(d); d.chasing = false; d.target = null; d.stuckT = 0; }
      if (goal && gd < 0.35) { goal.life = 0; quack(d.x, d.z, 2); spawnRipple(d.x, d.z, 0.5); }
      d.rip -= dt;
      if (moving && d.rip <= 0) { spawnRipple(d.x - Math.sin(d.heading) * 0.25, d.z - Math.cos(d.heading) * 0.25, 0.35); d.rip = 1.3; }
      d.dipIn -= dt;
      if (d.dipIn <= 0 && !goal) { d.dip = 1.2; d.dipIn = rnd(6, 16); }
      d.dip = Math.max(0, d.dip - dt);
      const dipE = d.dip > 0 ? Math.sin((1 - d.dip / 1.2) * Math.PI) : 0;
      d.g.position.set(d.x, 0.02 + Math.sin(t * 2 + d.seed) * 0.01, d.z);
      d.g.rotation.set(dipE * 0.9, d.heading, Math.sin(t * 1.4 + d.seed) * 0.04);
      d.head.rotation.x = dipE * 0.6;
      d.quackIn -= dt;
      if (d.quackIn <= 0) { if (Math.hypot(d.x - player.x, d.z - player.z) < 35) quack(d.x, d.z, 1 + Math.floor(rnd() * 3)); d.quackIn = rnd(25, 70); }
    }
    if (!fz) { // a little personal space
      for (let i = 0; i < ducks.length; i++) {
        for (let j = i + 1; j < ducks.length; j++) {
          const a = ducks[i], b = ducks[j];
          const dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz), min = 0.65;
          if (dd >= min) continue;
          const nx = dd > 1e-4 ? dx / dd : 1, nz = dd > 1e-4 ? dz / dd : 0, push = (min - dd) / 2;
          if (duckWater(a.x - nx * push, a.z - nz * push)) { a.x -= nx * push; a.z -= nz * push; }
          if (duckWater(b.x + nx * push, b.z + nz * push)) { b.x += nx * push; b.z += nz * push; }
        }
      }
    }
    for (let i = crumbs.length - 1; i >= 0; i--) {
      const c = crumbs[i];
      if (!c.landed) {
        c.t += dt / 0.7;
        const k = Math.min(1, c.t);
        c.m.position.lerpVectors(c.from, c.to, k);
        c.m.position.y = lerp(c.from.y, c.to.y, k) + Math.sin(k * Math.PI) * 1.4;
        if (k >= 1) { c.landed = true; spawnRipple(c.to.x, c.to.z, 0.5); plop(c.to.x, c.to.z, 0.5); }
      } else {
        c.life -= dt;
        c.m.position.y = 0.05 + Math.sin(t * 2 + i) * 0.01;
      }
      if (c.landed && c.life <= 0) { scene.remove(c.m); crumbs.splice(i, 1); }
    }
  });
}

/** For tests. */
export const duckState = () => ({ ducks, crumbs });
