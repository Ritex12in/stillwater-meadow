// Distant snow-capped mountains all round the valley, and soft bands of mist lying at their feet.
// Far beyond the fog, so they carry their own haze: blue-grey on the shady side, warm toward the
// sun, the same as the sky's horizon. Built from a fixed random stream; nothing else moves.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, lerp, mulberry32, fbm } from '../core/math.js';

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
  let h = 0.2 + 0.1 * Math.sin(a * 5 + 1.3) + 0.06 * Math.sin(a * 13 + 0.4) + 0.03 * Math.sin(a * 31 + 2.1);
  for (const p of PEAKS) {
    let d = Math.abs(a - p.a); d = Math.min(d, TAU - d);
    const k = Math.max(0, 1 - d / p.w);
    // pointed summits with shoulders, not domes
    h = Math.max(h, p.h * (0.55 * k ** 1.25 + 0.45 * k ** 3) + 0.05 * Math.sin(a * 57 + p.a * 9) * k);
  }
  return h;
}
/** Ridged noise, 0..1 with sharp crests, seamless round the circle. */
const ridged = (a, t, f, tone) => 1 - Math.abs(2 * fbm(Math.cos(a) * f + tone, Math.sin(a) * f + t) - 1);

/** Height of a range's surface at angle `a` and depth `t` (0 front foot .. 1 back), as the mesh is built. */
export function rangeHeight(R, a, t) {
  const top = ridge(a + R.tone) * R.height;
  const tt = Math.min(t * 1.25, 1);
  const prof = 1 - Math.abs(1 - 2 * tt) ** (R.forest ? 1.8 : 1.35);     // a crest, not a dome
  // spurs and gullies running down from the ridge, strongest mid-slope
  const spurs = (ridged(a, t * 1.5, 13, R.tone) - 0.5) * 0.3 * top * Math.sin(Math.PI * tt) ** 0.6;
  const jag = (ridged(a, 3, 22, R.tone + 7) - 0.5) * 0.09 * top * prof;  // a broken skyline
  return -8 + prof * (top + 8) + spurs + jag;
}
/** The ranges, far to near: high snowy peaks, lower rocky hills, and dark forested ridges in front. */
export const RANGES = [
  { radius: 600, depth: 190, height: 235, seg: 420, tone: 0, haze: 0.5, snowLine: 0.42 },
  { radius: 420, depth: 110, height: 105, seg: 360, tone: 2.1, haze: 0.36, snowLine: 0.78 },
  { radius: 265, depth: 90, height: 46, seg: 300, tone: 4.4, haze: 0.2, snowLine: 9, forest: true },
];

function range(R) {
  const rows = 30, pos = [], hk = [], idx = [];
  for (let i = 0; i <= R.seg; i++) {
    const a = (i / R.seg) * TAU;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), rr = R.radius + t * R.depth, y = rangeHeight(R, a, t); // t: 0 front foot .. 1 back
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      hk.push(y / R.height);
    }
  }
  for (let i = 0; i < R.seg; i++) for (let j = 0; j < rows - 1; j++) {
    const a = i * rows + j, b = (i + 1) * rows + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aHk', new THREE.Float32BufferAttribute(hk, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Rock, snow and forest painted per pixel: forest on the lower slopes, banded rock above, snow
 * above the snow line where the slope will hold it (lower and fuller in winter), and blue shade
 * in the gullies. Then the aerial haze that sets each range back in the air.
 */
function mountainMat(R) {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', fog: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mountainU);
    sh.vertexShader = 'attribute float aHk;\nvarying float vHk;\nvarying vec3 vMW;\nvarying vec3 vMN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vHk = aHk; vMW = (modelMatrix * vec4(transformed, 1.0)).xyz; vMN = normal;`);
    sh.fragmentShader = `uniform vec3 uHaze; uniform vec3 uGlow; uniform vec3 uSun; uniform float uSnow;
      varying float vHk; varying vec3 vMW; varying vec3 vMN;
      float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float mNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mHash(i), mHash(i + vec2(1.0, 0.0)), f.x), mix(mHash(i + vec2(0.0, 1.0)), mHash(i + vec2(1.0, 1.0)), f.x), f.y); }
    ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 n = normalize(vMN);
          float n1 = mNoise(vMW.xz * 0.02 + vMW.y * 0.03), n2 = mNoise(vMW.xz * 0.09), n3 = mNoise(vec2(vMW.y * 0.22, dot(vMW.xz, vec2(0.01, 0.013))));
          // rock: cool grey with warmer strata and darker steep faces
          vec3 rock = mix(vec3(0.42, 0.45, 0.52), vec3(0.56, 0.52, 0.5), n3) * (0.8 + 0.3 * n2) * mix(0.72, 1.0, smoothstep(0.35, 0.8, n.y));
          vec3 forest = mix(vec3(0.16, 0.27, 0.2), vec3(0.24, 0.36, 0.22), n2) * (0.85 + 0.3 * n1);
          float treeLine = ${R.forest ? '9.0' : '0.24'} + (n1 - 0.5) * 0.16;
          vec3 mc = mix(forest, rock, smoothstep(treeLine - 0.05, treeLine + 0.07, vHk));
          // snow: above the line (ragged), where the slope holds it; winter brings it right down
          float line = mix(${R.snowLine.toFixed(2)}, ${R.forest ? '0.55' : '0.12'}, uSnow) + (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.1;
          float snow = smoothstep(line - 0.03, line + 0.06, vHk) * smoothstep(0.22, 0.5, n.y + (n2 - 0.5) * 0.3);
          mc = mix(mc, mix(vec3(0.8, 0.86, 0.98), vec3(1.0), smoothstep(0.4, 0.85, n.y)), snow);
          diffuseColor.rgb *= mc * 1.25;
        }`).replace('#include <fog_fragment>', `
        // aerial haze: these are far beyond the fog, but should still sit back in the air
        vec3 mdir = vMW - cameraPosition;
        float mh = ${R.haze.toFixed(2)} * (1.0 - 0.3 * smoothstep(0.0, 0.3, normalize(mdir).y));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, meadowHaze(uHaze, uGlow, mdir, uSun), mh);
        #include <fog_fragment>`);
  };
  m.customProgramCacheKey = () => 'mountain' + R.radius;
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
  RANGES.forEach((R) => scene.add(new THREE.Mesh(range(R), mountainMat(R))));
  mistMat.uniforms.map.value = mistTexture();
  [[258, 16, 1], [405, 30, 1], [585, 46, 1]].forEach(([rad, h, k]) => {
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
