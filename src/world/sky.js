// Gradient sky dome with sun, a phased moon, and a night sky drawn per pixel: stars that stay a
// pixel or two wide at any resolution and twinkle, a Milky Way band with dark dust lanes, and a
// moon with faint seas on its face.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { GRADE_GLSL } from '../core/atmosphere.js';

export const skyU = {
  topColor: { value: new THREE.Color() },
  horizonColor: { value: new THREE.Color() },
  sunColor: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) },
  moonDir: { value: new THREE.Vector3(0, 1, 0) },
  moonAmt: { value: 0 },
  moonPhase: { value: 0.5 },   // 0 new, 0.5 full, 1 new again
  stars: { value: 0 },         // how much of the night sky shows (0 by day or under cloud)
  uTime: { value: 0 },         // star twinkle clock (set with the lake's, so it slows with reduced motion)
  uPA: { value: 0.001 },       // the angle one screen pixel covers, so stars stay pin sharp
};

export let sky = null;

// GLSL for the night sky (hash noise only, so it also runs on WebGL 1)
const NIGHT_GLSL = `
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vn3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h33(i).x, h33(i + vec3(1.0, 0.0, 0.0)).x, f.x), mix(h33(i + vec3(0.0, 1.0, 0.0)).x, h33(i + vec3(1.0, 1.0, 0.0)).x, f.x), f.y),
             mix(mix(h33(i + vec3(0.0, 0.0, 1.0)).x, h33(i + vec3(1.0, 0.0, 1.0)).x, f.x), mix(h33(i + vec3(0.0, 1.0, 1.0)).x, h33(i + vec3(1.0, 1.0, 1.0)).x, f.x), f.y), f.z);
}
float fbm3(vec3 p) { return vn3(p) * 0.5 + vn3(p * 2.03 + 5.1) * 0.3 + vn3(p * 4.1 + 9.7) * 0.2; }
// one shell of stars: one candidate per cell of a grid laid over the sky, most of them too faint to see
vec3 starShell(vec3 d, float sc, float pw, float gain, float seed, float boost) {
  vec3 p = d * sc, h = h33(floor(p) + seed);
  vec3 q = fract(p) - 0.5 - (h - 0.5) * 0.5;
  float r0 = uPA * sc, r2 = dot(q, q) / (r0 * r0);          // distance in pixels, squared
  float b = pow(h.x, pw) * gain * boost;
  float tw = 0.75 + 0.25 * sin(uTime * (1.3 + h.y * 3.5) + h.z * 60.0);
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), h.z * h.z);
  return tint * b * tw * (exp(-r2 * 1.4) + exp(-r2 * 0.25) * 0.05);
}
vec3 nightSky(vec3 d) {
  // Milky Way: a warped band across the sky, brighter in a clumpy core, cut by dark dust lanes
  vec3 G = normalize(vec3(0.42, 0.38, 0.82));
  float f1 = fbm3(d * 3.0 + 1.7), f2 = fbm3(d * 7.5 + f1 * 2.0);
  float gw = dot(d, G) + (f1 - 0.5) * 0.16, band = exp(-gw * gw * 13.0);
  float core = band * smoothstep(0.3, 0.75, f1 * 0.5 + f2 * 0.6);
  float lane = smoothstep(0.45, 0.62, fbm3(d * 5.0 + vec3(9.0, 2.0, 5.0) + f2 * 1.2)) * exp(-gw * gw * 40.0);
  vec3 c = mix(vec3(0.09, 0.12, 0.24), vec3(0.2, 0.19, 0.24), smoothstep(0.45, 0.8, f2)) * (band * 0.25 + core * 0.55) * (1.0 - lane * 0.75);
  float boost = 1.0 + 1.5 * core;                            // more stars where the band is
  c += starShell(d, 150.0, 9.0, 0.55, 0.0, boost);
  c += starShell(d, 95.0, 15.0, 1.3, 17.3, boost);
  c += starShell(d, 52.0, 24.0, 2.6, 41.9, 1.0);
  return c * (1.0 - lane * 0.5);
}
`;

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
        uniform float stars; uniform float uTime; uniform float uPA;
        varying vec3 vDir;
        ` + NIGHT_GLSL + `
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float above = smoothstep(-0.01, 0.015, h);
          vec3 c = mix(horizonColor, topColor, pow(smoothstep(0.0, 1.0, max(h, 0.0)), 0.5));
          c = mix(c, horizonColor * 0.92, smoothstep(0.0, -0.3, h));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          if (stars > 0.01) c += nightSky(d) * stars * smoothstep(0.0, 0.12, h);
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
          float maria = fbm3(vec3(q * 2.6, 3.0));               // darker seas on the bright side
          vec3 moonCol = mix(vec3(0.16, 0.18, 0.24), vec3(0.97, 0.95, 0.87) * (1.0 - 0.2 * smoothstep(0.4, 0.68, maria)), lit);
          c = mix(c, moonCol, disc * moonAmt * above);
          gl_FragColor = vec4(meadowGrade(c), 1.0);
        }`,
    })
  );
  sky.renderOrder = -1;
  // keep the stars one or two pixels wide whatever the resolution or zoom
  const px = new THREE.Vector2();
  sky.onBeforeRender = (renderer, _scene, cam) => {
    if (!cam.isPerspectiveCamera) return;
    renderer.getDrawingBufferSize(px);
    skyU.uPA.value = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / cam.zoom) / 2) / Math.max(px.y, 1);
  };
  scene.add(sky);
}

/** Moon phase for a date: 0 = new, 0.5 = full. */
export function moonPhaseOn(date) {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNew) / 86400000;
  return ((days / synodic) % 1 + 1) % 1;
}
