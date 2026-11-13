// Campfire on the meadow: light it with E, sit on a log, and the cats and dogs gather round.
// Flickering flames and light, sparks, smoke and crackling; heavy rain puts it out.
import * as THREE from 'three';
import { scene, camera } from '../core/render.js';
import { TAU, damp, rnd, angDiff, clamp } from '../core/math.js';
import { FIRE_SPOT as C, LAKE, height, animalWalkable } from '../core/shape.js';
import { std, weatherize, glowTex } from '../core/materials.js';
import { hooks, seats, obstacles } from '../core/state.js';
import { player } from '../characters/player.js';
import { animals } from '../characters/animals.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { audio, voice, noise, playing } from '../systems/audio.js';
import { wx } from '../systems/weather.js';
import { toast } from '../ui/hud.js';

export const fire = { on: false, lit: 0, left: 0 };

export function initCampfire() {
  const baseY = height(C.x, C.z);
  const pit = new THREE.Group();
  pit.position.set(C.x, baseY, C.z);
  scene.add(pit);
  const stoneMat = weatherize(std('#8a8a80'), 'std');
  const stoneGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const s = new THREE.Mesh(stoneGeo, stoneMat);
    s.scale.set(rnd(0.14, 0.2), rnd(0.1, 0.14), rnd(0.14, 0.2));
    s.position.set(Math.cos(a) * 0.72, 0.06, Math.sin(a) * 0.72);
    s.rotation.y = rnd(0, TAU);
    s.castShadow = true; s.receiveShadow = true;
    pit.add(s);
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14).rotateX(-Math.PI / 2), std('#2e2a26'));
  ash.position.y = 0.02;
  pit.add(ash);
  const logMat = weatherize(std('#6b4a2e'), 'std');
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 6), logMat);
    l.rotation.set(Math.PI / 2 - 0.5, (i / 4) * TAU, 0);
    l.position.set(Math.cos((i / 4) * TAU) * 0.12, 0.17, Math.sin((i / 4) * TAU) * 0.12);
    l.castShadow = true;
    pit.add(l);
  }
  const emberMat = new THREE.MeshStandardMaterial({ color: '#3a1a10', emissive: '#ff5a1a', emissiveIntensity: 0, flatShading: true });
  const embers = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0).scale(1, 0.35, 1), emberMat);
  embers.position.y = 0.06;
  pit.add(embers);
  obstacles.push({ x: C.x, z: C.z, r: 0.85 });

  const facing = Math.atan2(LAKE.x - C.x, LAKE.z - C.z);
  const logAngles = [facing + Math.PI, facing + Math.PI + 2.1];
  logAngles.forEach((a) => {
    const x = C.x + Math.sin(a) * 2.3, z = C.z + Math.cos(a) * 2.3, y = height(x, z);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 8).rotateZ(Math.PI / 2), logMat);
    const rot = Math.atan2(C.x - x, C.z - z);
    log.position.set(x, y + 0.18, z);
    log.rotation.y = rot;
    log.castShadow = true; log.receiveShadow = true;
    scene.add(log);
    seats.push({ name: 'log', x, z, baseY: y, top: 0.36, rot, standOff: 0.9 });
    obstacles.push({ x, z, r: 0.45 });
  });

  const flameTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 92, 2, 32, 80, 60);
    gr.addColorStop(0, 'rgba(255,250,220,1)');
    gr.addColorStop(0.25, 'rgba(255,200,90,0.95)');
    gr.addColorStop(0.55, 'rgba(255,110,30,0.6)');
    gr.addColorStop(1, 'rgba(255,60,10,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(32, 4);
    g.bezierCurveTo(52, 50, 62, 80, 48, 112);
    g.quadraticCurveTo(32, 126, 16, 112);
    g.bezierCurveTo(2, 80, 12, 50, 32, 4);
    g.fill();
    return new THREE.CanvasTexture(c);
  })();
  const flames = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: i % 2 ? '#ffd27a' : '#ff9a4a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false;
    pit.add(s);
    flames.push({ s, ph: rnd(), ox: rnd(-0.16, 0.16), oz: rnd(-0.16, 0.16), sp: rnd(1.2, 1.9) });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a50', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 0.6; glow.scale.set(4.5, 4.5, 1);
  pit.add(glow);
  const light = new THREE.PointLight('#ff9a50', 0, 16, 2);
  light.position.y = 0.9;
  pit.add(light);
  const SPARKS = 40;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ size: 0.07, map: glowTex, color: '#ffb050', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  pit.add(sparks);
  const sparkSeed = Array.from({ length: SPARKS }, () => ({ y: rnd(0, 3), x: rnd(-0.2, 0.2), z: rnd(-0.2, 0.2), v: rnd(0.6, 1.4), p: rnd() * TAU }));
  const smoke = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#8d8d8d', transparent: true, opacity: 0, depthWrite: false }));
    pit.add(s);
    smoke.push({ s, t: i / 6 });
  }

  const release = () => animals.forEach((a) => { if (a.goal && a.goal.src === 'fire') a.goal = null; });
  const toggle = () => {
    if (fire.on) { fire.on = false; toast('You put out the campfire.'); release(); return; }
    if (wx.rain > 0.5) { toast('It is too wet to light a fire right now.'); return; }
    fire.on = true; fire.left = 360;
    toast('The campfire crackles to life. Pull up a log.');
  };
  const dFire = () => Math.hypot(C.x - player.x, C.z - player.z);
  registerAction({
    id: 'campfire', key: 'KeyE', keyLabel: 'E',
    available: () => activity.free && dFire() < 2.2,
    label: () => (fire.on ? 'Put out the campfire' : 'Light the campfire'),
    // right at the stone ring the fire wins over the nearby log seats
    score: () => (dFire() < 1.25 ? 100 : -dFire()),
    run: toggle,
  });

  const slots = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    if (logAngles.some((la) => Math.abs(angDiff(a, la)) < 0.45)) continue;
    slots.push(a);
  }
  const gather = () => {
    const used = new Set(animals.filter((a) => a.goal && a.goal.src === 'fire').map((a) => a.goal.slot));
    for (const a of animals) {
      if (a.goal || a.petted || !a.tamed || a.state === 'shelter') continue;
      if (Math.hypot(a.x - C.x, a.z - C.z) > 50) continue;
      const free = slots.map((s, i) => i).filter((i) => !used.has(i));
      if (!free.length) return;
      let best = free[0], bd = Infinity;
      for (const i of free) {
        const sx = C.x + Math.sin(slots[i]) * 2.6, sz = C.z + Math.cos(slots[i]) * 2.6;
        const d = Math.hypot(sx - a.x, sz - a.z);
        if (d < bd && animalWalkable(sx, sz)) { bd = d; best = i; }
      }
      used.add(best);
      const r = a.kind === 'dog' ? 2.8 : 2.5;
      a.goal = { x: C.x + Math.sin(slots[best]) * r, z: C.z + Math.cos(slots[best]) * r, faceX: C.x, faceZ: C.z, src: 'fire', slot: best };
    }
  };

  let crackleIn = 0, roar = null, gatherIn = 0;
  hooks.frame.push((dt, t) => {
    if (fire.on) {
      fire.left -= dt;
      if (wx.rain > 0.55) { fire.on = false; release(); toast('The rain puts the campfire out.'); }
      else if (fire.left <= 0) { fire.on = false; release(); toast('The campfire burns down to embers.'); }
    }
    fire.lit = damp(fire.lit, fire.on ? 1 : 0, fire.on ? 0.8 : 0.5, dt);
    const L = fire.lit;
    const flick = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 23.7) * 0.06 + Math.sin(t * 5.3) * 0.05;
    light.intensity = L * 2.2 * flick;
    glow.material.opacity = L * 0.55 * flick;
    emberMat.emissiveIntensity = fire.on || L > 0.02 ? 0.3 + L * 1.5 * flick : Math.max(0, 0.25 - (wx.rain > 0.3 ? 0.25 : 0));
    for (const f of flames) {
      f.s.visible = L > 0.02;
      if (!f.s.visible) continue;
      f.ph = (f.ph + dt * f.sp) % 1;
      const life = f.ph, h = (0.55 + Math.sin(t * 9 + f.ox * 40) * 0.12) * (1 - life * 0.6) * L;
      f.s.scale.set(0.42 * (1 - life * 0.5) * L, h * 1.3, 1);
      f.s.position.set(f.ox * (1 - life), 0.25 + life * 0.55 * L, f.oz * (1 - life));
      f.s.material.opacity = Math.sin(life * Math.PI) * 0.95 * L;
    }
    sparks.visible = L > 0.1;
    if (sparks.visible) {
      for (let i = 0; i < SPARKS; i++) {
        const s = sparkSeed[i];
        s.y += s.v * dt;
        if (s.y > 3) { s.y = 0.2; s.x = rnd(-0.2, 0.2); s.z = rnd(-0.2, 0.2); }
        sparkPos[i * 3] = s.x + Math.sin(t * 2 + s.p) * 0.15 * s.y;
        sparkPos[i * 3 + 1] = s.y;
        sparkPos[i * 3 + 2] = s.z + Math.cos(t * 1.7 + s.p) * 0.15 * s.y;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = L * 0.9;
    }
    for (const s of smoke) {
      s.t = (s.t + dt * 0.12) % 1;
      s.s.position.set(Math.sin(t * 0.4 + s.t * 6) * 0.3 + s.t * 0.8, 0.8 + s.t * 4, s.t * 0.3);
      const sc = 0.6 + s.t * 2.2;
      s.s.scale.set(sc, sc, 1);
      s.s.material.opacity = Math.sin(s.t * Math.PI) * 0.18 * Math.max(L, !fire.on && L > 0.01 ? 0.3 : 0);
      s.s.visible = L > 0.01;
    }
    if (fire.on) { gatherIn -= dt; if (gatherIn <= 0) { gather(); gatherIn = 3; } }

    if (!playing()) return;
    if (!roar) {
      const src = audio.ctx.createBufferSource(); src.buffer = audio.brownBuf; src.loop = true;
      const lp = audio.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      roar = audio.ctx.createGain(); roar.gain.value = 0;
      src.connect(lp).connect(roar).connect(audio.buses.ambience);
      src.start();
    }
    const near = clamp(1 - Math.hypot(camera.position.x - C.x, camera.position.z - C.z) / 30, 0, 1);
    roar.gain.value = damp(roar.gain.value, L * near * near * 0.12, 3, dt);
    crackleIn -= dt;
    if (L > 0.3 && crackleIn <= 0) {
      crackleIn = rnd(0.04, 0.3);
      const v = voice(C.x, C.z, 30, rnd(0.3, 1) * L, 'ambience');
      if (v) {
        const n = noise(v.ctx), hp = v.ctx.createBiquadFilter(), g = v.ctx.createGain();
        hp.type = 'highpass'; hp.frequency.value = rnd(1800, 4000);
        const len = rnd(0.015, 0.05);
        g.gain.setValueAtTime(0.0001, v.t); g.gain.linearRampToValueAtTime(0.5, v.t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, v.t + len);
        n.connect(hp).connect(g).connect(v.out);
        n.start(v.t, rnd(0, 3)); n.stop(v.t + len + 0.02);
      }
    }
  });
}
