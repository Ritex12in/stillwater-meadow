/* Fishing: cast from the jetty, the shore or the moored boat (R). Wait for a bite, press R to hook it.
   Different fish bite at different times, weathers and seasons; every catch goes in the journal (J).
   Winter: walk onto the ice and fish through a hole. A cat usually comes to keep you company. */
(() => {
  'use strict';
  const SW = window.SW;
  if (!SW) return;
  const { THREE, rand, clamp, lerp, damp, TAU, player, std, lakeT, height } = SW;

  // ── species ───────────────────────────────────────────────────
  const hour = () => SW.timeCtl.hour;
  const isDawn = () => hour() > 4.8 && hour() < 8.5;
  const isDusk = () => hour() > 17 && hour() < 20.5;
  const isNight = () => hour() >= 20.5 || hour() < 4.8;
  const isDay = () => hour() >= 8.5 && hour() < 17;
  const rainy = () => SW.wx.rain > 0.3;
  const icy = () => SW.seasonState.ice > 0.85;
  const SPECIES = [
    { id: 'bluegill', name: 'Bluegill', color: '#5f8fa8', len: [12, 22], hint: 'Sunny days', w: () => (isDay() ? 3 : 0.4) },
    { id: 'perch', name: 'Yellow Perch', color: '#a9b04a', len: [15, 32], hint: 'Mornings', w: () => (isDawn() || hour() < 12 ? 3 : 1) },
    { id: 'carp', name: 'Common Carp', color: '#a8874a', len: [30, 72], hint: 'Warm afternoons', w: () => (hour() > 13 && hour() < 19 ? 2.5 : 0.6) },
    { id: 'trout', name: 'Rainbow Trout', color: '#7d9a8a', len: [25, 52], hint: 'Dawn and rainy days', w: () => (isDawn() ? 2.5 : 0) + (rainy() ? 2.5 : 0) + 0.3 },
    { id: 'catfish', name: 'Catfish', color: '#4f4c42', len: [30, 85], hint: 'Night', w: () => (isNight() ? 3.5 : 0.2) },
    { id: 'pike', name: 'Northern Pike', color: '#5d7a3a', len: [40, 95], hint: 'Storms and autumn', w: () => (SW.wx.storm > 0.3 ? 3 : 0) + (SW.seasonState.name === 'Autumn' ? 1.2 : 0.2) },
    { id: 'minnow', name: 'Silver Minnow', color: '#c8d0d6', len: [5, 10], hint: 'Any time', w: () => 1.5 },
    { id: 'koi', name: 'Golden Koi', color: '#f2a03a', len: [30, 62], hint: 'Rare, at dusk', w: () => (isDusk() ? 0.35 : 0.04) },
    { id: 'burbot', name: 'Burbot', color: '#6a5a3a', len: [30, 60], hint: 'Through the winter ice', w: () => (icy() ? 4 : 0) },
  ];
  function pickSpecies() {
    const ws = SPECIES.map((s) => Math.max(0, s.w()) * (icy() && s.id !== 'burbot' ? 0.4 : 1));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < SPECIES.length; i++) { r -= ws[i]; if (r <= 0) return SPECIES[i]; }
    return SPECIES[6];
  }
  const journal = SW.store.journal || (SW.store.journal = {});

  // ── gear ──────────────────────────────────────────────────────
  const rod = new THREE.Group();
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.02, 1.9, 5).translate(0, 0.95, 0), std('#6b4a2e'));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 6).translate(0, 0.08, 0), std('#c9a46a'));
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8).rotateZ(Math.PI / 2), std('#3a3a3a'));
    reel.position.set(0, 0.25, 0.05);
    rod.add(pole, grip, reel);
    rod.position.set(0, -0.62, 0.03);
    rod.visible = false;
    SW.hero.arms[1].add(rod);
  }
  const tip = new THREE.Vector3(), tipLocal = new THREE.Vector3(0, 1.9, 0);
  const bobber = new THREE.Group();
  {
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, 0, Math.PI / 2), std('#e04a3a'));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, Math.PI / 2, Math.PI / 2), std('#f4f1ea'));
    bobber.add(top, bot);
    bobber.visible = false;
    SW.scene.add(bobber);
  }
  const hole = new THREE.Group();
  {
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b2c36' }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 4, 14).rotateX(Math.PI / 2), std('#e9eef3'));
    hole.add(water, rim);
    hole.visible = false;
    SW.scene.add(hole);
  }
  const LINE_PTS = 14;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.6 }));
  line.frustumCulled = false;
  line.visible = false;
  SW.scene.add(line);

  function makeFish(sp, cm) {
    const L = cm / 100;
    const g = new THREE.Group();
    const mat = std(sp.color, sp.id === 'koi' ? { emissive: '#7a3c00', emissiveIntensity: 0.4 } : { metalness: 0.2, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat);
    body.scale.set(L * 0.09, L * 0.17, L * 0.5);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(L * 0.14, L * 0.22, 4).rotateX(Math.PI / 2), mat);
    tail.position.z = -L * 0.55;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(L * 0.06, L * 0.18, 3), mat);
    fin.position.set(0, L * 0.17, -L * 0.05); fin.rotation.x = -0.6;
    g.add(body, tail, fin);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ── state ─────────────────────────────────────────────────────
  const F = { state: 'idle', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), biteIn: 0, nibble: 0, fish: null, sp: null, cm: 0, buddy: null, iceHole: false, quietT: 0 };
  const bob = new THREE.Vector3();
  function castSpot() {
    if (icy()) {
      if (!SW.onIce(player.x, player.z)) return null;
      const f = SW.camForward();
      const x = player.x + f.x * 1.4, z = player.z + f.z * 1.4;
      return lakeT(x, z) < 0.97 ? { x, z, ice: true } : null;
    }
    const p = SW.waterAhead([5.5, 4.5, 6.5, 8, 3.5]);
    return p ? { x: p.x, z: p.z, ice: false } : null;
  }
  const canFish = () => (!player.seat || (player.seat === SW.boatSeat && SW.ferry.state === 'docked')) && !player.petting && !player.lie;
  function biteDelay() {
    let d = rand(5, 14);
    if (isDawn() || isDusk()) d *= 0.6;
    if (rainy()) d *= 0.75;
    if (SW.wx.storm > 0.3) d *= 1.25;
    return d;
  }
  function startCast() {
    const spot = canFish() ? castSpot() : null;
    if (!spot) {
      SW.toast(icy() ? 'The lake is frozen. Walk out onto the ice to fish through a hole.' : 'Face the lake from the jetty or the shore to cast.');
      return;
    }
    F.iceHole = spot.ice;
    F.to.set(spot.x, 0.05, spot.z);
    if (!player.seat) { const f = SW.camForward(); player.rot = Math.atan2(f.x, f.z); }
    F.state = 'cast'; F.t = 0;
    player.fishing = true;
    rod.visible = true;
    if (spot.ice) { hole.position.set(spot.x, 0.05, spot.z); hole.visible = true; }
    callBuddy();
  }
  function stop(msg) {
    F.state = 'idle';
    player.fishing = false;
    rod.visible = false; bobber.visible = false; line.visible = false; hole.visible = false;
    if (F.fish) { SW.scene.remove(F.fish); F.fish = null; }
    if (msg) SW.toast(msg);
    F.quietT = 0;
  }
  function press() {
    if (F.state === 'idle') startCast();
    else if (F.state === 'wait') stop('You reel in your line.');
    else if (F.state === 'bite') hook();
  }
  function hook() {
    F.sp = pickSpecies();
    const [a, b] = F.sp.len;
    F.cm = Math.round(a + Math.pow(Math.random(), 1.6) * (b - a));
    F.fish = makeFish(F.sp, F.cm);
    F.fish.position.copy(bob);
    SW.scene.add(F.fish);
    F.state = 'reel'; F.t = 0;
    SW.spawnRipple(bob.x, bob.z, 0.9);
    if (SW.sfx) SW.sfx.plop(bob.x, bob.z, 1.2);
  }
  const prompt = SW.addPrompt('R', press);
  SW.onKey('KeyR', press);

  // a cat wanders over and sits beside you while you fish
  function callBuddy() {
    if (F.buddy && F.buddy.goal) return;
    let best = null, bd = 40;
    for (const a of SW.animals) {
      if (a.kind !== 'cat' || a.goal || a.petted || a.state === 'shelter') continue;
      const d = Math.hypot(a.x - player.x, a.z - player.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) return;
    const f = SW.camForward();
    for (const side of [1, -1]) {
      const x = player.x - f.z * side * 1.1 - f.x * 0.3, z = player.z + f.x * side * 1.1 - f.z * 0.3;
      if (SW.animalWalkable(x, z)) { best.goal = { x, z, faceX: F.to.x, faceZ: F.to.z, src: 'fish' }; F.buddy = best; return; }
    }
  }
  function releaseBuddy() {
    if (F.buddy && F.buddy.goal && F.buddy.goal.src === 'fish') F.buddy.goal = null;
    F.buddy = null;
  }

  // ── journal (J) ───────────────────────────────────────────────
  const journalEl = document.getElementById('journal');
  const listEl = document.getElementById('journalList');
  const sumEl = document.getElementById('journalSummary');
  function renderJournal() {
    const caught = SPECIES.filter((s) => journal[s.id]);
    sumEl.textContent = `${caught.length} of ${SPECIES.length} species`;
    listEl.innerHTML = '';
    for (const s of SPECIES) {
      const j = journal[s.id];
      const li = document.createElement('li');
      li.className = j ? 'got' : '';
      li.innerHTML = `<span class="sw" style="background:${j ? s.color : 'transparent'}"></span><span class="nm">${j ? s.name : 'Not yet caught'}</span><span class="st">${j ? `${j.n} caught · best ${j.best} cm` : s.hint}</span>`;
      listEl.appendChild(li);
    }
  }
  const toggleJournal = (force) => {
    journalEl.hidden = typeof force === 'boolean' ? !force : !journalEl.hidden;
    if (!journalEl.hidden) renderJournal();
  };
  document.getElementById('journalClose').addEventListener('click', () => toggleJournal(false));
  SW.onKey('KeyJ', () => toggleJournal());

  // ── update ────────────────────────────────────────────────────
  const tmp = new THREE.Vector3();
  let promptIn = 0;
  SW.hooks.frame.push((dt, t) => {
    if (F.state !== 'idle' && F.state !== 'show' && F.state !== 'release' && (SW.moving() && !player.seat)) stop('You reel in your line.');
    if (player.seat && player.seat !== SW.boatSeat && F.state !== 'idle') stop();
    if (player.seat === SW.boatSeat && SW.ferry.state !== 'docked' && F.state !== 'idle') stop('You reel in as the boat sets off.');
    rod.updateMatrixWorld(true);
    tip.copy(tipLocal); rod.localToWorld(tip);

    if (F.state === 'cast') {
      F.t += dt / 0.8;
      if (F.t > 0.35) {
        if (!bobber.visible) { bobber.visible = true; line.visible = true; F.from.copy(tip); }
        const k = clamp((F.t - 0.35) / 0.65, 0, 1);
        bob.lerpVectors(F.from, F.to, k);
        bob.y = lerp(F.from.y, F.to.y, k) + Math.sin(k * Math.PI) * 1.5;
        if (k >= 1) {
          F.state = 'wait'; F.biteIn = biteDelay(); F.nibble = rand(1.5, 3);
          SW.spawnRipple(F.to.x, F.to.z, 0.7);
          if (SW.sfx) SW.sfx.plop(F.to.x, F.to.z, 0.9);
        }
      }
    } else if (F.state === 'wait') {
      F.biteIn -= dt; F.nibble -= dt;
      let dip = 0;
      if (F.nibble < 0) { dip = Math.sin(-F.nibble * 20) * 0.025; if (F.nibble < -0.3) F.nibble = rand(1.5, 4); }
      bob.set(F.to.x, 0.05 + Math.sin(t * 2.2) * 0.012 - Math.abs(dip), F.to.z);
      if (F.biteIn <= 0) {
        F.state = 'bite'; F.t = 1.3;
        SW.spawnRipple(F.to.x, F.to.z, 0.8);
        if (SW.sfx) SW.sfx.plop(F.to.x, F.to.z, 1);
      }
    } else if (F.state === 'bite') {
      F.t -= dt;
      bob.set(F.to.x + Math.sin(t * 30) * 0.03, 0.05 - 0.07 - Math.abs(Math.sin(t * 14)) * 0.05, F.to.z);
      if (F.t <= 0) {
        SW.toast('It got away. Wait for the next bite.');
        F.state = 'wait'; F.biteIn = biteDelay();
      }
    } else if (F.state === 'reel') {
      F.t += dt / 1.1;
      const k = clamp(F.t, 0, 1);
      bob.lerpVectors(F.to, tip, k);
      bob.y = lerp(0.05, tip.y, k) + Math.sin(k * Math.PI) * 0.6;
      F.fish.position.set(bob.x, bob.y - 0.12, bob.z);
      F.fish.rotation.set(Math.PI / 2 - 0.3, Math.atan2(tip.x - bob.x, tip.z - bob.z), Math.sin(t * 25) * 0.5);
      if (k >= 1) {
        F.state = 'show'; F.t = 2.6;
        bobber.visible = false; line.visible = false;
        const j = journal[F.sp.id];
        const first = !j;
        journal[F.sp.id] = { n: (j ? j.n : 0) + 1, best: Math.max(j ? j.best : 0, F.cm) };
        SW.saveSoon();
        const record = j && F.cm > j.best;
        SW.toast(`${first ? 'New species! ' : record ? 'New record! ' : ''}You caught a ${F.sp.name} · ${F.cm} cm`, 4);
        if (F.buddy) {
          for (let i = 0; i < 3; i++) setTimeout(() => { if (F.buddy) SW.spawnHeart(F.buddy); }, i * 300);
          if (SW.sfx) SW.sfx.meow(F.buddy.x, F.buddy.z, 1.1);
        }
        if (!journalEl.hidden) renderJournal();
      }
    } else if (F.state === 'show') {
      F.t -= dt;
      SW.hero.arms[1].updateMatrixWorld(true);
      tmp.set(0, -0.72, 0.12); SW.hero.arms[1].localToWorld(tmp);
      F.fish.position.copy(tmp);
      F.fish.rotation.set(Math.sin(t * 9) * 0.25, player.rot + Math.PI / 2, 0);
      if (F.t <= 0) { F.state = 'release'; F.t = 0; F.from.copy(F.fish.position); }
    } else if (F.state === 'release') {
      // catch and release: the fish leaps back into the lake
      F.t += dt / 0.8;
      const k = clamp(F.t, 0, 1);
      F.fish.position.lerpVectors(F.from, F.to, k);
      F.fish.position.y = lerp(F.from.y, 0, k) + Math.sin(k * Math.PI) * 0.8;
      F.fish.rotation.x = -Math.cos(k * Math.PI) * 1.2;
      if (k >= 1) {
        SW.spawnRipple(F.to.x, F.to.z, 0.9);
        if (SW.sfx) SW.sfx.plop(F.to.x, F.to.z, 1);
        SW.scene.remove(F.fish); F.fish = null;
        // stay ready for the next cast
        F.state = 'idle'; player.fishing = false; rod.visible = false; hole.visible = false; F.quietT = 0;
      }
    }

    if (bobber.visible) bobber.position.copy(bob);
    if (line.visible) {
      const arr = lineGeo.attributes.position.array;
      const sag = F.state === 'wait' ? 0.35 : 0.08;
      for (let i = 0; i < LINE_PTS; i++) {
        const s = i / (LINE_PTS - 1);
        arr[i * 3] = lerp(tip.x, bob.x, s);
        arr[i * 3 + 1] = lerp(tip.y, bob.y + 0.05, s) - Math.sin(s * Math.PI) * sag;
        arr[i * 3 + 2] = lerp(tip.z, bob.z, s);
      }
      lineGeo.attributes.position.needsUpdate = true;
    }

    // let the cat go back to its day once you've stopped fishing for a while
    if (F.state === 'idle' && F.buddy) {
      F.quietT += dt;
      if (F.quietT > 15 || Math.hypot(F.buddy.goal ? F.buddy.goal.x - player.x : 0, F.buddy.goal ? F.buddy.goal.z - player.z : 0) > 4) releaseBuddy();
    }

    promptIn -= dt;
    if (promptIn <= 0 || F.state === 'bite') {
      promptIn = 0.25;
      if (F.state === 'bite') prompt.set('Hook it!', true);
      else if (F.state === 'wait') prompt.set('Reel in');
      else if (F.state !== 'idle') prompt.set('');
      else prompt.set(canFish() && castSpot() && !SW.moving() ? (F.iceHole || icy() ? 'Fish through the ice' : 'Cast a line') : '');
    }
  });

  // ── arm and rod pose ──────────────────────────────────────────
  // rodWorld is the rod's angle from straight up toward the front (radians)
  let armX = -0.85, rodWorld = 1.0;
  SW.hooks.pose.push((dt) => {
    if (F.state === 'idle') return;
    const hero = SW.hero;
    let wantArm = -0.85, wantRod = 1.0;
    if (F.state === 'cast') {
      const k = clamp(F.t / 0.45, 0, 1), e = k * k * (3 - 2 * k);
      wantArm = lerp(-2.5, -0.85, e); wantRod = lerp(-0.5, 1.0, e);
    } else if (F.state === 'bite') { wantArm = -0.95; wantRod = 0.8; }
    else if (F.state === 'reel') { wantArm = -1.3 + Math.sin(SW.elapsed * 14) * 0.08; wantRod = 0.45; }
    else if (F.state === 'show' || F.state === 'release') { wantArm = -0.7; wantRod = 0.3; }
    else wantArm += Math.sin(SW.elapsed * 1.3) * 0.03;
    armX = F.state === 'cast' ? wantArm : damp(armX, wantArm, 10, dt);
    rodWorld = F.state === 'cast' ? wantRod : damp(rodWorld, wantRod, 8, dt);
    hero.arms[1].rotation.x = armX;
    hero.arms[1].rotation.z = 0;
    if (!SW.player.umbAmt || SW.player.umbAmt < 0.05) { hero.arms[0].rotation.x = armX * 0.75; hero.arms[0].rotation.z = 0.28; }
    rod.rotation.x = rodWorld - hero.body.rotation.x - armX;
  });
})();
