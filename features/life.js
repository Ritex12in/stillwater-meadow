/* Animal voices, ducks you can feed, and wildlife: a heron in the reeds, fish jumping at dusk,
   an owl at night, frogs after rain and a shy deer at the forest edge. */
(() => {
  'use strict';
  const SW = window.SW;
  if (!SW) return;
  const { THREE, rand, clamp, damp, lerp, smooth, TAU, angDiff, turnTo, std, lakeT, lakePoint, height, player } = SW;

  // ── Synthesised voices ────────────────────────────────────────
  function env(g, t, peak, attack, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }
  function bark(x, z, size = 1, times = 2) {
    const v = SW.voice(x, z, 45, 0.9);
    if (!v) return;
    const { ctx, out } = v;
    for (let i = 0; i < times; i++) {
      const t = v.t + i * rand(0.2, 0.28);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = rand(340, 400) / size;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.12);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 820 / Math.sqrt(size); bp.Q.value = 1.2;
      const g = ctx.createGain(); env(g, t, 0.55, 0.012, 0.15);
      o.connect(bp).connect(g).connect(out);
      o.start(t); o.stop(t + 0.2);
      const n = SW.noise(ctx), nb = ctx.createBiquadFilter(), ng = ctx.createGain();
      nb.type = 'bandpass'; nb.frequency.value = 1400; nb.Q.value = 0.8;
      env(ng, t, 0.18, 0.005, 0.07);
      n.connect(nb).connect(ng).connect(out);
      n.start(t, rand(0, 3)); n.stop(t + 0.1);
    }
  }
  function meow(x, z, pitch = 1) {
    const v = SW.voice(x, z, 32, 0.9);
    if (!v) return;
    const { ctx, out, t } = v;
    const dur = rand(0.5, 0.8), f = 560 * pitch * rand(0.9, 1.1);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.85, t);
    o.frequency.linearRampToValueAtTime(f * 1.25, t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(f * 0.8, t + dur);
    const fm = ctx.createBiquadFilter(); fm.type = 'bandpass'; fm.Q.value = 3.5;
    fm.frequency.setValueAtTime(900, t);
    fm.frequency.linearRampToValueAtTime(1900, t + dur * 0.4);
    fm.frequency.linearRampToValueAtTime(1100, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1.1, t + 0.06);
    g.gain.setValueAtTime(1.1, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fm).connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function quack(x, z, n = 2) {
    const v = SW.voice(x, z, 40, 0.8);
    if (!v) return;
    const { ctx, out } = v;
    for (let i = 0; i < n; i++) {
      const t = v.t + i * rand(0.17, 0.24);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(rand(280, 310), t);
      o.frequency.exponentialRampToValueAtTime(235, t + 0.14);
      const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 1150; b1.Q.value = 5;
      const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 2300; b2.Q.value = 6;
      const g = ctx.createGain(); env(g, t, 1.4, 0.015, 0.15);
      o.connect(b1).connect(g); o.connect(b2).connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.2);
    }
  }
  function hoot(x, z) {
    const v = SW.voice(x, z, 80, 0.55);
    if (!v) return;
    const { ctx, out } = v;
    [[0, 0.34], [0.58, 0.16], [0.8, 0.5]].forEach(([dt, len]) => {
      const t = v.t + dt;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(375, t); o.frequency.linearRampToValueAtTime(345, t + len);
      const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
      const vg = ctx.createGain(); vg.gain.value = 5;
      vib.connect(vg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.07);
      g.gain.setValueAtTime(0.5, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.1);
      o.connect(g).connect(out);
      o.start(t); vib.start(t); o.stop(t + len + 0.15); vib.stop(t + len + 0.15);
    });
  }
  function croak(x, z) {
    const v = SW.voice(x, z, 32, 0.8);
    if (!v) return;
    const { ctx, out } = v;
    [0, 0.2].forEach((dt, i) => {
      const t = v.t + dt;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 105 + i * 35;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 2.5;
      const am = ctx.createGain(); am.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28;
      const lg = ctx.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain);
      const g = ctx.createGain(); env(g, t, 0.7, 0.02, 0.16);
      o.connect(bp).connect(am).connect(g).connect(out);
      o.start(t); lfo.start(t); o.stop(t + 0.22); lfo.stop(t + 0.22);
    });
  }
  function kraak(x, z) {
    const v = SW.voice(x, z, 60, 0.7);
    if (!v) return;
    const { ctx, out, t } = v;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(360, t); o.frequency.exponentialRampToValueAtTime(230, t + 0.35);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 1.2;
    const g = ctx.createGain(); env(g, t, 0.6, 0.02, 0.35);
    o.connect(bp).connect(g).connect(out);
    o.start(t); o.stop(t + 0.42);
  }
  function snort(x, z) {
    const v = SW.voice(x, z, 45, 0.8);
    if (!v) return;
    const { ctx, out, t } = v;
    const n = SW.noise(ctx), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1;
    env(g, t, 0.8, 0.02, 0.28);
    n.connect(bp).connect(g).connect(out);
    n.start(t, rand(0, 3)); n.stop(t + 0.35);
  }
  function plop(x, z, vol = 1) {
    const v = SW.voice(x, z, 35, 0.5 * vol);
    if (!v) return;
    const { ctx, out, t } = v;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(rand(700, 950), t); o.frequency.exponentialRampToValueAtTime(260, t + 0.09);
    const g = ctx.createGain(); env(g, t, 0.6, 0.005, 0.1);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.14);
    const n = SW.noise(ctx), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.9;
    env(ng, t, 0.25, 0.005, 0.18);
    n.connect(bp).connect(ng).connect(out);
    n.start(t, rand(0, 3)); n.stop(t + 0.22);
  }
  SW.sfx = { bark, meow, quack, hoot, croak, kraak, snort, plop };

  // ── When cats and dogs speak up ───────────────────────────────
  const mem = new Map();
  SW.hooks.frame.push((dt) => {
    for (const a of SW.animals) {
      let m = mem.get(a);
      if (!m) { m = { near: false, idle: rand(30, 90), prevState: a.state, prevPetted: false }; mem.set(a, m); }
      const dp = Math.hypot(a.x - player.x, a.z - player.z);
      if (a.kind === 'dog') {
        const size = a.scale || 1;
        if (a.state === 'follow' && m.prevState !== 'follow' && Math.random() < 0.6) bark(a.x, a.z, size, 2);
        if (a.greet) { if (SW.audio.on) { bark(a.x, a.z, size, 3); a.greet = false; } else if (SW.elapsed > 25) a.greet = false; }
        m.idle -= dt;
        if (m.idle <= 0) { if (dp < 30 && !a.petted && a.state !== 'goal') bark(a.x, a.z, size, Math.random() < 0.5 ? 1 : 2); m.idle = rand(40, 100); }
      } else {
        const pitch = 1;
        if (dp < 4 && !m.near) { m.near = true; if (Math.random() < 0.65) meow(a.x, a.z, pitch); }
        if (dp > 7) m.near = false;
        if (m.prevPetted && !a.petted && Math.random() < 0.5) meow(a.x, a.z, pitch * 1.1);
        m.idle -= dt;
        if (m.idle <= 0) { if (dp < 18 && a.state !== 'shelter') meow(a.x, a.z, pitch); m.idle = rand(50, 120); }
      }
      m.prevState = a.state;
      m.prevPetted = a.petted;
    }
  });

  // ── Ducks ─────────────────────────────────────────────────────
  const lakeSpot = (minT, maxT) => lakePoint(Math.random() * TAU, rand(minT, maxT));
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
    const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), std(male ? '#2e6b40' : '#7a5b3c'));
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.09), std('#e8b23a'));
    beak.position.set(0, -0.015, 0.09);
    head.add(hd, beak);
    if (male) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10), std('#f2efe6'));
      ring.rotation.x = Math.PI / 2; ring.position.y = -0.065; head.add(ring);
    }
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.01), std('#111111')); e.position.set(s * 0.055, 0.02, 0.05); head.add(e); });
    g.add(body, tail, head);
    SW.scene.add(g);
    return { g, head, body };
  }
  const ducks = [];
  for (let i = 0; i < 5; i++) {
    const d = makeDuck(i % 2 === 0);
    const p = lakeSpot(0.25, 0.75);
    Object.assign(d, { x: p.x, z: p.z, heading: Math.random() * TAU, target: null, next: 0, dip: 0, dipIn: rand(5, 15), rip: 0, quackIn: rand(10, 50), seed: Math.random() * 10 });
    ducks.push(d);
  }
  const crumbs = [];
  const crumbGeo = new THREE.BoxGeometry(0.07, 0.03, 0.07), crumbMat = std('#e2c48a');
  SW.waterAhead = (dists = [4.5, 3.5, 6, 7.5, 2.5]) => {
    const f = SW.camForward();
    for (const d of dists) {
      const x = player.x + f.x * d, z = player.z + f.z * d;
      if (lakeT(x, z) < 0.97 && height(x, z) < -0.05 && !SW.onDock(x, z)) return { x, z };
    }
    return null;
  };
  const frozen = () => SW.seasonState.ice > 0.5;
  const duckWater = (x, z) => lakeT(x, z) < 0.97 && height(x, z) < -0.05 && !SW.onDock(x, z);
  function tossBread() {
    if (frozen()) { SW.toast('The lake is frozen, and the ducks have flown south for the winter.'); return; }
    const p = SW.waterAhead();
    if (!p) { SW.toast('Face the water to toss some bread.'); return; }
    const f = SW.camForward();
    if (!player.seat) player.rot = Math.atan2(f.x, f.z);
    player.throwT = 0.5;
    const m = new THREE.Mesh(crumbGeo, crumbMat);
    m.position.set(player.x, player.y + 1.3, player.z);
    SW.scene.add(m);
    crumbs.push({ m, from: m.position.clone(), to: new THREE.Vector3(p.x + rand(-0.4, 0.4), 0.05, p.z + rand(-0.4, 0.4)), t: 0, life: 45, landed: false });
  }
  const breadPrompt = SW.addPrompt('B', tossBread);
  SW.onKey('KeyB', tossBread);
  let promptCheck = 0;

  function updateDucks(dt, t) {
    const fz = frozen();
    let nearest = Infinity;
    for (const d of ducks) {
      d.g.visible = !fz;
      if (fz) continue;
      nearest = Math.min(nearest, Math.hypot(d.x - player.x, d.z - player.z));
      // nearest floating crumb wins over wandering
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
        if (d.next <= 0 || !d.target) { const p = lakePoint(Math.atan2(d.z - SW.LAKE.z, d.x - SW.LAKE.x) + rand(-0.6, 0.6), rand(0.2, 0.8)); d.target = p; d.next = rand(6, 16); }
      }
      // keep clear of the boat
      const bx = SW.boat.position.x - d.x, bz = SW.boat.position.z - d.z;
      if (Math.hypot(bx, bz) < 4) { d.target = { x: d.x - bx * 2, z: d.z - bz * 2 }; speed = 0.9; }
      const tx = d.target.x - d.x, tz = d.target.z - d.z, td = Math.hypot(tx, tz);
      let moving = false;
      if (td > 0.3) {
        d.heading = turnTo(d.heading, Math.atan2(tx, tz), dt * 2.2);
        const nx = d.x + Math.sin(d.heading) * speed * dt, nz = d.z + Math.cos(d.heading) * speed * dt;
        if (duckWater(nx, nz)) { d.x = nx; d.z = nz; moving = true; } else d.next = 0;
      }
      // blocked on the way to the bread (the jetty or the shore is in the way): give up on that piece
      d.stuckT = goal && !moving && td > 0.3 ? (d.stuckT || 0) + dt : 0;
      if (goal && d.stuckT > 2) { (goal.skip || (goal.skip = new Set())).add(d); d.chasing = false; d.target = null; d.stuckT = 0; }
      if (goal && gd < 0.35) {
        goal.life = 0;
        quack(d.x, d.z, 2);
        SW.spawnRipple(d.x, d.z, 0.5);
      }
      d.rip -= dt;
      if (moving && d.rip <= 0) { SW.spawnRipple(d.x - Math.sin(d.heading) * 0.25, d.z - Math.cos(d.heading) * 0.25, 0.35); d.rip = 1.3; }
      // dabbling: tip forward with the tail up now and then
      d.dipIn -= dt;
      if (d.dipIn <= 0 && !goal) { d.dip = 1.2; d.dipIn = rand(6, 16); }
      d.dip = Math.max(0, d.dip - dt);
      const dipE = d.dip > 0 ? Math.sin((1 - d.dip / 1.2) * Math.PI) : 0;
      d.g.position.set(d.x, 0.02 + Math.sin(t * 2 + d.seed) * 0.01, d.z);
      d.g.rotation.set(dipE * 0.9, d.heading, Math.sin(t * 1.4 + d.seed) * 0.04);
      d.head.rotation.x = dipE * 0.6;
      d.quackIn -= dt;
      if (d.quackIn <= 0) { if (Math.hypot(d.x - player.x, d.z - player.z) < 35) quack(d.x, d.z, 1 + Math.floor(Math.random() * 3)); d.quackIn = rand(25, 70); }
    }
    // ducks keep a little space between each other
    if (!fz) {
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
        if (k >= 1) { c.landed = true; SW.spawnRipple(c.to.x, c.to.z, 0.5); plop(c.to.x, c.to.z, 0.5); }
      } else {
        c.life -= dt;
        c.m.position.y = 0.05 + Math.sin(t * 2 + i) * 0.01;
      }
      if (c.landed && c.life <= 0) { SW.scene.remove(c.m); crumbs.splice(i, 1); }
    }
    promptCheck -= dt;
    if (promptCheck <= 0) {
      promptCheck = 0.25;
      const can = !fz && nearest < 45 && (!player.seat || player.seat === SW.boatSeat) && !player.petting && !player.lie && SW.waterAhead();
      breadPrompt.set(can ? 'Toss bread for the ducks' : '');
    }
  }
  // throwing arm
  SW.hooks.pose.push((dt) => {
    if (!player.throwT) return;
    player.throwT = Math.max(0, player.throwT - dt);
    const e = Math.sin((1 - player.throwT / 0.5) * Math.PI);
    SW.hero.arms[1].rotation.x = lerp(SW.hero.arms[1].rotation.x, -2.2 + (1 - player.throwT / 0.5) * 1.4, e);
  });

  // ── Heron ─────────────────────────────────────────────────────
  const heronSpots = [1.4, 2.6, 3.9, 5.0].map((o) => lakePoint(SW.dockStart && Math.atan2(SW.dockStart.z - SW.LAKE.z, SW.dockStart.x - SW.LAKE.x) + o, 0.97));
  const heron = (() => {
    const g = new THREE.Group();
    const grey = std('#9aa3ad'), dark = std('#3d4248'), legM = std('#c9a85a'), white = std('#e8e6df');
    const legs = [];
    [-0.06, 0.06].forEach((x) => {
      const l = new THREE.Group(); l.position.set(x, 0.62, 0);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 4).translate(0, -0.31, 0), legM);
      l.add(m); g.add(l); legs.push(l);
    });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), grey);
    body.scale.set(0.15, 0.17, 0.36); body.position.set(0, 0.78, -0.02); body.rotation.x = -0.25;
    const neck = new THREE.Group(); neck.position.set(0, 0.86, 0.22);
    const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 5).translate(0, 0.21, 0), white);
    neck.add(n1);
    const head = new THREE.Group(); head.position.set(0, 0.42, 0);
    const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), white);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), dark); crest.position.set(0, 0.03, -0.06);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.2, 4).rotateX(Math.PI / 2), std('#d8b04a')); beak.position.set(0, -0.005, 0.12);
    head.add(hd, crest, beak); neck.add(head);
    neck.rotation.x = 0.25;
    const wings = [];
    [-1, 1].forEach((s) => {
      const w = new THREE.Group(); w.position.set(s * 0.1, 0.84, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.32).translate(s * 0.35, 0, 0), grey);
      w.add(m); w.visible = false; g.add(w); wings.push(w);
    });
    g.add(body, neck);
    SW.enableShadows(g);
    SW.scene.add(g);
    return { g, neck, head, legs, wings, spot: 0, state: 'stand', strikeIn: rand(6, 14), strike: 0, fly: null, heading: 0 };
  })();
  function placeHeron(i) {
    heron.spot = i;
    const p = heronSpots[i];
    heron.g.position.set(p.x, Math.max(height(p.x, p.z), -0.3), p.z);
    heron.heading = Math.atan2(SW.LAKE.x - p.x, SW.LAKE.z - p.z) + rand(-0.6, 0.6);
    heron.g.rotation.set(0, heron.heading, 0);
  }
  placeHeron(1);
  function updateHeron(dt, t) {
    const h = heron;
    if (h.state === 'stand') {
      const pos = h.g.position;
      const dPlayer = Math.hypot(player.x - pos.x, player.z - pos.z);
      const dBoat = Math.hypot(SW.boat.position.x - pos.x, SW.boat.position.z - pos.z);
      if (dPlayer < 7 || dBoat < 7) {
        let best = 0, bd = -1;
        heronSpots.forEach((p, i) => { const d = Math.hypot(p.x - player.x, p.z - player.z); if (i !== h.spot && d > bd) { bd = d; best = i; } });
        const to = heronSpots[best];
        h.fly = { from: pos.clone(), to: new THREE.Vector3(to.x, Math.max(height(to.x, to.z), -0.3), to.z), t: 0, dur: 7, idx: best };
        h.state = 'fly';
        h.heading = Math.atan2(to.x - pos.x, to.z - pos.z);
        kraak(pos.x, pos.z);
      }
      h.strikeIn -= dt;
      if (h.strikeIn <= 0) { h.strike = 0.7; h.strikeIn = rand(8, 20); }
      if (h.strike > 0) {
        h.strike -= dt;
        const e = Math.sin((1 - h.strike / 0.7) * Math.PI);
        h.neck.rotation.x = 0.25 + e * 1.3;
        if (h.strike <= 0.35 && h.strike + dt > 0.35) {
          const bx = pos.x + Math.sin(h.heading) * 0.55, bz = pos.z + Math.cos(h.heading) * 0.55;
          SW.spawnRipple(bx, bz, 0.5); plop(bx, bz, 0.6);
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
  }

  // ── Fish jumping at dusk and dawn ─────────────────────────────
  const jumpers = [0, 1].map(() => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), std('#b9c4cc', { metalness: 0.3, roughness: 0.4 }));
    b.scale.set(0.035, 0.06, 0.14);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 3).rotateX(-Math.PI / 2), std('#9aa6ae'));
    tail.position.z = -0.15;
    g.add(b, tail); g.visible = false; SW.scene.add(g);
    return { g, t: 1, from: new THREE.Vector3(), dir: 0 };
  });
  let jumpIn = 5;
  function updateJumps(dt) {
    const h = SW.timeCtl.hour;
    const active = !frozen() && (SW.cur.eve > 0.25 || (h > 5.3 && h < 8));
    jumpIn -= dt;
    if (active && jumpIn <= 0) {
      jumpIn = rand(4, 10);
      const j = jumpers.find((q) => q.t >= 1);
      for (let i = 0; j && i < 10; i++) {
        const p = lakePoint(Math.random() * TAU, rand(0.25, 0.85));
        if (Math.hypot(p.x - player.x, p.z - player.z) > 40) continue;
        j.from.set(p.x, 0, p.z); j.dir = Math.random() * TAU; j.t = 0; j.g.visible = true;
        SW.spawnRipple(p.x, p.z, 0.6); plop(p.x, p.z, 0.7);
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
      if (k >= 1) { j.g.visible = false; SW.spawnRipple(x, z, 0.6); plop(x, z, 0.8); }
    }
  }

  // ── Owl at night ──────────────────────────────────────────────
  const eyeMat = new THREE.SpriteMaterial({ map: SW.glowTex, color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const eyes = [0, 1].map(() => { const s = new THREE.Sprite(eyeMat); s.scale.set(0.16, 0.16, 1); s.visible = false; SW.scene.add(s); return s; });
  let hootIn = 12, eyesT = 0;
  function updateOwl(dt) {
    const night = SW.cur.stars > 0.5 && SW.wx.rain < 0.3;
    hootIn -= dt;
    if (night && hootIn <= 0) {
      hootIn = rand(18, 45);
      const trees = SW.treeSpots.filter((tr) => { const d = Math.hypot(tr.x - player.x, tr.z - player.z); return d > 12 && d < 45; });
      if (trees.length) {
        const tr = trees[Math.floor(Math.random() * trees.length)];
        hoot(tr.x, tr.z);
        // two glowing eyes peeking out of the foliage on the side facing you
        const dl = Math.hypot(player.x - tr.x, player.z - tr.z), tx = (player.x - tr.x) / dl, tz = (player.z - tr.z) / dl;
        const cx = tr.x + tx * 1.0 * tr.s, cz = tr.z + tz * 1.0 * tr.s, y = tr.y + 3.2 * tr.s;
        eyes[0].position.set(cx - tz * 0.07, y, cz + tx * 0.07);
        eyes[1].position.set(cx + tz * 0.07, y, cz - tx * 0.07);
        eyesT = 7;
      }
    }
    eyesT = Math.max(0, eyesT - dt);
    const blink = Math.sin(SW.elapsed * 0.9) > -0.95 ? 1 : 0;
    eyeMat.opacity = smooth(0, 1, eyesT) * smooth(7, 6, eyesT) * 0.9 * blink;
    eyes.forEach((e) => { e.visible = eyesT > 0; });
  }

  // ── Frogs on the lily pads ────────────────────────────────────
  const pads = (SW.world.padItems || []).slice();
  const frogs = [];
  for (let i = 0; i < Math.min(6, pads.length); i++) {
    const pad = pads.splice(Math.floor(Math.random() * pads.length), 1)[0];
    const g = new THREE.Group();
    const green = std('#5f8f3a');
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), green);
    body.scale.set(0.07, 0.045, 0.085); body.position.y = 0.04;
    const throat = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), std('#d9d08a'));
    throat.scale.set(0.035, 0.03, 0.03); throat.position.set(0, 0.025, 0.06);
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), green); e.position.set(s * 0.035, 0.08, 0.04); g.add(e); });
    g.add(body, throat);
    g.position.set(pad.x + rand(-0.15, 0.15), 0.06, pad.z + rand(-0.15, 0.15));
    g.rotation.y = Math.random() * TAU;
    SW.scene.add(g);
    frogs.push({ g, throat, puff: 0 });
  }
  let croakIn = 3;
  function updateFrogs(dt) {
    const show = SW.seasonState.bugs > 0.5 && SW.seasonState.ice < 0.3;
    frogs.forEach((f) => { f.g.visible = show; });
    if (!show) return;
    croakIn -= dt;
    if ((SW.wx.wet > 0.25 || SW.cur.eve > 0.4) && croakIn <= 0) {
      croakIn = rand(2, 7);
      const near = frogs.filter((f) => Math.hypot(f.g.position.x - player.x, f.g.position.z - player.z) < 35);
      if (near.length) { const f = near[Math.floor(Math.random() * near.length)]; f.puff = 0.45; croak(f.g.position.x, f.g.position.z); }
    }
    for (const f of frogs) {
      f.puff = Math.max(0, f.puff - dt);
      const s = 1 + Math.sin((f.puff / 0.45) * Math.PI) * 1.4;
      f.throat.scale.set(0.035 * s, 0.03 * s, 0.03 * s);
    }
  }

  // ── Deer at the forest edge ───────────────────────────────────
  const deerSpots = [];
  for (let i = 0; i < 60 && deerSpots.length < 8; i++) {
    const a = Math.random() * TAU, r = rand(72, 98), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (SW.walkable(x, z) && height(x, z) < 14 && lakeT(x, z) > 1.5) deerSpots.push({ x, z });
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
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.32).translate(0, 0, 0.08), coat);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), dark); nose.position.set(0, -0.02, 0.25);
    head.add(hd, nose);
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
    SW.enableShadows(g);
    SW.scene.add(g);
    return { g, neck, legs, state: 'graze', x: 0, z: 0, heading: 0, t: 0, away: 0, phase: 0, look: 0 };
  })();
  function placeDeer() {
    if (!deerSpots.length) { deer.g.visible = false; return; }
    let best = deerSpots[0], bd = -1;
    for (const s of deerSpots) { const d = Math.hypot(s.x - player.x, s.z - player.z); if (d > bd && Math.random() < 0.7) { bd = d; best = s; } }
    deer.x = best.x; deer.z = best.z; deer.heading = Math.random() * TAU; deer.state = 'graze'; deer.g.visible = true;
  }
  placeDeer();
  function updateDeer(dt, t) {
    const d = deer;
    if (d.state === 'gone') { d.away -= dt; if (d.away <= 0) placeDeer(); return; }
    const dp = Math.hypot(player.x - d.x, player.z - d.z);
    if (d.state === 'graze') {
      if (dp < 16) { d.state = 'flee'; d.t = 4; d.heading = Math.atan2(d.x - player.x, d.z - player.z); snort(d.x, d.z); }
      d.t += dt;
      const graze = Math.sin(d.t * 0.35) > -0.3 ? 1 : 0;
      d.look = damp(d.look, graze, 2, dt);
      d.neck.rotation.x = lerp(-0.2, 1.25, d.look);
      d.legs.forEach((l) => { l.rotation.x = 0; });
      d.g.position.set(d.x, height(d.x, d.z), d.z);
    } else {
      d.t -= dt;
      const sp = 7;
      let nx = d.x + Math.sin(d.heading) * sp * dt, nz = d.z + Math.cos(d.heading) * sp * dt;
      if (!SW.walkable(nx, nz)) { d.heading += 0.8; nx = d.x; nz = d.z; }
      d.x = nx; d.z = nz;
      d.phase += dt * 11;
      const bound = Math.abs(Math.sin(d.phase));
      d.g.position.set(d.x, height(d.x, d.z) + bound * 0.35, d.z);
      d.neck.rotation.x = -0.35;
      d.legs.forEach((l, i) => { l.rotation.x = (i < 2 ? -1 : 1) * Math.sin(d.phase) * 0.7; });
      if (d.t <= 0) { d.state = 'gone'; d.away = 45; d.g.visible = false; }
    }
    d.g.rotation.y = d.heading;
  }

  SW.hooks.frame.push((dt, t) => {
    updateDucks(dt, t);
    updateHeron(dt, t);
    updateJumps(dt);
    updateOwl(dt);
    updateFrogs(dt);
    updateDeer(dt, t);
  });
})();
