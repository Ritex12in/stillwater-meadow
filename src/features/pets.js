// Taming (T): the cats and dogs aren't yours until they trust you, and trust is earned with fish.
// Every fish adds a fixed amount (more for bigger fish, double for the animal's favourite, which you
// learn the first time you feed it). Nothing here is luck: the same feeding always gives the same
// trust, and trust is never lost. Cats need 8, dogs 5.
//
// Dogs don't run: walk up and feed them by hand, though a dog won't take another for a minute while
// it's chewing (bread works too, worth 1). Cats bolt when you come near, so you throw them a fish
// and keep your distance, standing still, until they dare to eat it; as they trust you more they
// let you closer, and in the end eat from your hand. At full trust the animal is tamed: you name
// it, you can pet it, and it behaves like your pet (follows, joins you at the fire and the lake).
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { clamp, lerp } from '../core/math.js';
import { groundAt, animalWalkable } from '../core/shape.js';
import { std } from '../core/materials.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { animals } from '../characters/animals.js';
import { activity } from '../systems/activity.js';
import { registerAction, moving } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { spawnHeart } from '../world/effects.js';
import { toast, onPanel } from '../ui/hud.js';
import { creel, takeFish, fishValue, speciesName, SPECIES } from './fishing.js';
import { askName } from './names.js';
import { meow, bark } from './voices.js';
import { photoOn } from './photo.js';

export const NEED = { cat: 8, dog: 5 };
const FAVOURITES = ['perch', 'bluegill', 'carp', 'minnow', 'trout', 'bluegill', 'perch']; // by animal, in build order
const HAND = 1.6, THROW = 8, DOG_CHEW = 60, EAT_WAIT = 3, SAFE = 3;

const label = (a) => a.name || `the ${a.desc}`;
const Label = (a) => { const l = label(a); return l[0].toUpperCase() + l.slice(1); };
/** May this animal take food from your hand (rather than a throw)? */
const handFed = (a) => a.kind === 'dog' || a.tamed;

export function initPets() {
  // restore trust, taming and favourites (older saves: a named or bonded animal counts as tamed)
  animals.forEach((a, i) => { a.fav = FAVOURITES[i % FAVOURITES.length]; a.favKnown = false; a.chewT = 0; a.tamedAt = ''; });
  (store.animals || []).forEach((s, i) => {
    const a = animals[i];
    if (!a || !s) return;
    a.trust = s.trust || 0;
    a.favKnown = !!s.favKnown;
    a.tamed = s.tamed !== undefined ? !!s.tamed : !!(s.name || (s.bond || 0) > 0.3);
    a.tamedAt = s.tamedAt || '';
    if (a.tamed) a.trust = Math.max(a.trust, NEED[a.kind]);
  });
  // (saved with the names, in features/names.js)

  // ── fish thrown on the ground for a cat ──
  const food = []; // { a, fish, mesh, x, z, t, wait, eating }
  const drop = (f) => { scene.remove(f.mesh); f.mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); };
  const fishMesh = (id) => {
    const sp = SPECIES.find((s) => s.id === id) || SPECIES[0];
    const g = new THREE.Group(), mat = std(sp.color, { metalness: 0.2, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat); body.scale.set(0.03, 0.05, 0.13);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4).rotateX(Math.PI / 2), mat); tail.position.z = -0.15;
    g.add(body, tail); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    return g;
  };

  const gain = (a, amount, what) => {
    const before = a.trust;
    a.trust = Math.min(NEED[a.kind], a.trust + amount);
    for (let i = 0; i < Math.min(4, amount + 1); i++) setTimeout(() => spawnHeart(a), i * 260);
    if (a.kind === 'cat') meow(a.x, a.z, 1.2); else bark(a.x, a.z, a.scale || 1, 1);
    const fav = !a.favKnown ? ` Its favourite fish, you notice, is the ${speciesName(a.fav)}.` : '';
    a.favKnown = true;
    if (a.trust >= NEED[a.kind] && !a.tamed) {
      a.tamed = true;
      a.tamedAt = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      a.bond = Math.max(a.bond, 0.35);
      toast(`${Label(a)} eats the ${what} and trusts you now. It's yours!${fav}`, 5);
      askName(a);
    } else if (a.tamed) {
      toast(`${Label(a)} happily eats the ${what}.`, 3);
    } else {
      toast(`${Label(a)} eats the ${what}. Trust ${a.trust}/${NEED[a.kind]}.${before === 0 ? ' Keep feeding it.' : ''}${fav}`, 4.5);
    }
    saveSoon(); refreshMarker(a);
  };
  /** Pick the fish to give this animal: its favourite once you know it, otherwise the best you have. */
  const fishFor = (a) => takeFish(a.favKnown ? a.fav : null);
  const worth = (a, f) => fishValue(f) * (f.id === a.fav ? 2 : 1);

  // the animal to feed: someone within reach by hand, else an untamed cat within a throw
  const target = () => {
    let hand = null, hd = HAND, cat = null, cd = THROW;
    for (const a of animals) {
      const d = Math.hypot(a.x - player.x, a.z - player.z);
      if (d < hd && handFed(a)) { hd = d; hand = a; }
      if (!a.tamed && a.kind === 'cat' && !handFed(a) && d < cd && !food.some((f) => f.a === a)) { cd = d; cat = a; }
    }
    return hand ? { a: hand, how: 'hand' } : cat ? { a: cat, how: 'throw' } : null;
  };
  const haveFood = (a) => creel().length > 0 || (a.kind === 'dog' && !a.tamed); // a dog you're winning over takes bread too

  const handFeed = (a) => {
    if (a.kind === 'dog' && a.chewT > 0) { toast(`${Label(a)} is still chewing. Try again in a little while.`); return; }
    const f = fishFor(a);
    if (!f && a.kind === 'cat') return;
    const amount = f ? worth(a, f) : 1, what = f ? speciesName(f.id) : 'bread';
    a.heading = Math.atan2(player.x - a.x, player.z - a.z);
    if (a.kind === 'dog') a.chewT = DOG_CHEW;
    player.pickT = 0.6;
    gain(a, a.tamed ? 0 : amount, what);
  };
  const throwFish = (a) => {
    const f = fishFor(a);
    if (!f) return;
    // it lands a little in front of the cat, on your side
    const ang = Math.atan2(player.x - a.x, player.z - a.z);
    let x = a.x + Math.sin(ang) * 1.2, z = a.z + Math.cos(ang) * 1.2;
    if (!animalWalkable(x, z)) { x = a.x; z = a.z; }
    const mesh = fishMesh(f.id);
    food.push({ a, fish: f, mesh, x, z, from: new THREE.Vector3(player.x, player.y + 1.2, player.z), t: 0, wait: 0, eating: -1, age: 0 });
    player.pickT = 0.5;
    toast(`You toss the ${speciesName(f.id)} near ${label(a)}. Back off and keep still so it dares to eat.`, 4.5);
  };

  registerAction({
    id: 'feed', key: 'KeyT', keyLabel: 'T', score: () => 5,
    available: () => activity.free && target() && haveFood(target().a),
    disabled: () => { const t = target(); return t && t.a.kind === 'dog' && t.a.chewT > 0; },
    label: () => {
      const t = target(), a = t.a, f = creel().length;
      if (a.kind === 'dog' && a.chewT > 0) return `${Label(a)} is still chewing (${Math.ceil(a.chewT)} s)`;
      const what = f ? 'a fish' : 'some bread';
      return t.how === 'throw' ? `Throw ${label(a)} a fish` : `Feed ${label(a)} ${what}`;
    },
    run: () => { const t = target(); if (!t) return; if (t.how === 'hand') handFeed(t.a); else throwFish(t.a); },
  });
  // near an untamed animal with nothing to give: say how
  registerAction({
    id: 'feed-hint', key: 'KeyT', keyLabel: 'T', score: () => -5,
    available: () => activity.free && creel().length === 0 && animals.some((a) => !a.tamed && a.kind === 'cat' && Math.hypot(a.x - player.x, a.z - player.z) < THROW),
    disabled: () => true,
    label: () => 'Cats want fish: catch some first',
    run: () => {},
  });

  // ── trust markers: a paw and a bar over an animal you've started to win over ──
  const markers = new Map();
  const drawMarker = (a) => {
    const c = document.createElement('canvas'); c.width = 192; c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(16, 24, 28, 0.72)';
    g.beginPath(); g.roundRect(0, 4, 192, 40, 20); g.fill();
    g.fillStyle = '#ffcf7a';
    g.beginPath(); g.ellipse(26, 30, 7, 6, 0, 0, Math.PI * 2); g.fill();
    [[16, 19], [23, 15], [31, 15], [38, 19]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 3.2, 4, 0, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = 'rgba(255, 255, 255, 0.18)'; g.beginPath(); g.roundRect(52, 18, 124, 12, 6); g.fill();
    g.fillStyle = '#ffcf7a'; g.beginPath(); g.roundRect(52, 18, Math.max(12, 124 * a.trust / NEED[a.kind]), 12, 6); g.fill();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.scale.set(0.6, 0.15, 1); s.renderOrder = 5;
    return s;
  };
  const refreshMarker = (a) => {
    const old = markers.get(a);
    if (old) { a.head.remove(old); old.material.map.dispose(); old.material.dispose(); markers.delete(a); }
    if (a.tamed || a.trust <= 0) return;
    const s = drawMarker(a);
    s.position.set(0, 0.5 / (a.scale || 1), 0);
    a.head.add(s);
    markers.set(a, s);
  };
  animals.forEach(refreshMarker);

  // ── pets page in the journal ──
  const petList = document.getElementById('petList');
  const renderPets = () => {
    petList.replaceChildren(...animals.map((a) => {
      const li = document.createElement('li');
      li.className = a.tamed ? 'got' : '';
      const sw = document.createElement('span'); sw.className = 'sw'; sw.textContent = a.kind === 'cat' ? '🐈' : '🐕';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.name ? `${a.name}, the ${a.desc}` : `The ${a.desc}`;
      const st = document.createElement('span'); st.className = 'st';
      const fav = a.favKnown ? ` · loves ${speciesName(a.fav)}` : '';
      st.textContent = a.tamed ? `Your pet since ${a.tamedAt || 'long ago'}${fav}` : `Trust ${a.trust}/${NEED[a.kind]}${fav}${a.kind === 'cat' ? ' · keeps its distance' : ''}`;
      li.append(sw, nm, st);
      return li;
    }));
  };
  onPanel('journal', (open) => { if (open) renderPets(); });

  // ── every frame: thrown fish fly, wait, and get eaten (or not) ──
  hooks.frame.push((dt) => {
    for (const a of animals) {
      if (a.chewT > 0) a.chewT -= dt;
      a.beg = a.kind === 'dog' && !a.tamed && !(a.chewT > 0);
    }
    for (let i = food.length - 1; i >= 0; i--) {
      const f = food[i], a = f.a;
      f.age += dt;
      if (f.t < 1) { // in the air
        f.t = Math.min(1, f.t + dt / 0.6);
        const y = lerp(f.from.y, groundAt(f.x, f.z) + 0.04, f.t) + Math.sin(f.t * Math.PI) * 1.2;
        f.mesh.position.set(lerp(f.from.x, f.x, f.t), y, lerp(f.from.z, f.z, f.t));
        f.mesh.rotation.set(f.t * 9, 0, Math.PI / 2);
        continue;
      }
      f.mesh.rotation.set(0, f.age * 0.1, Math.PI / 2);
      const pd = Math.hypot(player.x - f.x, player.z - f.z), still = !moving() && player.move < 0.3;
      // a curious cat (trust 6+) dares to eat sooner and with you closer
      const safe = a.trust >= 6 ? 1.5 : SAFE, waitFor = a.trust >= 6 ? 0.6 : EAT_WAIT;
      if (f.eating >= 0) { // eating: done unless you rush it
        if (pd < safe - 0.8 && player.move > 0.3) { a.goal = null; f.eating = -1; f.wait = 0; continue; }
        f.eating += dt;
        if (f.eating > 1.6) { drop(f); food.splice(i, 1); a.goal = null; gain(a, worth(a, f.fish), speciesName(f.fish.id)); }
        continue;
      }
      if (a.goal && a.goal.src === 'food') { // on its way
        if (pd < safe && !still) { a.goal = null; f.wait = 0; continue; } // you moved in: it thinks better of it
        if (Math.hypot(a.x - f.x, a.z - f.z) < 0.45) { f.eating = 0; a.goal.sit = true; }
        continue;
      }
      // it comes only while you keep your distance and stay still for a few seconds
      const near = Math.hypot(a.x - f.x, a.z - f.z) < 16;
      f.wait = still && pd >= safe && near ? f.wait + dt : 0;
      if (f.wait > waitFor && a.state !== 'shelter') { a.goal = { x: f.x, z: f.z, faceX: f.x, faceZ: f.z + 0.01, src: 'food' }; a.state = 'goal'; }
      if (f.age > 120) { drop(f); food.splice(i, 1); } // left too long: something else gets it
    }
    // markers face you and fade with distance
    markers.forEach((s, a) => {
      const d = Math.hypot(a.x - player.x, a.z - player.z);
      s.visible = d < 12 && !photoOn();
      s.material.opacity = clamp((12 - d) / 3, 0, 1);
    });
  });

}

/** For tests: each animal's taming state. */
export const petsView = () => animals.map((a) => ({ kind: a.kind, desc: a.desc, tamed: a.tamed, trust: a.trust, fav: a.fav, favKnown: a.favKnown, x: a.x, z: a.z, state: a.state, name: a.name }));
