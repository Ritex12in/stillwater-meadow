// Wildlife: a heron in the reeds, fish jumping at dusk and dawn, an owl at night, frogs on the
// lily pads, and a shy deer at the forest edge.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, lerp, damp, smooth, rnd } from '../core/math.js';
import { lakeAt, lakeT, heightAt, walkable, HOME, lakeIce } from '../core/shape.js';
import { std, enableShadows, glowTex } from '../core/materials.js';
import { hooks, seasonState, world } from '../core/state.js';
import { clock } from '../core/clock.js';
import { player } from '../characters/player.js';
import { boat } from '../characters/boat.js';
import { cur, timeCtl } from '../systems/time.js';
import { wx } from '../systems/weather.js';
import { treeSpots } from '../world/vegetation.js';
import { spawnRipple } from '../world/effects.js';
import { lifeLake, lifeOf } from '../world/lakelife.js';
import { hoot, croak, kraak, snort, plop } from './voices.js';

const frozen = () => lakeIce(world.lifeLake || HOME) > 0.5; // (the lake the creatures are at)

// ── Heron ──────────────────────────────────────────────────────
function makeHeron() {
  const g = new THREE.Group();
  const grey = std('#9aa3ad'), dark = std('#3d4248'), legM = std('#c9a85a'), white = std('#e8e6df');
  const legs = [];
  [-0.06, 0.06].forEach((x) => {
    const l = new THREE.Group(); l.position.set(x, 0.62, 0);
    l.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 4).translate(0, -0.31, 0), legM));
    g.add(l); legs.push(l);
  });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), grey);
  body.scale.set(0.15, 0.17, 0.36); body.position.set(0, 0.78, -0.02); body.rotation.x = -0.25;
  const neck = new THREE.Group(); neck.position.set(0, 0.86, 0.22);
  neck.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 5).translate(0, 0.21, 0), white));
  const head = new THREE.Group(); head.position.set(0, 0.42, 0);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), dark); crest.position.set(0, 0.03, -0.06);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.2, 4).rotateX(Math.PI / 2), std('#d8b04a')); beak.position.set(0, -0.005, 0.12);
  head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), white), crest, beak); neck.add(head);
  neck.rotation.x = 0.25;
  const wings = [];
  [-1, 1].forEach((s) => {
    const w = new THREE.Group(); w.position.set(s * 0.1, 0.84, 0);
    w.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.32).translate(s * 0.35, 0, 0), grey));
    w.visible = false; g.add(w); wings.push(w);
  });
  g.add(body, neck);
  enableShadows(g);
  scene.add(g);
  return { g, neck, legs, wings, spot: 0, state: 'stand', strikeIn: rnd(6, 14), strike: 0, fly: null, heading: 0 };
}

export function initWildlife() {
  // the heron's four standing places round the lake it is at, counted from the jetty (or from where one would be)
  let heronLake = lifeLake, heronSpots = [];
  const siteHeron = (lake) => {
    heronLake = lake;
    const base = Math.PI / 2 + 0.55 + (lake.turn || 0);
    heronSpots = [1.4, 2.6, 3.9, 5.0].map((o) => lake.point(base + o, 0.97));
  };
  siteHeron(lifeLake);
  const heron = makeHeron();
  const placeHeron = (i) => {
    heron.spot = i;
    const p = heronSpots[i];
    heron.g.position.set(p.x, Math.max(heightAt(p.x, p.z), -0.3), p.z);
    heron.heading = Math.atan2(heronLake.x - p.x, heronLake.z - p.z) + rnd(-0.6, 0.6);
    heron.g.rotation.set(0, heron.heading, 0);
  };
  placeHeron(1);
  hooks.lake.push((lake) => { siteHeron(lake); placeHeron(1); }); // (you have come to another lake: the heron is fishing there)

  // fish jumping
  const jumpers = [0, 1].map(() => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), std('#b9c4cc', { metalness: 0.3, roughness: 0.4 }));
    b.scale.set(0.035, 0.06, 0.14);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 3).rotateX(-Math.PI / 2), std('#9aa6ae'));
    tail.position.z = -0.15;
    g.add(b, tail); g.visible = false; scene.add(g);
    return { g, t: 1, from: new THREE.Vector3(), dir: 0 };
  });
  let jumpIn = 5;

  // owl eyes
  const eyeMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const eyes = [0, 1].map(() => { const s = new THREE.Sprite(eyeMat); s.scale.set(0.16, 0.16, 1); s.visible = false; scene.add(s); return s; });
  let hootIn = 12, eyesT = 0;

  // frogs
  const pads = lifeOf(lifeLake).pads.slice();
  const frogs = [];
  for (let i = 0; i < Math.min(6, pads.length); i++) {
    const pad = pads.splice(Math.floor(rnd() * pads.length), 1)[0];
    const g = new THREE.Group();
    const green = std('#5f8f3a');
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), green);
    body.scale.set(0.07, 0.045, 0.085); body.position.y = 0.04;
    const throat = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), std('#d9d08a'));
    throat.scale.set(0.035, 0.03, 0.03); throat.position.set(0, 0.025, 0.06);
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), green); e.position.set(s * 0.035, 0.08, 0.04); g.add(e); });
    g.add(body, throat);
    g.position.set(pad.x + rnd(-0.15, 0.15), 0.06, pad.z + rnd(-0.15, 0.15));
    g.rotation.y = rnd() * TAU;
    scene.add(g);
    frogs.push({ g, throat, puff: 0 });
  }
  let croakIn = 3;
  // you have come to another lake: the frogs are on its lily pads (if it has any)
  hooks.lake.push((lake) => {
    const here = lifeOf(lake).pads;
    frogs.forEach((f, i) => {
      const pad = here.length ? here[(i * 5 + 2) % here.length] : null;
      f.away = !pad;
      if (pad) f.g.position.set(pad.x + ((i % 3) - 1) * 0.12, 0.06, pad.z + (((i * 2) % 3) - 1) * 0.12);
    });
  });

  // deer
  const deerSpots = [];
  for (let i = 0; i < 60 && deerSpots.length < 8; i++) {
    const a = rnd() * TAU, r = HOME.rmax * rnd(2.1, 3.2), x = HOME.x + Math.cos(a) * r, z = HOME.z + Math.sin(a) * r;
    if (walkable(x, z) && heightAt(x, z) < 14 && lakeT(x, z) > 1.5) deerSpots.push({ x, z });
  }
  const deer = (() => {
    const g = new THREE.Group();
    const coat = std('#9a6a3e'), light = std('#e9dcc6'), dark = std('#3a2a1c');
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 1.05), coat); body.position.y = 0.95;
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.8), light); belly.position.y = 0.72;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.06), light); tail.position.set(0, 1.08, -0.54);
    const neck = new THREE.Group(); neck.position.set(0, 1.1, 0.42);
    const nk = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2).translate(0, 0.25, 0), coat);
    nk.rotation.x = 0.35; neck.add(nk);
    const head = new THREE.Group(); head.position.set(0, 0.5, 0.17); neck.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), dark); nose.position.set(0, -0.02, 0.25);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.32).translate(0, 0, 0.08), coat), nose);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), coat); ear.position.set(s * 0.1, 0.12, -0.02); ear.rotation.z = s * 0.5; head.add(ear);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.28, 4), std('#c9b48a')); ant.position.set(s * 0.06, 0.2, -0.02); ant.rotation.z = s * 0.35; head.add(ant);
    });
    const legs = [[-0.14, 0.38], [0.14, 0.38], [-0.14, -0.38], [0.14, -0.38]].map(([x, z]) => {
      const p = new THREE.Group(); p.position.set(x, 0.78, z);
      p.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.78, 0.07).translate(0, -0.39, 0), coat));
      g.add(p); return p;
    });
    g.add(body, belly, tail, neck);
    enableShadows(g);
    scene.add(g);
    return { g, neck, legs, state: 'graze', x: 0, z: 0, heading: 0, t: 0, away: 0, phase: 0, look: 0 };
  })();
  const placeDeer = () => {
    if (!deerSpots.length) { deer.g.visible = false; return; }
    let best = deerSpots[0], bd = -1;
    for (const s of deerSpots) { const d = Math.hypot(s.x - player.x, s.z - player.z); if (d > bd && rnd() < 0.7) { bd = d; best = s; } }
    deer.x = best.x; deer.z = best.z; deer.heading = rnd() * TAU; deer.state = 'graze'; deer.g.visible = true;
  };
  placeDeer();

  hooks.frame.push((dt, t) => {
    // heron
    const h = heron;
    if (h.state === 'stand') {
      const pos = h.g.position;
      const dPlayer = Math.hypot(player.x - pos.x, player.z - pos.z);
      const dBoat = Math.hypot(boat.position.x - pos.x, boat.position.z - pos.z);
      if (dPlayer < 7 || dBoat < 7) {
        let best = 0, bd = -1;
        heronSpots.forEach((p, i) => { const d = Math.hypot(p.x - player.x, p.z - player.z); if (i !== h.spot && d > bd) { bd = d; best = i; } });
        const to = heronSpots[best];
        h.fly = { from: pos.clone(), to: new THREE.Vector3(to.x, Math.max(heightAt(to.x, to.z), -0.3), to.z), t: 0, dur: 7, idx: best };
        h.state = 'fly';
        h.heading = Math.atan2(to.x - pos.x, to.z - pos.z);
        kraak(pos.x, pos.z);
      }
      h.strikeIn -= dt;
      if (h.strikeIn <= 0) { h.strike = 0.7; h.strikeIn = rnd(8, 20); }
      if (h.strike > 0) {
        h.strike -= dt;
        h.neck.rotation.x = 0.25 + Math.sin((1 - h.strike / 0.7) * Math.PI) * 1.3;
        if (h.strike <= 0.35 && h.strike + dt > 0.35) {
          const bx = pos.x + Math.sin(h.heading) * 0.55, bz = pos.z + Math.cos(h.heading) * 0.55;
          spawnRipple(bx, bz, 0.5); plop(bx, bz, 0.6);
        }
      } else h.neck.rotation.x = 0.25 + Math.sin(t * 0.5) * 0.05;
      h.wings.forEach((w) => { w.visible = false; });
      h.legs.forEach((l) => { l.rotation.x = 0; });
    } else {
      const f = h.fly;
      f.t += dt / f.dur;
      const k = Math.min(1, f.t);
      h.g.position.lerpVectors(f.from, f.to, k);
      h.g.position.y += Math.sin(k * Math.PI) * 9;
      h.g.rotation.set(-0.25 * Math.sin(k * Math.PI), h.heading, 0);
      h.neck.rotation.x = 1.2;
      h.wings.forEach((w, i) => { w.visible = true; w.rotation.z = (i ? -1 : 1) * Math.sin(t * 9) * 0.7; });
      h.legs.forEach((l) => { l.rotation.x = -1.3; });
      if (k >= 1) { h.state = 'stand'; placeHeron(f.idx); }
    }

    // fish jumping at dusk and dawn
    const hr = timeCtl.hour;
    jumpIn -= dt;
    if (!frozen() && (cur.eve > 0.25 || (hr > 5.3 && hr < 8)) && jumpIn <= 0) {
      jumpIn = rnd(4, 10);
      const j = jumpers.find((q) => q.t >= 1);
      for (let i = 0; j && i < 10; i++) {
        const p = lakeAt(player.x, player.z).point(rnd() * TAU, rnd(0.25, 0.85)); // (in the lake nearest you)
        if (Math.hypot(p.x - player.x, p.z - player.z) > 40) continue;
        j.from.set(p.x, 0, p.z); j.dir = rnd() * TAU; j.t = 0; j.g.visible = true;
        spawnRipple(p.x, p.z, 0.6); plop(p.x, p.z, 0.7);
        break;
      }
    }
    for (const j of jumpers) {
      if (j.t >= 1) continue;
      j.t += dt / 0.85;
      const k = Math.min(1, j.t);
      const x = j.from.x + Math.sin(j.dir) * 1.2 * k, z = j.from.z + Math.cos(j.dir) * 1.2 * k;
      j.g.position.set(x, Math.sin(k * Math.PI) * 0.7, z);
      j.g.rotation.set(-Math.cos(k * Math.PI) * 1.1, j.dir, 0);
      if (k >= 1) { j.g.visible = false; spawnRipple(x, z, 0.6); plop(x, z, 0.8); }
    }

    // owl
    hootIn -= dt;
    if (cur.stars > 0.5 && wx.rain < 0.3 && hootIn <= 0) {
      hootIn = rnd(18, 45);
      const trees = treeSpots.filter((tr) => { const d = Math.hypot(tr.x - player.x, tr.z - player.z); return d > 12 && d < 45; });
      if (trees.length) {
        const tr = trees[Math.floor(rnd() * trees.length)];
        hoot(tr.x, tr.z);
        // two glowing eyes peeking out of the foliage on the side facing you
        const dl = Math.hypot(player.x - tr.x, player.z - tr.z), tx = (player.x - tr.x) / dl, tz = (player.z - tr.z) / dl;
        const cx = tr.x + tx * tr.s, cz = tr.z + tz * tr.s, y = tr.y + 3.2 * tr.s;
        eyes[0].position.set(cx - tz * 0.07, y, cz + tx * 0.07);
        eyes[1].position.set(cx + tz * 0.07, y, cz - tx * 0.07);
        eyesT = 7;
      }
    }
    eyesT = Math.max(0, eyesT - dt);
    eyeMat.opacity = smooth(0, 1, eyesT) * smooth(7, 6, eyesT) * 0.9 * (Math.sin(clock.elapsed * 0.9) > -0.95 ? 1 : 0);
    eyes.forEach((e) => { e.visible = eyesT > 0; });

    // frogs
    const showFrogs = seasonState.bugs > 0.5 && !frozen();
    frogs.forEach((f) => { f.g.visible = showFrogs && !f.away; });
    if (showFrogs) {
      croakIn -= dt;
      if ((wx.wet > 0.25 || cur.eve > 0.4) && croakIn <= 0) {
        croakIn = rnd(2, 7);
        const near = frogs.filter((f) => Math.hypot(f.g.position.x - player.x, f.g.position.z - player.z) < 35);
        if (near.length) { const f = near[Math.floor(rnd() * near.length)]; f.puff = 0.45; croak(f.g.position.x, f.g.position.z); }
      }
      for (const f of frogs) {
        f.puff = Math.max(0, f.puff - dt);
        const s = 1 + Math.sin((f.puff / 0.45) * Math.PI) * 1.4;
        f.throat.scale.set(0.035 * s, 0.03 * s, 0.03 * s);
      }
    }

    // deer
    const d = deer;
    if (d.state === 'gone') { d.away -= dt; if (d.away <= 0) placeDeer(); return; }
    const dp = Math.hypot(player.x - d.x, player.z - d.z);
    if (d.state === 'graze') {
      if (dp < 16) { d.state = 'flee'; d.t = 4; d.heading = Math.atan2(d.x - player.x, d.z - player.z); snort(d.x, d.z); }
      d.t += dt;
      d.look = damp(d.look, Math.sin(d.t * 0.35) > -0.3 ? 1 : 0, 2, dt);
      d.neck.rotation.x = lerp(-0.2, 1.25, d.look);
      d.legs.forEach((l) => { l.rotation.x = 0; });
      d.g.position.set(d.x, heightAt(d.x, d.z), d.z);
    } else {
      d.t -= dt;
      let nx = d.x + Math.sin(d.heading) * 7 * dt, nz = d.z + Math.cos(d.heading) * 7 * dt;
      if (!walkable(nx, nz)) { d.heading += 0.8; nx = d.x; nz = d.z; }
      d.x = nx; d.z = nz;
      d.phase += dt * 11;
      d.g.position.set(d.x, heightAt(d.x, d.z) + Math.abs(Math.sin(d.phase)) * 0.35, d.z);
      d.neck.rotation.x = -0.35;
      d.legs.forEach((l, i) => { l.rotation.x = (i < 2 ? -1 : 1) * Math.sin(d.phase) * 0.7; });
      if (d.t <= 0) { d.state = 'gone'; d.away = 45; d.g.visible = false; }
    }
    d.g.rotation.y = d.heading;
  });
}
