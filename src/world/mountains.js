// Distant snow-capped mountains all round the valley, and soft bands of mist lying at their feet.
// Far beyond the fog, so they carry their own haze: blue-grey on the shady side, warm toward the
// sun, the same as the sky's horizon. Built from a fixed random stream; nothing else moves.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, lerp, smooth, mulberry32, fbm } from '../core/math.js';

export const mountainU = {
  uHaze: { value: new THREE.Color() },
  uGlow: { value: new THREE.Color() },
  uSun: { value: new THREE.Vector3(0, 1, 0) },
  uSnow: { value: 0 },          // winter brings the snow line down
  uMist: { value: new THREE.Color() },
  uMistAmt: { value: 0.6 },
};

// a seamless ridge line: noise sampled round a circle so it joins up behind you
const r = mulberry32(31337);
const PEAKS = Array.from({ length: 16 }, () => ({ a: r() * TAU, w: 0.3 + r() * 0.35, h: 0.5 + r() * 0.5 }));
function ridge(a) {
  a = ((a % TAU) + TAU) % TAU;
  let h = 0.18 + 0.1 * Math.sin(a * 5 + 1.3) + 0.06 * Math.sin(a * 13 + 0.4) + 0.03 * Math.sin(a * 31 + 2.1);
  for (const p of PEAKS) {
    let d = Math.abs(a - p.a); d = Math.min(d, TAU - d);
    const k = Math.max(0, 1 - d / p.w);
    h = Math.max(h, p.h * k * k * (3 - 2 * k) ** 0.6 + 0.04 * Math.sin(a * 57 + p.a * 9) * k);
  }
  return h;
}

function range(radius, depth, height, seg, tone) {
  const rows = 16, pos = [], col = [], idx = [];
  const rock = new THREE.Color('#7d8794'), forest = new THREE.Color('#3f5a46'), snow = new THREE.Color('#f4f6fa'), c = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU, top = ridge(a + tone) * height;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1);                       // 0 = front foot, 1 = back
      const prof = Math.sin(Math.PI * Math.min(t * 1.25, 1)) ** 0.7;
      const rr = radius + t * depth;
      // ridges and gullies running down the slopes
      const gully = (fbm(Math.cos(a) * 9 + t * 3 + tone, Math.sin(a) * 9 - t * 2) - 0.5) * 0.5 * top;
      const y = -8 + prof * (top + 8 + gully);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const hk = y / (height * 0.9);
      c.copy(forest).lerp(rock, smooth(0.15, 0.45, hk)).lerp(snow, smooth(0.52, 0.66, hk + 0.05 * Math.sin(a * 23 + j)));
      col.push(c.r, c.g, c.b, hk);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rows - 1; j++) {
    const a = i * rows + j, b = (i + 1) * rows + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('tint', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function mountainMat(haze) {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', fog: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mountainU);
    sh.vertexShader = 'attribute vec4 tint;\nvarying vec4 vTint;\nvarying vec3 vMW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vTint = tint; vMW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'uniform vec3 uHaze; uniform vec3 uGlow; uniform vec3 uSun; uniform float uSnow;\nvarying vec4 vTint;\nvarying vec3 vMW;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 mc = vTint.rgb;
        mc = mix(mc, vec3(0.95, 0.96, 0.99), uSnow * smoothstep(0.25, 0.45, vTint.a));
        diffuseColor.rgb *= mc;`).replace('#include <fog_fragment>', `
        // aerial haze: these are far beyond the fog, but should still sit back in the air
        vec3 mdir = vMW - cameraPosition;
        float mh = ${haze.toFixed(2)} * (1.0 - 0.35 * smoothstep(0.0, 0.25, normalize(mdir).y));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, meadowHaze(uHaze, uGlow, mdir, uSun), mh);
        #include <fog_fragment>`);
  };
  m.customProgramCacheKey = () => 'mountain' + haze;
  return m;
}

/** A soft wall of mist: thick at the bottom, thinning upward, fading at the ends of each band. */
function mistTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  const rr = mulberry32(4242);
  for (let i = 0; i < 70; i++) {
    const x = rr() * 256, y = 40 + rr() * 22, s = 14 + rr() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
    [x - 256, x + 256].forEach((xx) => { const g2 = ctx.createRadialGradient(xx, y, 0, xx, y, s); g2.addColorStop(0, 'rgba(255,255,255,0.22)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, 256, 64); });
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export const mistMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uMist: mountainU.uMist, uMistAmt: mountainU.uMistAmt },
  transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D map; uniform vec3 uMist; uniform float uMistAmt; varying vec2 vUv;
    void main() {
      float a = texture2D(map, vec2(vUv.x * 6.0, vUv.y)).a * smoothstep(1.0, 0.35, vUv.y) * uMistAmt;
      gl_FragColor = vec4(uMist, a);
    }`,
});

export function buildMountains() {
  // two ranges: nearer, lower and hazier hills in front of the high snowy peaks
  scene.add(new THREE.Mesh(range(560, 160, 190, 360, 0), mountainMat(0.42)));
  scene.add(new THREE.Mesh(range(400, 90, 85, 300, 2.1), mountainMat(0.3)));
  mistMat.uniforms.map.value = mistTexture();
  [[385, 26, 0.9], [540, 40, 1]].forEach(([rad, h, k]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 96, 1, true).translate(0, h / 2 - 6, 0), mistMat);
    m.scale.setScalar(k);
    m.renderOrder = 1;
    scene.add(m);
  });
}

/** Once a frame: haze and mist follow the sky. */
export function tintMountains(cur, sunDir, snow) {
  mountainU.uHaze.value.copy(cur.horizon);
  mountainU.uGlow.value.copy(cur.glow);
  mountainU.uSun.value.copy(sunDir);
  mountainU.uSnow.value = snow;
  mountainU.uMist.value.copy(cur.horizon).lerp(cur.glow, 0.12);
  // mist is thickest at dawn and in the evening and night, thinnest at midday
  mountainU.uMistAmt.value = lerp(0.35, 0.85, Math.max(cur.eve, 1 - cur.day * 0.8));
}
