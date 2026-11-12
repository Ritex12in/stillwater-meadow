// Stargazing: lie down (Z) and the view tilts up to the sky. Shooting stars cross clear night
// skies, far more often while you're lying down.
import * as THREE from 'three';
import { clamp, lerp, damp, rnd, TAU } from '../core/math.js';
import { walkable } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { camera } from '../core/render.js';
import { player, hero } from '../characters/player.js';
import { activity } from '../systems/activity.js';
import { registerAction, moving } from '../systems/actions.js';
import { camState } from '../systems/input.js';
import { cur } from '../systems/time.js';
import { wx } from '../systems/weather.js';
import { sky } from '../world/sky.js';
import { toast } from '../ui/hud.js';

export function initStargaze() {
  player.lieAmt = 0;
  let wished = false;
  const lieDown = () => { if (activity.enter('lie')) { wished = false; camState.pitch = 0.32; } };
  const getUp = () => activity.leave('lie');
  registerAction({ id: 'get-up', key: 'KeyZ', keyLabel: 'Z', score: () => 1000, available: () => activity.is('lie'), label: () => 'Get up', run: getUp });
  registerAction({
    id: 'lie', key: 'KeyZ', keyLabel: 'Z', score: () => -1,
    available: () => activity.free && cur.stars > 0.3 && !moving() && walkable(player.x, player.z),
    label: () => 'Lie down and watch the stars', run: lieDown,
  });

  hooks.pose.push((dt) => {
    player.lieAmt = damp(player.lieAmt, activity.is('lie') ? 1 : 0, 4, dt);
    const la = player.lieAmt;
    if (la < 0.001) return;
    hero.body.rotation.x = lerp(hero.body.rotation.x, -1.52, la);
    hero.body.position.y = lerp(hero.body.position.y, 0.27, la);
    hero.legs.forEach((l, i) => { l.rotation.x = lerp(l.rotation.x, i ? 0.05 : -0.08, la); });
    hero.knees.forEach((k, i) => { k.rotation.x = lerp(k.rotation.x, i ? 0.4 : 0, la); });
    hero.arms.forEach((a, i) => { a.rotation.x = lerp(a.rotation.x, -2.9, la); a.rotation.z = lerp(a.rotation.z, i ? -0.45 : 0.45, la); });
    hero.head.rotation.x = lerp(hero.head.rotation.x, -0.25, la);
  });

  // the view looks up from just above your face (and above the grass tips)
  const head = new THREE.Vector3(), want = new THREE.Vector3(), look = new THREE.Vector3();
  hooks.camera.push((dt, camTarget) => {
    const la = player.lieAmt;
    if (la < 0.05) return false;
    if (activity.is('lie') && moving()) getUp();
    hero.head.getWorldPosition(head);
    camTarget.set(player.x, player.y + 1.55, player.z);
    want.set(head.x, head.y + 0.75, head.z);
    const yaw = camState.yaw, el = clamp(1.0 - (camState.pitch - 0.32) * 1.5, 0.3, 1.5);
    look.set(want.x - Math.sin(yaw) * Math.cos(el) * 10, want.y + Math.sin(el) * 10, want.z - Math.cos(yaw) * Math.cos(el) * 10);
    camera.position.lerp(want, 1 - Math.exp(-dt * 3 * la));
    camera.lookAt(look);
    return true;
  });

  // shooting stars live on the sky dome, which follows the camera
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const streak = new THREE.Line(geo, mat);
  streak.frustumCulled = false;
  streak.visible = false;
  sky.add(streak);
  const s = { t: 1, start: new THREE.Vector3(), vel: new THREE.Vector3() };
  let nextIn = 20;
  const launch = () => {
    const el = rnd(0.5, 1.15), yaw = camState.yaw, lying = activity.is('lie');
    const az = lying ? Math.atan2(-Math.cos(yaw), -Math.sin(yaw)) + rnd(-0.6, 0.6) : rnd() * TAU;
    s.start.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(600);
    const side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)).multiplyScalar(rnd() < 0.5 ? 1 : -1);
    s.vel.copy(side).addScaledVector(new THREE.Vector3(0, -1, 0), 0.45).normalize().multiplyScalar(rnd(320, 460));
    s.t = 0;
    streak.visible = true;
    if (lying && !wished) { wished = true; toast('A shooting star. Make a wish.'); }
  };
  hooks.frame.push((dt) => {
    nextIn -= dt;
    if (cur.stars > 0.35 && wx.cloud < 0.55 && nextIn <= 0) { launch(); nextIn = activity.is('lie') ? rnd(4, 10) : rnd(25, 60); }
    if (s.t < 1) {
      s.t += dt / 0.85;
      const k = Math.min(1, s.t), arr = geo.attributes.position.array;
      const hx = s.start.x + s.vel.x * k * 0.85, hy = s.start.y + s.vel.y * k * 0.85, hz = s.start.z + s.vel.z * k * 0.85;
      const len = Math.min(k * 4, 1) * 0.16;
      arr[0] = hx; arr[1] = hy; arr[2] = hz;
      arr[3] = hx - s.vel.x * len; arr[4] = hy - s.vel.y * len; arr[5] = hz - s.vel.z * len;
      geo.attributes.position.needsUpdate = true;
      mat.opacity = (1 - k * k) * cur.stars;
      if (k >= 1) streak.visible = false;
    }
  });
}
