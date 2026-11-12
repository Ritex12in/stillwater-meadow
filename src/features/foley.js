// Footsteps that sound like what you're walking on (grass, wood, snow, ice), and footprints
// that stay in the snow for a while.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { rnd } from '../core/math.js';
import { onDock, onIce, heightAt } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { player, onStep } from '../characters/player.js';
import { burst } from '../systems/audio.js';
import { wx } from '../systems/weather.js';

const SURFACE = {
  grass: { type: 'bandpass', freq: 2200, q: 0.7, vol: 0.05, release: 0.09 },
  wood: { type: 'lowpass', freq: 520, q: 1.2, vol: 0.16, release: 0.12 },
  snow: { type: 'bandpass', freq: 1500, q: 0.5, vol: 0.12, attack: 0.04, release: 0.18 },
  ice: { type: 'highpass', freq: 3800, q: 0.7, vol: 0.06, release: 0.05 },
};

export function initFoley() {
  const prints = [];
  const geo = new THREE.PlaneGeometry(0.13, 0.27).rotateX(-Math.PI / 2);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#7d8ea6', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.visible = false;
    m.renderOrder = 1;
    scene.add(m);
    prints.push({ m, life: 0 });
  }
  let next = 0;

  onStep((foot, x, z) => {
    const surface = onDock(x, z) ? 'wood' : onIce(x, z) ? 'ice' : wx.cover > 0.35 ? 'snow' : 'grass';
    const s = SURFACE[surface];
    burst(x, z, Object.assign({ range: 18, attack: 0.008 }, s, { freq: s.freq * rnd(0.85, 1.15) }));
    if (surface !== 'snow' || player.seat) return;
    // a footprint, offset to the side of the foot that landed
    const side = foot ? 0.13 : -0.13, r = player.rot;
    const fx = x + Math.cos(r) * side, fz = z - Math.sin(r) * side;
    const p = prints[next]; next = (next + 1) % prints.length;
    p.m.position.set(fx, heightAt(fx, fz) + 0.03, fz);
    p.m.rotation.y = r;
    p.m.visible = true;
    p.life = 60;
  });

  hooks.frame.push((dt) => {
    for (const p of prints) {
      if (p.life <= 0) continue;
      p.life -= dt * (wx.cover > 0.35 ? 1 : 6); // melting snow takes the prints with it
      if (wx.snow > 0.5) p.life -= dt * 2;      // fresh snow fills them in
      p.m.material.opacity = Math.min(0.55, p.life / 20) * Math.min(1, wx.cover * 1.5);
      if (p.life <= 0) p.m.visible = false;
    }
  });
}
