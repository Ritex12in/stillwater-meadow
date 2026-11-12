// Gradient sky dome with sun, a phased moon, and stars.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { rng, rand, TAU } from '../core/math.js';

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
      fragmentShader: `
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
          c += sunColor * (pow(s, 5.0) * 0.16 + pow(s, 40.0) * 0.3) * (1.0 - 0.4 * max(h, 0.0));
          c = mix(c, vec3(1.0, 0.97, 0.9) * (0.6 + 0.6 * sunColor), smoothstep(0.99935, 0.9997, s) * above);
          // moon: a disc lit from one side according to its phase
          vec3 md = normalize(moonDir);
          float m = max(dot(d, md), 0.0);
          float illum = 0.5 - 0.5 * cos(moonPhase * 6.2831853);
          c += vec3(0.5, 0.58, 0.8) * (pow(m, 60.0) * 0.22 + pow(m, 8.0) * 0.05) * moonAmt * above * (0.25 + 0.75 * illum);
          vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
          vec3 up = cross(right, md);
          vec3 off = d - md * dot(d, md);
          float R = 0.027;                        // angular radius of the disc drawn below
          vec2 q = vec2(dot(off, right), dot(off, up)) / R;
          float disc = smoothstep(0.99955, 0.99975, m);
          float z = sqrt(max(0.0, 1.0 - dot(q, q)));
          float a = moonPhase * 6.2831853;
          vec3 sunSide = vec3(sin(a), 0.0, -cos(a));  // lit hemisphere turns as the phase advances
          float lit = smoothstep(-0.08, 0.08, dot(vec3(q, z), sunSide));
          vec3 moonCol = mix(vec3(0.16, 0.18, 0.24), vec3(0.97, 0.95, 0.87), lit);
          c = mix(c, moonCol, disc * moonAmt * above);
          gl_FragColor = vec4(c, 1.0);
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
}

/** Moon phase for a date: 0 = new, 0.5 = full. */
export function moonPhaseOn(date) {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNew) / 86400000;
  return ((days / synodic) % 1 + 1) % 1;
}
