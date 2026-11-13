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
  tRefl: { value: null },        // the mirrored scene (High quality), see renderReflection
  reflMat: { value: new THREE.Matrix4() },
  reflAmt: { value: 0 },
};

export function buildWater() {
  const geo = new THREE.CircleGeometry(48, 160);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: waterU,
    vertexShader: `
      uniform mat4 reflMat;
      varying vec3 vWP;
      varying vec4 vRefl;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        vRefl = reflMat * wp;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: GRADE_GLSL + HAZE_GLSL + `
      uniform float uTime; uniform float uRain; uniform float uIce; uniform float uIceLight; uniform float uSnowIce; uniform float uLight;
      uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyTop; uniform vec3 skyHorizon;
      uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 fogColor; uniform vec3 fogGlow; uniform vec3 fogSun;
      uniform float fogNear; uniform float fogFar; uniform vec2 lakeC;
      uniform vec3 lampW[12]; uniform float lampAmt;
      uniform sampler2D tRefl; uniform float reflAmt; varying vec4 vRefl;
      varying vec3 vWP;
      vec2 wave(vec2 p, vec2 d, float f, float s, float a) {
        return d * cos(dot(p, d) * f + uTime * s) * f * a;
      }
      float vn(vec2 q) {
        vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
        float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
        float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float ripH(vec2 q) {
        return vn(q * 0.55 + vec2(uTime * 0.11, uTime * 0.05)) * 0.5
             + vn(q * 1.3 - vec2(uTime * 0.09, -uTime * 0.13)) * 0.3
             + vn(q * 3.1 + vec2(-uTime * 0.21, uTime * 0.17)) * 0.14
             + vn(q * 7.0 + vec2(uTime * 0.3, uTime * 0.26)) * 0.06;
      }
      vec2 rippleGrad(vec2 q) {
        float e = 0.06, h0 = ripH(q);
        return vec2(ripH(q + vec2(e, 0.0)) - h0, ripH(q + vec2(0.0, e)) - h0) / e * 0.09;
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
        // soft, irregular ripples: a few octaves of drifting noise, plus a long gentle swell
        vec2 g = rippleGrad(p) + wave(p, normalize(vec2(1.0, 0.3)), 0.35, 0.6, 0.03);
        g += ripples(p) * uRain * (1.0 - uIce);
        g *= 1.0 - uIce * 0.9;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWP);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 skyc = mix(skyHorizon, skyTop, pow(clamp(r.y, 0.0, 1.0), 0.5));
        if (reflAmt > 0.0) {
          // the shore, trees and hills mirrored in the lake, wobbling with the waves
          vec4 ru = vRefl;
          ru.xy += g * ru.w * 0.06;
          skyc = mix(skyc, texture2DProj(tRefl, ru).rgb, reflAmt);
        }
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
  waterMesh = water;
}

// ── Reflections (after three's Reflector): the scene drawn from a camera mirrored in the water,
// into a texture the lake samples. Kept cheap: a third of the screen's resolution, no small plants
// (layer 1), and only redrawn every few frames (more often while the camera turns quickly). The
// waves wobble it anyway, so a slightly stale mirror can't be told apart. ──
let waterMesh = null, reflTarget = null, reflAge = 99;
const lastQ = new THREE.Quaternion(), lastP = new THREE.Vector3();
const virtual = new THREE.PerspectiveCamera(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
const N = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), camP = new THREE.Vector3(), look = new THREE.Vector3(), tgt = new THREE.Vector3(), rot = new THREE.Matrix4();
const FRU = new THREE.Frustum(), FMAT = new THREE.Matrix4(), LAKE_S = new THREE.Sphere(new THREE.Vector3(LAKE.x, 0, LAKE.z), 50);

/** Draw the reflection if the lake is on screen; `before`/`after` let lighting follow the mirrored view. */
export function renderReflection(renderer, scene, camera, on, before, after, every = 4) {
  waterU.reflAmt.value = 0;
  if (!on || !waterMesh) return;
  FRU.setFromProjectionMatrix(FMAT.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  if (!FRU.intersectsSphere(LAKE_S) || camera.position.y < 0.02) return;
  // skip this frame if the last mirror is recent and the camera has hardly moved
  const turned = 1 - Math.abs(lastQ.dot(camera.quaternion)), moved = lastP.distanceToSquared(camera.position);
  if (reflTarget && ++reflAge < every && turned < 2e-4 && moved < 0.25) { waterU.reflAmt.value = 0.9; return; }
  reflAge = 0; lastQ.copy(camera.quaternion); lastP.copy(camera.position);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const w = Math.max(2, Math.floor(size.x / 3)), h = Math.max(2, Math.floor(size.y / 3));
  if (!reflTarget) { reflTarget = new THREE.WebGLRenderTarget(w, h); reflTarget.texture.generateMipmaps = false; waterU.tRefl.value = reflTarget.texture; }
  if (reflTarget.width !== w || reflTarget.height !== h) reflTarget.setSize(w, h);
  P.set(LAKE.x, 0.02, LAKE.z);
  camP.setFromMatrixPosition(camera.matrixWorld);
  rot.extractRotation(camera.matrixWorld);
  look.set(0, 0, -1).applyMatrix4(rot).add(camP);
  // mirror the camera and the point it looks at in the (horizontal) water plane
  tgt.copy(look); tgt.y = 2 * P.y - look.y;
  virtual.position.set(camP.x, 2 * P.y - camP.y, camP.z);
  virtual.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
  virtual.lookAt(tgt);
  virtual.far = camera.far; virtual.near = camera.near;
  virtual.updateMatrixWorld();
  virtual.projectionMatrix.copy(camera.projectionMatrix);
  virtual.layers.set(0);
  const m = waterU.reflMat.value;
  m.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  m.multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);
  // oblique near plane at the water, so nothing below it is drawn
  plane.setFromNormalAndCoplanarPoint(N, P).applyMatrix4(virtual.matrixWorldInverse);
  clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  const e = virtual.projectionMatrix.elements;
  q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
  clip.multiplyScalar(2 / clip.dot(q));
  e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1; e[14] = clip.w;
  waterMesh.visible = false;
  if (before) before(virtual);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(reflTarget);
  renderer.clear();
  renderer.render(scene, virtual);
  renderer.setRenderTarget(prev);
  if (after) after(camera);
  waterMesh.visible = true;
  waterU.reflAmt.value = 0.9;
}
