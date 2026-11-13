// The lake: sky reflection with Fresnel, layered waves, rain rings, shoreline foam and winter ice.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { LAKE } from '../core/shape.js';
import { skyU } from './sky.js';
import { GRADE_GLSL, HAZE_GLSL } from '../core/atmosphere.js';

export const waterU = {
  uTime: { value: 0 },
  deep: { value: new THREE.Color() },
  shallow: { value: new THREE.Color() },
  skyTop: skyU.topColor,
  skyHorizon: skyU.horizonColor,
  sunDir: { value: new THREE.Vector3(0, 1, 0) },   // sun by day, moon by night
  sunColor: { value: new THREE.Color() },
  fogColor: { value: new THREE.Color() },
  fogGlow: { value: new THREE.Color() },
  fogSun: { value: new THREE.Vector3(0, 1, 0) },
  fogNear: { value: 50 },
  fogFar: { value: 220 },
  lakeC: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
  uRain: { value: 0 },
  uIce: { value: 0 },
  uIceLight: { value: 1 },
  uSnowIce: { value: 0 },
  uLight: { value: 1 },
  lampW: { value: [] },          // lamp lanterns, world space (set in main.js)
  lampAmt: { value: 0 },
};

export function buildWater() {
  const geo = new THREE.CircleGeometry(48, 160);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: waterU,
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: GRADE_GLSL + HAZE_GLSL + `
      uniform float uTime; uniform float uRain; uniform float uIce; uniform float uIceLight; uniform float uSnowIce; uniform float uLight;
      uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyTop; uniform vec3 skyHorizon;
      uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 fogColor; uniform vec3 fogGlow; uniform vec3 fogSun;
      uniform float fogNear; uniform float fogFar; uniform vec2 lakeC;
      uniform vec3 lampW[12]; uniform float lampAmt;
      varying vec3 vWP;
      vec2 wave(vec2 p, vec2 d, float f, float s, float a) {
        return d * cos(dot(p, d) * f + uTime * s) * f * a;
      }
      float hash21(vec2 q) { q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
      vec2 ripples(vec2 p) {
        vec2 g = vec2(0.0);
        for (int k = 0; k < 3; k++) {
          float fk = float(k);
          vec2 q = p * 1.1 + fk * 17.3;
          vec2 id = floor(q);
          vec2 f = fract(q) - 0.5;
          float ph = fract(uTime * 0.8 + hash21(id + fk * 3.1));
          vec2 c = (vec2(hash21(id + 1.7), hash21(id + 5.3)) - 0.5) * 0.5;
          vec2 dv = f - c;
          float d = length(dv) + 1e-4;
          float r = ph * 0.45;
          g += dv / d * sin((d - r) * 45.0) * smoothstep(0.07, 0.0, abs(d - r)) * (1.0 - ph);
        }
        return g * 0.5;
      }
      float lakeT(vec2 p) {
        vec2 d = p - lakeC;
        float a = atan(d.y, d.x);
        float R = 30.0 + 4.0 * sin(3.0 * a) + 2.5 * cos(5.0 * a + 1.3) + 1.5 * sin(7.0 * a + 0.4);
        return length(d) / R;
      }
      void main() {
        vec2 p = vWP.xz;
        vec2 g = wave(p, normalize(vec2(1.0, 0.3)), 0.9, 1.1, 0.05)
               + wave(p, normalize(vec2(-0.4, 1.0)), 1.7, 1.7, 0.025)
               + wave(p, normalize(vec2(0.7, -0.8)), 3.1, 2.4, 0.012)
               + wave(p, normalize(vec2(-0.9, -0.2)), 5.3, 3.2, 0.006);
        g += ripples(p) * uRain * (1.0 - uIce);
        g *= 1.0 - uIce * 0.9;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWP);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 skyc = mix(skyHorizon, skyTop, pow(clamp(r.y, 0.0, 1.0), 0.5));
        float t = lakeT(p);
        vec3 base = mix(deep, shallow, smoothstep(0.5, 0.95, t));
        vec3 c = mix(base, skyc, clamp(fres * 0.85 + 0.12, 0.0, 1.0));
        float sp = pow(max(dot(r, normalize(sunDir)), 0.0), 220.0);
        c += sunColor * sp * 1.8;
        // the lamps' reflections: long wavering streaks of warm light across the water
        if (lampAmt > 0.01) {
          vec3 rs = normalize(vec3(r.x, r.y * 0.35, r.z)); // squashed: the streaks run toward you
          for (int i = 0; i < 12; i++) {
            vec3 L = lampW[i] - vWP;
            vec3 Ls = normalize(vec3(L.x, L.y * 0.35, L.z));
            float k = pow(max(dot(rs, Ls), 0.0), 3000.0);
            c += vec3(1.0, 0.66, 0.32) * k * 1.3 * lampAmt * (1.0 - uIce);
          }
        }
        // gentle foam where the water laps the shore
        float band = smoothstep(0.86, 0.95, t) * (1.0 - smoothstep(0.985, 1.03, t));
        float lap = 0.55 + 0.45 * sin(t * 140.0 - uTime * 1.3 + sin(p.x * 0.7 + p.y * 0.5) * 2.0);
        c = mix(c, vec3(0.93, 0.95, 0.96) * uLight, band * lap * 0.32 * (1.0 - uIce));
        // winter: pale ice, dusted with snow
        vec3 ice = mix(vec3(0.7, 0.8, 0.88), vec3(0.84, 0.9, 0.96), 0.45 + 0.18 * sin(p.x * 0.21 + sin(p.y * 0.13) * 2.0) + 0.12 * sin(p.y * 0.37 + p.x * 0.11)) * uIceLight;
        ice = mix(ice, vec3(0.94, 0.96, 1.0) * uIceLight, uSnowIce * (0.2 + 0.6 * smoothstep(0.3, 0.7, hash21(floor(p * 0.9)))));
        ice += sunColor * pow(max(dot(r, normalize(sunDir)), 0.0), 60.0) * 0.5;
        c = mix(c, ice, uIce);
        float dist = length(cameraPosition - vWP);
        c = mix(c, meadowHaze(fogColor, fogGlow, vWP - cameraPosition, fogSun), smoothstep(fogNear, fogFar, dist));
        gl_FragColor = vec4(meadowGrade(c), 1.0);
      }`,
  }));
  water.position.set(LAKE.x, 0.02, LAKE.z);
  water.receiveShadow = false;
  scene.add(water);
}
