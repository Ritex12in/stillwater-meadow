// The girl: a friend who lives in the meadow.
//   On her own she strolls round the lake, stops to look about, and waves when you come near.
//   C  say hi, then talk: a line in a speech bubble, about the hour, the weather and what you've done.
//   X  walk together: she takes your hand and walks beside you. While you are together she sits by
//      you on the bench (or on the grass beside a chair or log), lies down to watch the stars with
//      you, and stands by while you fish, cheering a catch. X again and she goes her own way.
//   G  with a bouquet in hand: give it to her. She wears one of the flowers in her hair from then on.
//   A lit campfire draws her over to sit by it. She answers your waves, cheers and dances in kind.
// She keeps out of the water and steps aside if you walk into her. Far away she isn't posed or drawn.
// Her wandering draws from its own random stream.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, clamp, damp, lerp, turnTo, mulberry32 } from '../core/math.js';
import { SPAWN, FIRE_SPOT, lakePoint, groundAt, animalWalkable } from '../core/shape.js';
import { hooks, pushOut, world, seasonState, seats } from '../core/state.js';
import { windU, timeU } from '../core/materials.js';
import { makeKid, KIDS } from '../characters/kid.js';
import { poseKid, poseExtras, gesture, STRIDE_RATE } from '../characters/kidpose.js';
import { player, hero } from '../characters/player.js';
import { animals } from '../characters/animals.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { store, saveSoon, onSave } from '../systems/save.js';
import { cur } from '../systems/time.js';
import { wx } from '../systems/weather.js';
import { spawnHeart } from '../world/effects.js';
import { fire } from './campfire.js';
import { emoteState, playEmote } from './emotes.js';

const WALK = 1.7, RUN = 5.6, GREET = 4.2, TALK = 3.4, SHOW = 95, POSE = 60, SIDE = 0.62, FIRE_R = 2.5;

export let friend = null;
/** For tests: where she is and what she is doing. */
export const friendView = () => friend && { x: friend.st.x, z: friend.st.z, state: friend.st.state, mode: friend.st.mode, wave: friend.st.wave, together: friend.st.together,
  hold: friend.st.hold, sit: friend.st.sitAmt, ground: friend.st.ground, lie: friend.st.lie, gest: friend.st.gest, flower: !!store.friend.flower, said: friend.bubbleText() };
/** Is she within `range` of you (for other features' actions)? */
export const friendNear = (range = 2.6) => !!friend && Math.hypot(friend.st.x - player.x, friend.st.z - player.z) < range;
let giveFn = () => {};
/** Hand her a bouquet (array of "#colour:kind"). */
export const giftFriend = (bouquet) => giveFn(bouquet);

export function initFriend() {
  const r = mulberry32(90417), k = makeKid(KIDS.girl);
  scene.add(k.root);
  store.friend = store.friend || {};
  onSave((s) => { s.friend = Object.assign({}, store.friend); });
  // she starts a little way along the shore from where you do
  let home = lakePoint(Math.PI / 2 + 0.55, 1.28);
  if (!animalWalkable(home.x, home.z)) home = { x: SPAWN.x + 6, z: SPAWN.z + 3 };
  const st = { x: home.x, z: home.z, y: groundAt(home.x, home.z), rot: r() * TAU, move: 0, phase: 0, sitAmt: 0, seatTop: 0.44, petAmt: 0, idleT: 0, turn: 0, t: 0,
    state: 'idle', mode: 'alone', timer: 2 + r() * 3, target: null, wave: 0, waveT: 0, greeted: 0, together: false, met: false,
    ground: 0, lie: 0, hold: 0, gest: null, gestAmt: 0, cheerT: 0, fireA: null, line: 0 };

  // ── the flower she wears once you've given her a bouquet ──
  const flower = new THREE.Group();
  const petalMat = new THREE.MeshStandardMaterial({ color: store.friend.flower || '#ff8fb6', roughness: 0.8 });
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), petalMat); p.position.set(Math.cos((i / 5) * TAU) * 0.034, Math.sin((i / 5) * TAU) * 0.034, 0); p.scale.set(1, 1, 0.45); flower.add(p); }
  flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd35a', roughness: 0.8 })));
  flower.position.set(0.25, 0.4, 0.17); flower.rotation.set(-0.2, 0.9, 0); flower.visible = !!store.friend.flower;
  k.hair.add(flower);

  // ── speech bubble: a little card that floats over her head ──
  const bubble = document.getElementById('bubble'), headAt = new THREE.Vector3();
  let bubbleLeft = 0, bubbleText = '';
  const say = (text, secs = 4.5) => { bubbleText = text; bubble.textContent = text; bubbleLeft = secs; };
  const tamed = () => animals.filter((a) => a.tamed);
  const species = () => Object.keys(store.journal || {}).length;
  const hello = () => (wx.rain > 0.3 ? 'Hi! You\'re getting soaked out here!' : cur.stars > 0.5 ? 'Hi! Couldn\'t sleep either?' : cur.eve > 0.5 ? 'Hi! Isn\'t the evening light lovely?' : seasonState.name === 'Winter' ? 'Hi! Brr. Mind the ice.' : 'Hi! Lovely day for the meadow.');
  /** Something to say, picked from what's true right now; each call moves on to the next. */
  const chat = () => {
    const L = [];
    if (!store.rod) L.push('The skipper has an old fishing rod. I hear he likes a good bouquet.');
    else if (!species()) L.push('You got the rod! The fish bite best off the end of the jetty.');
    else L.push(`${species()} kinds of fish in your journal? I've only ever seen the minnows.`);
    const pets = tamed();
    if (!pets.length) L.push('The cats run from me too. Leave them a fish and keep very still.');
    else L.push(`${pets[0].name || 'Your ' + pets[0].kind} follows you everywhere now. So sweet.`);
    if (store.friend.flower) L.push('I love the flower. I\'m keeping it in my hair.');
    else L.push('The meadow is full of flowers this time of year. I\'d love a bouquet!');
    if (fire.on) L.push('The fire is so warm. Come and sit.'); else L.push('If you light the campfire, I\'ll come and sit by it.');
    if (cur.stars > 0.5) L.push('Lie down and look up. You might catch a shooting star.');
    else if (cur.eve > 0.5) L.push('Stay a while. The fireflies come out soon.');
    if (wx.rain > 0.3) L.push('I like the rain. The lake goes all silver.');
    if (seasonState.name === 'Spring') L.push('Have you seen the great cherry tree by the shrine? It\'s all in bloom.');
    if (seasonState.name === 'Autumn') L.push('The maples have turned. Everything is gold and red.');
    L.push(st.together ? 'I like walking with you.' : 'Want to walk together? Just ask.');
    return L[st.line++ % L.length];
  };

  // ── what you can do with her ──
  const dist = () => Math.hypot(player.x - st.x, player.z - st.z);
  registerAction({
    id: 'friend-talk', key: 'KeyC', keyLabel: 'C', score: () => 4,
    available: () => (activity.free || activity.is('sit')) && dist() < TALK,
    label: () => (st.met ? 'Talk to her' : 'Say hi'),
    run: () => {
      if (!st.met) { st.met = true; st.waveT = 2.4; playEmote('wave'); say(hello()); } else say(chat());
      if (st.mode === 'alone') { st.state = 'greet'; st.greeted = 1; }
    },
  });
  registerAction({
    id: 'friend-walk', key: 'KeyX', keyLabel: 'X', score: () => 3,
    available: () => activity.free && (st.together || dist() < TALK),
    label: () => (st.together ? 'Walk on your own' : 'Walk together, hand in hand'),
    run: () => { st.together = !st.together; st.met = true; say(st.together ? 'Yes, let\'s!' : 'See you around!', 3); if (!st.together) { st.state = 'idle'; st.timer = 3; st.waveT = 1.8; } },
  });
  giveFn = (bouquet) => {
    const first = String(bouquet[0] || '#ff8fb6').split(':')[0];
    store.friend.flower = first; petalMat.color.set(first); flower.visible = true;
    saveSoon();
    st.cheerT = 2.6; st.met = true;
    for (let i = 0; i < 5; i++) setTimeout(() => spawnHeart({ head: k.head }), i * 240);
    say('For me? They\'re beautiful! Thank you!', 5);
    hero.face.flash('happy', 3);
  };

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
  /** The nearest seat within `range` of a spot that nobody is on (you aren't, and it isn't the boat's). */
  const freeSeat = (x, z, range) => {
    let best = null, bd = range;
    for (const se of seats) { if (se === player.seat || se.boat) continue; const d = Math.hypot(se.x - x, se.z - z); if (d < bd) { bd = d; best = se; } }
    return best;
  };
  /** Go and sit on a seat, as you would. True once she is seated. */
  const sitOn = (se, dt) => {
    const hx = se.x - Math.sin(se.rot) * 0.1, hz = se.z - Math.cos(se.rot) * 0.1;
    if (goTo(hx, hz, dt, 0.7) >= 0.7) return false;
    st.rot = turnTo(st.rot, se.rot, dt * 6); st.seatTop = se.top;
    return true;
  };
  /** Head for a spot; once within `snap` she glides exactly onto it. Returns how far she still is. */
  const goTo = (tx, tz, dt, snap = 0.3) => {
    const dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz);
    if (d < snap) { st.x = damp(st.x, tx, 10, dt); st.z = damp(st.z, tz, 10, dt); return d; }
    const sp = clamp(d * 2.2, WALK, RUN);
    st.rot = turnTo(st.rot, Math.atan2(dx, dz), dt * 7);
    const nx = st.x + Math.sin(st.rot) * sp * dt, nz = st.z + Math.cos(st.rot) * sp * dt;
    if (animalWalkable(nx, nz) || d < 1.5) { st.x = nx; st.z = nz; }
    return d;
  };

  hooks.frame.push((dt, t, camera) => {
    const camD = Math.hypot(camera.position.x - st.x, camera.position.z - st.z);
    k.root.visible = camD < SHOW;
    const dxp = player.x - st.x, dzp = player.z - st.z, dp = Math.hypot(dxp, dzp);
    const fx = Math.sin(player.rot), fz = Math.cos(player.rot), rx = Math.cos(player.rot), rz = -Math.sin(player.rot); // your forward, and your left-hand side (where she walks)
    const prevRot = st.rot, px = st.x, pz = st.z;
    let wantSit = 0, wantGround = 0, wantLie = 0, wantHold = 0, attached = false, baseY = null, gest = null, face = 'calm';
    if (dp > 14) st.met = false;                       // a fresh hello next time
    if (st.together && dp > 45) st.together = false;   // lost each other

    const seat = player.seat;
    st.mode = !st.together ? (fire.on && Math.hypot(FIRE_SPOT.x - st.x, FIRE_SPOT.z - st.z) < 60 ? 'fire' : 'alone')
      : seat ? (seat.boat ? 'wait' : 'sit') : activity.is('lie') ? 'lie' : activity.is('fish') ? 'watch' : emoteState.ground > 0.5 ? 'ground' : 'follow';
    if (st.mode !== 'fire') st.fireA = null;
    if (st.mode !== st.seatMode) { st.seatMode = st.mode; st.seat = undefined; } // (a seat is chosen afresh each time)

    if (st.mode === 'follow') {
      // beside you, hand in hand; if she has fallen behind she hurries to catch up
      let sx = player.x + rx * SIDE, sz = player.z + rz * SIDE;
      if (!animalWalkable(sx, sz)) { sx = player.x - fx * 0.75; sz = player.z - fz * 0.75; }
      const d = Math.hypot(sx - st.x, sz - st.z);
      if (d > 1.3) goTo(sx, sz, dt, 0);
      else {
        attached = true;
        st.x = damp(st.x, sx, 16, dt); st.z = damp(st.z, sz, 16, dt);
        st.rot = turnTo(st.rot, player.rot, dt * 9);
        if (d < 0.4) wantHold = 1;
      }
    } else if (st.mode === 'sit') {
      // on the bench beside you; a chair or a log only seats one, so she takes another seat close by
      // (the next log round the fire, the other chair), and sits on the grass only if there is none
      if (seat.name === 'bench') {
        const sx = seat.x + Math.cos(seat.rot) * 0.6, sz = seat.z - Math.sin(seat.rot) * 0.6;
        if (goTo(sx, sz, dt, 0.5) < 0.5) { st.rot = turnTo(st.rot, seat.rot, dt * 6); wantSit = 1; st.seatTop = seat.top; baseY = seat.baseY; }
      } else {
        if (st.seat === undefined) st.seat = freeSeat(seat.x, seat.z, 5);
        if (st.seat) { if (sitOn(st.seat, dt)) { wantSit = 1; baseY = st.seat.baseY; } }
        else if (goTo(seat.x + Math.cos(seat.rot) * 0.85, seat.z - Math.sin(seat.rot) * 0.85, dt, 0.5) < 0.5) { st.rot = turnTo(st.rot, seat.rot, dt * 6); wantGround = 1; }
      }
    } else if (st.mode === 'lie' || st.mode === 'ground') {
      if (goTo(player.x + rx * 0.8, player.z + rz * 0.8, dt, 0.4) < 0.4) { st.rot = turnTo(st.rot, player.rot, dt * 6); if (st.mode === 'lie') wantLie = 1; else wantGround = 1; }
    } else if (st.mode === 'watch') {
      if (goTo(player.x + rx * 1.0 - fx * 0.25, player.z + rz * 1.0 - fz * 0.25, dt, 0.4) < 0.4) st.rot = turnTo(st.rot, player.rot, dt * 5);
      if (world.caughtAt !== undefined && t - world.caughtAt < 3) { gest = 'cheer'; face = 'love'; }
    } else if (st.mode === 'wait') {
      st.rot = turnTo(st.rot, Math.atan2(dxp, dzp), dt * 3); // you're on the boat: she watches from the shore
    } else if (st.mode === 'fire') {
      // a lit campfire: she comes over and takes a free log by it (the grass, if they are all taken)
      if (st.seat === undefined) st.seat = freeSeat(FIRE_SPOT.x, FIRE_SPOT.z, 5);
      if (st.seat && st.seat === player.seat) st.seat = freeSeat(FIRE_SPOT.x, FIRE_SPOT.z, 5); // you took hers: she finds another
      if (st.seat) { if (sitOn(st.seat, dt)) { wantSit = 1; baseY = st.seat.baseY; if (dp < TALK) face = 'happy'; } }
      else {
        if (st.fireA === null) {
          // a free place in the ring round the fire: the nearest to where she is coming from that isn't a log, a rock or you
          const from = Math.atan2(st.x - FIRE_SPOT.x, st.z - FIRE_SPOT.z);
          st.fireA = from;
          for (let i = 0; i < 16; i++) {
            const a = from + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.4, q = { x: FIRE_SPOT.x + Math.sin(a) * FIRE_R, z: FIRE_SPOT.z + Math.cos(a) * FIRE_R }, q0 = { x: q.x, z: q.z };
            pushOut(q, 0.4);
            if (Math.hypot(q.x - q0.x, q.z - q0.z) < 0.02 && !seats.some((se) => Math.hypot(se.x - q.x, se.z - q.z) < 1.1) && Math.hypot(player.x - q.x, player.z - q.z) > 0.9) { st.fireA = a; break; }
          }
        }
        const sx = FIRE_SPOT.x + Math.sin(st.fireA) * FIRE_R, sz = FIRE_SPOT.z + Math.cos(st.fireA) * FIRE_R;
        if (goTo(sx, sz, dt, 0.4) < 0.4) { st.rot = turnTo(st.rot, Math.atan2(FIRE_SPOT.x - st.x, FIRE_SPOT.z - st.z), dt * 6); wantGround = 1; if (dp < TALK) face = 'happy'; }
      }
    } else if (dp < GREET && player.sitAmt < 0.5) {
      // on her own and you're close: she stops, turns to you and waves (once each time you come up to her)
      if (st.state !== 'greet') { st.state = 'greet'; st.greeted = 0; }
      st.rot = turnTo(st.rot, Math.atan2(dxp, dzp), dt * 5);
      st.greeted += dt;
      if (st.greeted < 3.2) gest = 'wave';
      if (st.greeted < 4) face = 'happy';
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
          const nx = st.x + Math.sin(st.rot) * WALK * dt, nz = st.z + Math.cos(st.rot) * WALK * dt;
          if (animalWalkable(nx, nz)) { st.x = nx; st.z = nz; } else { st.state = 'idle'; st.timer = 1; } // blocked: think again
        }
      }
    }
    // she steps out of your way, and round trees and rocks (unless she is at your side on purpose)
    if (!attached && st.sitAmt < 0.3 && st.mode !== 'sit') {
      if (dp < 0.55 && dp > 0.01) { st.x -= (dxp / dp) * (0.55 - dp); st.z -= (dzp / dp) * (0.55 - dp); }
      const p = { x: st.x, z: st.z }; pushOut(p, 0.3);
      if (animalWalkable(p.x, p.z)) { st.x = p.x; st.z = p.z; }
    }
    // how fast she actually went (drives her stride), and her height
    const sp = dt > 0 ? Math.hypot(st.x - px, st.z - pz) / dt : 0;
    st.move = attached ? player.move : damp(st.move, Math.min(sp, RUN), 8, dt);
    st.y = damp(st.y, baseY !== null ? baseY : groundAt(st.x, st.z), 12, dt);
    st.sitAmt = damp(st.sitAmt, wantSit, 5, dt); st.ground = damp(st.ground, wantGround, 5, dt); st.lie = damp(st.lie, wantLie, 4, dt); st.hold = damp(st.hold, wantHold, 7, dt);
    k.root.position.set(st.x, st.y, st.z);
    k.root.rotation.y = st.rot;

    // the bubble follows her head, and goes when its time is up or she is out of sight
    if (bubbleLeft > 0) {
      bubbleLeft -= dt;
      k.head.getWorldPosition(headAt); headAt.y += 0.75; headAt.project(camera);
      const on = bubbleLeft > 0 && headAt.z < 1 && camD < 30;
      bubble.hidden = !on;
      if (on) { bubble.style.left = `${(headAt.x * 0.5 + 0.5) * window.innerWidth}px`; bubble.style.top = `${(-headAt.y * 0.5 + 0.5) * window.innerHeight}px`; }
    }
    if (camD > POSE) return; // too far to see her move

    if (attached) st.phase = player.phase + Math.PI; // in step with you, opposite foot
    else st.phase += dt * st.move * STRIDE_RATE;
    let dr = st.rot - prevRot; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    st.turn = damp(st.turn, dt > 0 ? dr / dt : 0, 8, dt);
    st.idleT = st.move < 0.15 && st.mode === 'alone' && st.state !== 'greet' ? st.idleT + dt : 0;
    st.t = t + 11.3; // (out of step with your own idle sway)
    poseKid(k, st, dt);
    poseExtras(k, { ground: st.ground, lie: st.lie, hold: st.hold, side: 0 });
    // gestures: her own wave or cheer, or yours given back (wave for wave, a cheer, a dance)
    if (st.waveT > 0) { st.waveT -= dt; gest = 'wave'; face = 'happy'; }
    if (st.cheerT > 0) { st.cheerT -= dt; gest = 'cheer'; face = 'love'; }
    if (!gest && dp < 8 && emoteState.amt > 0.5 && timeU.value - emoteState.at > 0.45 && st.ground < 0.3 && st.lie < 0.3 && st.sitAmt < 0.3 && !attached) { gest = emoteState.shown; face = 'happy'; st.rot = turnTo(st.rot, Math.atan2(dxp, dzp), dt * 4); }
    if (gest) st.gest = gest;
    st.gestAmt = damp(st.gestAmt, gest ? 1 : 0, gest ? 9 : 6, dt);
    gesture(k, st.gest, st.gestAmt, t);
    st.wave = st.gest === 'wave' ? st.gestAmt : 0;
    if (st.state === 'greet' && st.mode === 'alone') k.head.rotation.y = lerp(k.head.rotation.y, 0, 0.8);
    k.face.set(st.lie > 0.5 ? 'sleepy' : st.hold > 0.5 && face === 'calm' ? 'happy' : face);
    k.root.updateMatrixWorld(true);
    k.face.update(dt, t);
    k.sway(dt, t, Math.min(1.5, windU.value));
  });

  // hand in hand: your arm on her side reaches out to hers
  hooks.pose.push(() => { if (st.hold > 0.01) poseExtras(hero, { hold: st.hold, side: 1 }); });

  friend = { k, st, bubbleText: () => (bubbleLeft > 0 ? bubbleText : '') };
}
