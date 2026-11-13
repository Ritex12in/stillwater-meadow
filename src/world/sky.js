// Gradient sky dome with sun, a phased moon, and stars.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { GRADE_GLSL } from '../core/atmosphere.js';
import { rng, rand, TAU, mulberry32 } from '../core/math.js';

export const skyU = {
  topColor: { value: new THREE.Color() },
  horizonColor: { value: new THREE.Color() },
  sunColor: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) },
  moonDir: { value: new THREE.Vector3(0, 1, 0) },
  moonAmt: { value: 0 },
  moonPhase: { value: 0.5 },   // 0 new, 0.5 full, 1 new again
};

export let sky = null;
export const starMat = new THREE.PointsMaterial({ size: 1.6 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });

export function buildSky() {
  sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 18),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: GRADE_GLSL + `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDir;
        uniform vec3 moonDir; uniform float moonAmt; uniform float moonPhase;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float above = smoothstep(-0.01, 0.015, h);
          vec3 c = mix(horizonColor, topColor, pow(smoothstep(0.0, 1.0, max(h, 0.0)), 0.5));
          c = mix(c, horizonColor * 0.92, smoothstep(0.0, -0.3, h));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 5.0) * 0.16 + pow(s, 40.0) * 0.3 + pow(s, 2.0) * 0.08) * (1.0 - 0.4 * max(h, 0.0)); // same glow as meadowHaze (core/atmosphere.js)
          c = mix(c, vec3(1.0, 0.97, 0.9) * (0.6 + 0.6 * sunColor), smoothstep(0.99935, 0.9997, s) * above);
          // moon: a disc lit from one side according to its phase
          vec3 md = normalize(moonDir);
          float m = max(dot(d, md), 0.0);
          float illum = 0.5 - 0.5 * cos(moonPhase * 6.2831853);
          c += vec3(0.55, 0.64, 0.9) * (pow(m, 400.0) * 0.5 + pow(m, 60.0) * 0.3 + pow(m, 8.0) * 0.08) * moonAmt * above * (0.25 + 0.75 * illum);
          vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
          vec3 up = cross(right, md);
          vec3 off = d - md * dot(d, md);
          float R = 0.042;                        // angular radius of the disc drawn below
          vec2 q = vec2(dot(off, right), dot(off, up)) / R;
          float disc = smoothstep(0.99905, 0.99918, m);
          float z = sqrt(max(0.0, 1.0 - dot(q, q)));
          float a = moonPhase * 6.2831853;
          vec3 sunSide = vec3(sin(a), 0.0, -cos(a));  // lit hemisphere turns as the phase advances
          float lit = smoothstep(-0.08, 0.08, dot(vec3(q, z), sunSide));
          vec3 moonCol = mix(vec3(0.16, 0.18, 0.24), vec3(0.97, 0.95, 0.87), lit);
          c = mix(c, moonCol, disc * moonAmt * above);
          gl_FragColor = vec4(meadowGrade(c), 1.0);
        }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  const pos = [], cols = [];
  for (let i = 0; i < 1500; i++) {
    const y = Math.pow(rng(), 0.8) * 0.98 + 0.02, a = rng() * TAU, r = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * r * 650, y * 650, Math.sin(a) * r * 650);
    const b = rand(0.45, 1), warm = rng() < 0.2 ? 0.88 : 1;
    cols.push(b, b * (warm < 1 ? 0.95 : 1), b * warm);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const stars = new THREE.Points(g, starMat);
  stars.frustumCulled = false;
  sky.add(stars);
  // a second, fainter field (its own random stream, so the layout stream is untouched), denser in
  // a band across the sky like the Milky Way
  const r = mulberry32(9001), p2 = [], c2 = [];
  for (let i = 0; i < 3500; i++) {
    let x = r() * 2 - 1, y = r(), z = r() * 2 - 1;
    if (i % 2) { const t = r() * TAU; x = Math.cos(t); z = Math.sin(t) * 0.35 + (r() - 0.5) * 0.25; y = 0.25 + Math.abs(Math.sin(t)) * 0.7 + (r() - 0.5) * 0.15; }
    const l = Math.hypot(x, y, z) || 1;
    if (y / l < 0.03) continue;
    p2.push(x / l * 640, y / l * 640, z / l * 640);
    const b = 0.25 + r() * r() * 0.6;
    c2.push(b * 0.92, b * 0.95, b);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
  g2.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
  const faint = new THREE.Points(g2, starMat);
  faint.frustumCulled = false;
  sky.add(faint);
}

/** Moon phase for a date: 0 = new, 0.5 = full. */
export function moonPhaseOn(date) {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNew) / 86400000;
  return ((days / synodic) % 1 + 1) % 1;
}
