// Weather: clear, rain, thunderstorm, fog and snow, drifting on its own or picked by hand.
// Owns the precipitation, lightning, mist banks and the rainbow, and reshapes the sky palette.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, clamp, lerp, damp, smooth, rnd } from '../core/math.js';
import { query } from '../core/env.js';
import { lakePoint, heightAt } from '../core/shape.js';
import { glowTex, wxU, windU } from '../core/materials.js';
import { seasonState, hooks } from '../core/state.js';
import { makeFalling } from '../world/particles.js';
import { waterU } from '../world/water.js';
import { voice, audio } from './audio.js';

export const WX_TYPES = {
  clear: { cloud: 0.08, rain: 0, storm: 0, fog: 0, snow: 0, wind: 0.3 },
  rain: { cloud: 0.78, rain: 0.6, storm: 0, fog: 0.12, snow: 0, wind: 0.5 },
  storm: { cloud: 1, rain: 1, storm: 1, fog: 0.2, snow: 0, wind: 1 },
  fog: { cloud: 0.35, rain: 0, storm: 0, fog: 1, snow: 0, wind: 0.08 },
  snow: { cloud: 0.34, rain: 0, storm: 0, fog: 0.08, snow: 1, wind: 0.25 }, // gentle snowfall under a breaking sky: moon and stars still show
};
const WX_KEYS = ['cloud', 'rain', 'storm', 'fog', 'snow', 'wind'];
export const WX_LABEL = { clear: '', rain: 'Rain', storm: 'Thunderstorm', fog: 'Fog', snow: 'Snow' };
const WX_NEXT = {
  clear: { clear: 2, rain: 3, fog: 2, snow: 1.2, storm: 0.5 },
  rain: { clear: 4, storm: 1.5, rain: 1, fog: 1 },
  storm: { rain: 3, clear: 1 },
  fog: { clear: 4, rain: 1, fog: 1 },
  snow: { clear: 3, snow: 1, fog: 1 },
};
const WX_DURATION = { clear: [240, 480], rain: [150, 300], storm: [90, 180], fog: [150, 300], snow: [180, 360] }; // seconds
export const WX_ORDER = ['auto', 'clear', 'rain', 'storm', 'fog', 'snow'];
const RAINBOW_SECONDS = 80;

export const wx = { auto: true, type: 'clear', rate: 0.12, nextChange: rnd(240, 420), wet: 0, cover: 0, flash: 0, reflash: 0, nextBolt: 6, rainedRecently: false, rainbowT: 0, fromUrl: false };
WX_KEYS.forEach((k) => { wx[k] = WX_TYPES.clear[k]; });
const urlWeather = query.get('weather');
if (WX_TYPES[urlWeather]) { wx.auto = false; wx.type = urlWeather; wx.fromUrl = true; WX_KEYS.forEach((k) => { wx[k] = WX_TYPES[urlWeather][k]; }); }

const listeners = new Set();
export const onWeatherChange = (fn) => listeners.add(fn);
const changed = () => listeners.forEach((fn) => fn());

export function setWeather(type, manual) {
  if (!WX_TYPES[type]) return;
  wx.type = type;
  if (manual) { wx.auto = false; wx.rate = 0.45; } else wx.rate = 0.12;
  changed();
}
export function goAutoWeather() {
  wx.auto = true;
  wx.rate = 0.12;
  wx.nextChange = rnd(...WX_DURATION[wx.type]) * 0.6;
  changed();
}
export function cycleWeather() {
  const i = WX_ORDER.indexOf(wx.auto ? 'auto' : wx.type);
  const next = WX_ORDER[(i + 1) % WX_ORDER.length];
  if (next === 'auto') goAutoWeather(); else setWeather(next, true);
}
/** Restore a saved weather choice without the slow fade. */
export function restoreWeather(saved) {
  if (!saved || wx.fromUrl) return;
  if (saved.auto) { wx.auto = true; return; }
  if (!WX_TYPES[saved.type]) return;
  wx.auto = false; wx.type = saved.type;
  WX_KEYS.forEach((k) => { wx[k] = WX_TYPES[saved.type][k]; });
  changed();
}
function pickNextWeather(hour) {
  const w = Object.assign({}, WX_NEXT[wx.type]);
  if (w.fog !== undefined && hour > 4 && hour < 9.5) w.fog *= 2.5; // misty mornings
  let total = 0;
  for (const k in w) total += w[k];
  let r = rnd() * total;
  for (const k in w) { r -= w[k]; if (r <= 0) return seasonState.mapWeather(k); }
  return 'clear';
}

// ── Palette ────────────────────────────────────────────────────
const greyTmp = new THREE.Color(), flashC = new THREE.Color();
export const white = new THREE.Color(1, 1, 1);
function toGrey(c, amt, dark) {
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  greyTmp.setRGB(l, l, l * 1.04);
  c.lerp(greyTmp, amt).multiplyScalar(dark);
}
/** Overcast, fog, snow and lightning reshape the sampled time-of-day palette. */
export function weatherModify(cur) {
  const oc = wx.cloud, st = wx.storm;
  const dark = 1 - oc * 0.28 - st * 0.25;
  toGrey(cur.top, oc * 0.8, dark);
  toGrey(cur.horizon, oc * 0.7, 1 - oc * 0.18 - st * 0.25);
  toGrey(cur.cloud, oc * 0.6, 1 - oc * 0.35 - st * 0.3);
  toGrey(cur.deep, oc * 0.5, dark);
  toGrey(cur.shallow, oc * 0.5, dark);
  cur.glow.multiplyScalar(1 - oc * 0.85);
  const lightLevel = 0.25 + 0.75 * Math.max(cur.day, 0.05);
  if (wx.snow > 0.001) cur.horizon.lerp(greyTmp.setRGB(0.74, 0.82, 1.0).multiplyScalar(lightLevel), wx.snow * 0.3);
  if (wx.fog > 0.001) cur.horizon.lerp(greyTmp.setRGB(0.8, 0.82, 0.84).multiplyScalar(lightLevel), wx.fog * 0.6);
  cur.lightI *= 1 - oc * 0.62 - st * 0.15;
  cur.hemiI *= 1 + oc * 0.25;
  cur.fogNear = lerp(cur.fogNear, 4, wx.fog) * (1 - wx.rain * 0.4);
  cur.fogFar = lerp(cur.fogFar, 55, wx.fog) * (1 - wx.rain * 0.35 - wx.snow * 0.3);
  cur.stars *= 1 - oc;
  if (wx.flash > 0.001) {
    flashC.setRGB(0.55, 0.6, 0.75).multiplyScalar(wx.flash);
    cur.top.add(flashC); cur.horizon.add(flashC); cur.cloud.add(flashC);
    cur.hemiI += wx.flash * 1.4;
    cur.amb += wx.flash * 0.5;
  }
}

// ── Scene pieces ───────────────────────────────────────────────
let rain, snow, bolt, boltGeo, boltMat, rainbow, rainbowMat;
const mists = [];
export function buildWeather() {
  rain = makeFalling({ count: 2600, box: [40, 26, 40], speed: [0.85, 1.15], lines: true, stretch: 0.6 });
  snow = makeFalling({ count: 2600, box: [44, 24, 44], speed: [0.7, 1.4], size: 0.19, map: glowTex, sway: 0.6 });

  boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  boltMat = new THREE.LineBasicMaterial({ color: '#eef3ff', transparent: true, opacity: 0, fog: false, depthWrite: false });
  bolt = new THREE.Line(boltGeo, boltMat);
  bolt.frustumCulled = false; bolt.visible = false;
  scene.add(bolt);

  const mistTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 22 + rnd(-10, 10), y = 48 + rnd(-10, 10), r = rnd(26, 44);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 96);
    }
    return new THREE.CanvasTexture(c);
  })();
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0 }));
    const a = rnd() * TAU, tt = rnd(0.2, 1.7), pt = lakePoint(a, tt), lift = rnd(0.6, 1.6);
    sp.position.set(pt.x, Math.max(heightAt(pt.x, pt.z), 0) + lift, pt.z);
    sp.scale.set(rnd(16, 28), rnd(3.5, 6), 1);
    sp.visible = false;
    scene.add(sp);
    mists.push({ sp, bx: pt.x, p: rnd() * TAU, a, tt, lift });
  }
  // you have come to another lake: the mist lies over that one (each wisp at its own place round it)
  hooks.lake.push((lake) => {
    for (const m of mists) { const pt = lake.point(m.a, m.tt); m.bx = pt.x; m.sp.position.set(pt.x, Math.max(heightAt(pt.x, pt.z), 0) + m.lift, pt.z); }
  });

  rainbowMat = new THREE.ShaderMaterial({
    uniforms: { uAmt: { value: 0 } },
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uAmt; varying vec2 vUv;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float band = (length(p) - 0.86) / 0.1;
        if (band < 0.0 || band > 1.0) discard;
        vec3 c = hue((1.0 - band) * 0.78);
        float edge = smoothstep(0.0, 0.25, band) * smoothstep(1.0, 0.75, band);
        gl_FragColor = vec4(c * edge * smoothstep(-0.05, 0.3, p.y) * uAmt * 0.42, 1.0);
      }`,
  });
  rainbow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rainbowMat);
  rainbow.frustumCulled = false; rainbow.visible = false;
  scene.add(rainbow);
}
export const resizeWeather = (h) => { rain.resize(h); snow.resize(h); };

function thunder(delay, dist) {
  const v = voice(0, 0, 1e9, 1, 'ambience'); // thunder is everywhere
  if (!v) return;
  const { ctx, out } = v, t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = audio.brownBuf; src.playbackRate.value = rnd(0.45, 0.75);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = rnd(140, 260);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.9 * (1.4 - dist / 260), t0 + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + rnd(3, 5.5));
  src.connect(lp).connect(g).connect(out);
  src.start(t0, rnd(0, 3)); src.stop(t0 + 6);
}
function strike(center) {
  wx.flash = 1; wx.reflash = rnd(0.08, 0.2);
  const az = rnd() * TAU, dist = rnd(150, 260);
  let x = center.x + Math.cos(az) * dist, z = center.z + Math.sin(az) * dist, y = 95;
  const arr = boltGeo.attributes.position.array;
  for (let i = 0; i < 16; i++) {
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    x += rnd(-7, 7); z += rnd(-7, 7); y -= 95 / 15;
  }
  boltGeo.attributes.position.needsUpdate = true;
  thunder(rnd(0.8, 3.2), dist);
}

const rainStopListeners = new Set();
/** Called once when rain clears, with whether it's light enough for a rainbow. */
export const onRainStopped = (fn) => rainStopListeners.add(fn);

/** `env` = { hour, sunElev, center } */
export function updateWeather(dt, env) {
  if (wx.auto) {
    wx.nextChange -= dt;
    if (wx.nextChange <= 0) { setWeather(pickNextWeather(env.hour), false); wx.nextChange = rnd(...WX_DURATION[wx.type]); }
  }
  const target = WX_TYPES[wx.type];
  WX_KEYS.forEach((k) => { wx[k] = damp(wx[k], target[k], wx.rate, dt); });
  wx.wet = clamp(wx.wet + (wx.rain > 0.2 ? dt * 0.05 * wx.rain : -dt * 0.006), 0, 1);
  wx.cover = clamp(wx.cover + (wx.snow > 0.4 ? dt * 0.012 * wx.snow : -dt * (0.005 + Math.max(0, env.sunElev) * 0.0003)), 0, 1);
  wx.cover = Math.max(wx.cover, seasonState.coverFloor);
  waterU.uIce.value = seasonState.ice;
  waterU.uSnowIce.value = smooth(0, 1, wx.cover);
  wxU.wet.value = wx.wet * (1 - wx.cover);
  wxU.snow.value = smooth(0, 1, wx.cover);
  windU.value = 0.55 + wx.wind * 1.4;
  waterU.uRain.value = wx.rain;

  if (wx.storm > 0.5) { wx.nextBolt -= dt; if (wx.nextBolt <= 0) { strike(env.center); wx.nextBolt = rnd(5, 14); } }
  if (wx.reflash > 0) { wx.reflash -= dt; if (wx.reflash <= 0) wx.flash = Math.max(wx.flash, 0.75); }
  wx.flash = Math.max(0, wx.flash - dt * 3.5);
  bolt.visible = wx.flash > 0.3;
  boltMat.opacity = wx.flash;

  if (wx.rain > 0.4) wx.rainedRecently = true;
  if (wx.rainedRecently && wx.rain < 0.12 && WX_TYPES[wx.type].rain === 0) {
    wx.rainedRecently = false;
    rainStopListeners.forEach((fn) => fn());
    if (env.sunElev > 4 && wx.type !== 'snow') wx.rainbowT = RAINBOW_SECONDS;
  }
  if (wx.rainbowT > 0) wx.rainbowT -= dt;
}

const antiSun = new THREE.Vector3();
/** Particles, mist and rainbow follow the camera. */
export function updatePrecip(dt, t, camera, cur, sunDir, sunElev) {
  const cam = camera.position;
  rain.update(dt, t, cam, wx.rain * 1.15, 16.5, 1.5 + wx.storm * 5, 0);
  if (rain.obj.visible) {
    rain.u.uSlant.value.set((1.5 + wx.storm * 5) * (0.035 + wx.storm * 0.05), 0);
    rain.u.uOpacity.value = 0.32 + wx.storm * 0.25;
    rain.u.uTint.value.copy(cur.horizon).lerp(white, 0.45);
  }
  snow.update(dt, t, cam, wx.snow * 1.15, 1.0, 0.4 + wx.wind * 1.5, 0);
  if (snow.obj.visible) {
    snow.u.uOpacity.value = Math.min(1, wx.snow * 1.4);
    snow.u.uTint.value.setScalar(0.35 + 0.65 * Math.max(cur.day, 0.25));
  }
  for (const m of mists) {
    m.sp.visible = wx.fog > 0.02;
    if (!m.sp.visible) continue;
    m.sp.material.opacity = wx.fog * 0.5;
    m.sp.material.color.copy(cur.horizon).lerp(white, 0.35);
    m.sp.position.x = m.bx + Math.sin(t * 0.05 + m.p) * 4;
  }
  let rb = 0;
  if (wx.rainbowT > 0) {
    rb = clamp((RAINBOW_SECONDS - wx.rainbowT) / 8, 0, 1) * clamp(wx.rainbowT / 12, 0, 1)
      * (1 - clamp(wx.cloud * 1.5 - 0.2, 0, 1)) * smooth(2, 8, sunElev) * smooth(45, 38, sunElev);
  }
  rainbow.visible = rb > 0.01;
  if (rainbow.visible) {
    antiSun.copy(sunDir).negate();
    const D = 420;
    rainbow.position.copy(cam).addScaledVector(antiSun, D);
    rainbow.scale.setScalar((D * Math.tan(THREE.MathUtils.degToRad(42))) / 0.91);
    rainbow.lookAt(cam);
    rainbowMat.uniforms.uAmt.value = rb;
  }
}
