// Fishing (R): cast from the jetty, the shore or the moored boat; wait for a bite; R again to hook.
// Different fish bite at different times, weathers and seasons. Every catch goes in the journal (J).
// In winter you walk onto the ice and fish through a hole. A cat usually comes to keep you company.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, clamp, lerp, damp, rnd } from '../core/math.js';
import { lakeT, onIce, waterAhead, animalWalkable } from '../core/shape.js';
import { std } from '../core/materials.js';
import { clock } from '../core/clock.js';
import { hooks, seasonState } from '../core/state.js';
import { player, hero } from '../characters/player.js';
import { animals } from '../characters/animals.js';
import { boatSeat, ferry } from '../characters/boat.js';
import { activity } from '../systems/activity.js';
import { registerAction, bindKey, moving } from '../systems/actions.js';
import { camForward } from '../systems/input.js';
import { store, saveSoon } from '../systems/save.js';
import { timeCtl } from '../systems/time.js';
import { wx } from '../systems/weather.js';
import { spawnRipple, spawnHeart } from '../world/effects.js';
import { toast, togglePanel, onPanel } from '../ui/hud.js';
import { plop, meow } from './voices.js';
import { hasRod } from './rod.js';

const hour = () => timeCtl.hour;
const isDawn = () => hour() > 4.8 && hour() < 8.5;
const isDusk = () => hour() > 17 && hour() < 20.5;
const isNight = () => hour() >= 20.5 || hour() < 4.8;
const isDay = () => hour() >= 8.5 && hour() < 17;
const rainy = () => wx.rain > 0.3;
const icy = () => seasonState.ice > 0.85;
export const SPECIES = [
  { id: 'bluegill', name: 'Bluegill', color: '#5f8fa8', len: [12, 22], hint: 'Sunny days', w: () => (isDay() ? 3 : 0.4) },
  { id: 'perch', name: 'Yellow Perch', color: '#a9b04a', len: [15, 32], hint: 'Mornings', w: () => (isDawn() || hour() < 12 ? 3 : 1) },
  { id: 'carp', name: 'Common Carp', color: '#a8874a', len: [30, 72], hint: 'Warm afternoons', w: () => (hour() > 13 && hour() < 19 ? 2.5 : 0.6) },
  { id: 'trout', name: 'Rainbow Trout', color: '#7d9a8a', len: [25, 52], hint: 'Dawn and rainy days', w: () => (isDawn() ? 2.5 : 0) + (rainy() ? 2.5 : 0) + 0.3 },
  { id: 'catfish', name: 'Catfish', color: '#4f4c42', len: [30, 85], hint: 'Night', w: () => (isNight() ? 3.5 : 0.2) },
  { id: 'pike', name: 'Northern Pike', color: '#5d7a3a', len: [40, 95], hint: 'Storms and autumn', w: () => (wx.storm > 0.3 ? 3 : 0) + (seasonState.name === 'Autumn' ? 1.2 : 0.2) },
  { id: 'minnow', name: 'Silver Minnow', color: '#c8d0d6', len: [5, 10], hint: 'Any time', w: () => 1.5 },
  { id: 'koi', name: 'Golden Koi', color: '#f2a03a', len: [30, 62], hint: 'Rare, at dusk', w: () => (isDusk() ? 0.35 : 0.04) },
  { id: 'burbot', name: 'Burbot', color: '#6a5a3a', len: [30, 60], hint: 'Through the winter ice', w: () => (icy() ? 4 : 0) },
];
function pickSpecies() {
  const ws = SPECIES.map((s) => Math.max(0, s.w()) * (icy() && s.id !== 'burbot' ? 0.4 : 1));
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < SPECIES.length; i++) { r -= ws[i]; if (r <= 0) return SPECIES[i]; }
  return SPECIES[6];
}

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

const F = { state: 'idle', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), biteIn: 0, nibble: 0, fish: null, sp: null, cm: 0, buddy: null, iceHole: false, quietT: 0 };
export const fishingState = () => F.state;

export function initFishing() {
  const journal = store.journal;
  const rod = new THREE.Group();
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.02, 1.9, 5).translate(0, 0.95, 0), std('#6b4a2e'));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 6).translate(0, 0.08, 0), std('#c9a46a'));
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8).rotateZ(Math.PI / 2), std('#3a3a3a'));
    reel.position.set(0, 0.25, 0.05);
    rod.add(pole, grip, reel);
    rod.position.set(0, -0.62, 0.03);
    rod.visible = false;
    hero.arms[1].add(rod);
  }
  const tip = new THREE.Vector3(), tipLocal = new THREE.Vector3(0, 1.9, 0);
  const bobber = new THREE.Group();
  bobber.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, 0, Math.PI / 2), std('#e04a3a')), new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, Math.PI / 2, Math.PI / 2), std('#f4f1ea')));
  bobber.visible = false;
  scene.add(bobber);
  const hole = new THREE.Group();
  hole.add(new THREE.Mesh(new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b2c36' })), new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 4, 14).rotateX(Math.PI / 2), std('#e9eef3')));
  hole.visible = false;
  scene.add(hole);
  const LINE_PTS = 14;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.6 }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  const bob = new THREE.Vector3();
  const castSpot = () => {
    if (icy()) {
      if (!onIce(player.x, player.z)) return null;
      const f = camForward(), x = player.x + f.x * 1.4, z = player.z + f.z * 1.4;
      return lakeT(x, z) < 0.97 ? { x, z, ice: true } : null;
    }
    const p = waterAhead(player, camForward(), [5.5, 4.5, 6.5, 8, 3.5]);
    return p ? { x: p.x, z: p.z, ice: false } : null;
  };
  const canFish = () => activity.free || (activity.is('sit') && player.seat === boatSeat && ferry.state === 'docked');
  const biteDelay = () => {
    let d = rnd(5, 14);
    if (isDawn() || isDusk()) d *= 0.6;
    if (rainy()) d *= 0.75;
    if (wx.storm > 0.3) d *= 1.25;
    return d;
  };
  const callBuddy = () => {
    if (F.buddy && F.buddy.goal) return;
    let best = null, bd = 40;
    for (const a of animals) {
      if (a.kind !== 'cat' || a.goal || a.petted || a.state === 'shelter') continue;
      const d = Math.hypot(a.x - player.x, a.z - player.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) return;
    const f = camForward();
    for (const side of [1, -1]) {
      const x = player.x - f.z * side * 1.1 - f.x * 0.3, z = player.z + f.x * side * 1.1 - f.z * 0.3;
      if (animalWalkable(x, z)) { best.goal = { x, z, faceX: F.to.x, faceZ: F.to.z, src: 'fish' }; F.buddy = best; return; }
    }
  };
  const releaseBuddy = () => {
    if (F.buddy && F.buddy.goal && F.buddy.goal.src === 'fish') F.buddy.goal = null;
    F.buddy = null;
  };
  const startCast = () => {
    const spot = canFish() ? castSpot() : null;
    if (!spot) { toast(icy() ? 'The lake is frozen. Walk out onto the ice to fish through a hole.' : 'Face the lake from the jetty or the shore to cast.'); return; }
    if (!activity.enter('fish')) return;
    F.iceHole = spot.ice;
    F.to.set(spot.x, 0.05, spot.z);
    if (!player.seat) { const f = camForward(); player.rot = Math.atan2(f.x, f.z); }
    F.state = 'cast'; F.t = 0;
    rod.visible = true;
    if (spot.ice) { hole.position.set(spot.x, 0.05, spot.z); hole.visible = true; }
    callBuddy();
  };
  const stop = (msg) => {
    F.state = 'idle';
    activity.leave('fish');
    rod.visible = false; bobber.visible = false; line.visible = false; hole.visible = false;
    if (F.fish) { scene.remove(F.fish); F.fish = null; }
    if (msg) toast(msg);
    F.quietT = 0;
  };
  const hook = () => {
    F.sp = pickSpecies();
    const [a, b] = F.sp.len;
    F.cm = Math.round(a + Math.pow(rnd(), 1.6) * (b - a));
    F.fish = makeFish(F.sp, F.cm);
    F.fish.position.copy(bob);
    scene.add(F.fish);
    F.state = 'reel'; F.t = 0;
    spawnRipple(bob.x, bob.z, 0.9);
    plop(bob.x, bob.z, 1.2);
  };

  registerAction({ id: 'fish-hook', key: 'KeyR', keyLabel: 'R', score: () => 1000, urgent: () => true, available: () => F.state === 'bite', label: () => 'Hook it!', run: hook });
  registerAction({ id: 'fish-reel', key: 'KeyR', keyLabel: 'R', score: () => 900, available: () => F.state === 'wait', label: () => 'Reel in', run: () => stop('You reel in your line.') });
  let spotCache = null;
  registerAction({ // at the water without a rod: say where to get one
    id: 'fish-norod', key: 'KeyR', keyLabel: 'R', score: () => -1,
    available: () => !hasRod() && F.state === 'idle' && canFish() && !moving() && spotCache,
    disabled: () => true,
    label: () => 'No rod yet: the skipper has one',
    run: () => {},
  });
  registerAction({
    id: 'fish-cast', key: 'KeyR', keyLabel: 'R', score: () => 0,
    available: () => hasRod() && F.state === 'idle' && canFish() && !moving() && spotCache,
    label: () => (icy() ? 'Fish through the ice' : 'Cast a line'),
    run: startCast,
  });

  // journal
  const listEl = document.getElementById('journalList'), sumEl = document.getElementById('journalSummary');
  const renderJournal = () => {
    const caught = SPECIES.filter((s) => journal[s.id]);
    sumEl.textContent = `${caught.length} of ${SPECIES.length} species`;
    listEl.replaceChildren(...SPECIES.map((s) => {
      const j = journal[s.id];
      const li = document.createElement('li');
      li.className = j ? 'got' : '';
      const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = j ? s.color : 'transparent';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = j ? s.name : 'Not yet caught';
      const st = document.createElement('span'); st.className = 'st'; st.textContent = j ? `${j.n} caught · best ${j.best} cm` : s.hint;
      li.append(sw, nm, st);
      return li;
    }));
  };
  onPanel('journal', (open) => { if (open) renderJournal(); });
  bindKey('KeyJ', () => togglePanel('journal'));

  const tmp = new THREE.Vector3();
  let spotIn = 0;
  hooks.frame.push((dt, t) => {
    spotIn -= dt;
    if (spotIn <= 0) { spotCache = F.state === 'idle' && canFish() ? castSpot() : null; spotIn = 0.25; }
    const busy = F.state !== 'idle' && F.state !== 'show' && F.state !== 'release';
    if (busy && moving() && !player.seat) stop('You reel in your line.');
    if (F.state !== 'idle' && player.seat && player.seat !== boatSeat) stop();
    if (F.state !== 'idle' && player.seat === boatSeat && ferry.state !== 'docked') stop('You reel in as the boat sets off.');
    if (F.state !== 'idle' && F.iceHole && !icy()) stop('The ice is thawing. You pull your line out of the hole.');
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
          F.state = 'wait'; F.biteIn = biteDelay(); F.nibble = rnd(1.5, 3);
          spawnRipple(F.to.x, F.to.z, 0.7);
          plop(F.to.x, F.to.z, 0.9);
        }
      }
    } else if (F.state === 'wait') {
      F.biteIn -= dt; F.nibble -= dt;
      let dip = 0;
      if (F.nibble < 0) { dip = Math.sin(-F.nibble * 20) * 0.025; if (F.nibble < -0.3) F.nibble = rnd(1.5, 4); }
      bob.set(F.to.x, 0.05 + Math.sin(t * 2.2) * 0.012 - Math.abs(dip), F.to.z);
      if (F.biteIn <= 0) { F.state = 'bite'; F.t = 1.3; spawnRipple(F.to.x, F.to.z, 0.8); plop(F.to.x, F.to.z, 1); }
    } else if (F.state === 'bite') {
      F.t -= dt;
      bob.set(F.to.x + Math.sin(t * 30) * 0.03, 0.05 - 0.07 - Math.abs(Math.sin(t * 14)) * 0.05, F.to.z);
      if (F.t <= 0) { toast('It got away. Wait for the next bite.'); F.state = 'wait'; F.biteIn = biteDelay(); }
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
        journal[F.sp.id] = { n: (j ? j.n : 0) + 1, best: Math.max(j ? j.best : 0, F.cm) };
        saveSoon();
        const record = j && F.cm > j.best;
        toast(`${!j ? 'New species! ' : record ? 'New record! ' : ''}You caught a ${F.sp.name} · ${F.cm} cm`, 4);
        if (F.buddy) {
          for (let i = 0; i < 3; i++) setTimeout(() => { if (F.buddy) spawnHeart(F.buddy); }, i * 300);
          meow(F.buddy.x, F.buddy.z, 1.1);
        }
        if (!document.getElementById('journal').hidden) renderJournal();
      }
    } else if (F.state === 'show') {
      F.t -= dt;
      hero.arms[1].updateMatrixWorld(true);
      tmp.set(0, -0.72, 0.12); hero.arms[1].localToWorld(tmp);
      F.fish.position.copy(tmp);
      F.fish.rotation.set(Math.sin(t * 9) * 0.25, player.rot + Math.PI / 2, 0);
      if (F.t <= 0) { F.state = 'release'; F.t = 0; F.from.copy(F.fish.position); }
    } else if (F.state === 'release') {
      F.t += dt / 0.8; // catch and release: the fish leaps back into the lake
      const k = clamp(F.t, 0, 1);
      F.fish.position.lerpVectors(F.from, F.to, k);
      F.fish.position.y = lerp(F.from.y, 0, k) + Math.sin(k * Math.PI) * 0.8;
      F.fish.rotation.x = -Math.cos(k * Math.PI) * 1.2;
      if (k >= 1) { spawnRipple(F.to.x, F.to.z, 0.9); plop(F.to.x, F.to.z, 1); stop(); }
    }

    if (bobber.visible) bobber.position.copy(bob);
    if (line.visible) {
      const arr = lineGeo.attributes.position.array, sag = F.state === 'wait' ? 0.35 : 0.08;
      for (let i = 0; i < LINE_PTS; i++) {
        const s = i / (LINE_PTS - 1);
        arr[i * 3] = lerp(tip.x, bob.x, s);
        arr[i * 3 + 1] = lerp(tip.y, bob.y + 0.05, s) - Math.sin(s * Math.PI) * sag;
        arr[i * 3 + 2] = lerp(tip.z, bob.z, s);
      }
      lineGeo.attributes.position.needsUpdate = true;
    }
    if (F.state === 'idle' && F.buddy) {
      F.quietT += dt;
      const g = F.buddy.goal;
      if (F.quietT > 15 || (g && Math.hypot(g.x - player.x, g.z - player.z) > 4)) releaseBuddy();
    }
  });

  // arm and rod: rodWorld is the rod's angle from straight up toward the front
  let armX = -0.85, rodWorld = 1.0;
  hooks.pose.push((dt) => {
    if (F.state === 'idle') return;
    let wantArm = -0.85, wantRod = 1.0;
    if (F.state === 'cast') { const k = clamp(F.t / 0.45, 0, 1), e = k * k * (3 - 2 * k); wantArm = lerp(-2.5, -0.85, e); wantRod = lerp(-0.5, 1.0, e); }
    else if (F.state === 'bite') { wantArm = -0.95; wantRod = 0.8; }
    else if (F.state === 'reel') { wantArm = -1.3 + Math.sin(clock.elapsed * 14) * 0.08; wantRod = 0.45; }
    else if (F.state === 'show' || F.state === 'release') { wantArm = -0.7; wantRod = 0.3; }
    else wantArm += Math.sin(clock.elapsed * 1.3) * 0.03;
    armX = F.state === 'cast' ? wantArm : damp(armX, wantArm, 10, dt);
    rodWorld = F.state === 'cast' ? wantRod : damp(rodWorld, wantRod, 8, dt);
    hero.arms[1].rotation.x = armX;
    hero.arms[1].rotation.z = 0;
    if (player.umbAmt < 0.05) { hero.arms[0].rotation.x = armX * 0.75; hero.arms[0].rotation.z = 0.28; }
    rod.rotation.x = rodWorld - hero.body.rotation.x - armX;
  });
}
