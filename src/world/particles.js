// Falling particles (rain, snow, leaves, petals) animated entirely on the GPU. Each particle has a
// seed position inside a box; the shader moves it by the accumulated fall and drift and wraps it
// around the camera, so thousands of drops cost nothing on the CPU.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { rnd, TAU } from '../core/math.js';

const vertex = `
  uniform vec3 uCam; uniform vec3 uBox; uniform float uFall; uniform vec2 uDrift; uniform float uTime;
  uniform float uSway; uniform float uStretch; uniform vec2 uSlant; uniform float uSize; uniform float uScale;
  attribute vec3 aSeed; attribute float aSpeed; attribute float aPhase; attribute float aTail;
  varying vec3 vColor; varying float vTail;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = aSeed;
    p.y -= aSpeed * uFall;
    p.xz += uDrift * (0.7 + 0.3 * aSpeed);
    p.x += sin(uTime * 0.8 + aPhase) * uSway;
    p.z += cos(uTime * 0.6 + aPhase * 1.3) * uSway * 0.6;
    vec3 lo = uCam - vec3(uBox.x * 0.5, uBox.y * 0.38, uBox.z * 0.5);
    p = mod(p - lo, uBox) + lo;
    p.y += aTail * uStretch;            // rain streaks: second vertex trails above
    p.xz -= aTail * uSlant;
    #ifdef USE_COLOR
      vColor = color;
    #else
      vColor = vec3(1.0);
    #endif
    vTail = aTail;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * uScale / max(-mvPosition.z, 0.1);
    #include <fog_vertex>
  }`;
const fragment = `
  uniform vec3 uTint; uniform float uOpacity; uniform sampler2D uMap; uniform float uPoints;
  varying vec3 vColor; varying float vTail;
  #include <fog_pars_fragment>
  void main() {
    float a = uOpacity;
    if (uPoints > 0.5) a *= texture2D(uMap, gl_PointCoord).a;
    else a *= 1.0 - vTail * 0.7;
    gl_FragColor = vec4(uTint * vColor, a);
    #include <fog_fragment>
  }`;

/**
 * @param {{ count: number, box: number[], speed: number[], lines?: boolean, size?: number, map?: THREE.Texture, colors?: string[] }} o
 */
export function makeFalling(o) {
  const n = o.count, verts = o.lines ? 2 : 1;
  const seeds = new Float32Array(n * verts * 3), speeds = new Float32Array(n * verts), phases = new Float32Array(n * verts), tails = new Float32Array(n * verts);
  const colors = o.colors ? new Float32Array(n * verts * 3) : null;
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const sx = rnd(0, o.box[0]), sy = rnd(0, o.box[1]), sz = rnd(0, o.box[2]), sp = rnd(o.speed[0], o.speed[1]), ph = rnd(0, TAU);
    if (colors) c.set(o.colors[i % o.colors.length]);
    for (let v = 0; v < verts; v++) {
      const k = i * verts + v;
      seeds[k * 3] = sx; seeds[k * 3 + 1] = sy; seeds[k * 3 + 2] = sz;
      speeds[k] = sp; phases[k] = ph; tails[k] = v;
      if (colors) { colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b; }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * verts * 3), 3)); // unused; required by three
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aTail', new THREE.BufferAttribute(tails, 1));
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...o.box) }, uFall: { value: 0 }, uDrift: { value: new THREE.Vector2() },
      uTime: { value: 0 }, uSway: { value: o.sway || 0 }, uStretch: { value: o.stretch || 0 }, uSlant: { value: new THREE.Vector2() },
      uSize: { value: o.size || 0.15 }, uScale: { value: window.innerHeight / 2 }, uTint: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0 },
      uMap: { value: o.map || null }, uPoints: { value: o.lines ? 0 : 1 },
    }]),
    vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, fog: true, vertexColors: !!colors,
  });
  const obj = o.lines ? new THREE.LineSegments(geo, mat) : new THREE.Points(geo, mat);
  obj.frustumCulled = false;
  obj.visible = false;
  scene.add(obj);
  let fall = 0;
  const drift = new THREE.Vector2();
  const max = n;
  return {
    obj, u: mat.uniforms,
    /** amount 0..1 of the particles to draw; fallRate and drift in metres per second. */
    update(dt, t, cam, amount, fallRate, driftX, driftZ) {
      const count = Math.floor(max * Math.min(1, amount));
      obj.visible = count > 0;
      if (!obj.visible) return;
      fall = (fall + fallRate * dt) % 100000;
      drift.x = (drift.x + driftX * dt) % 100000;
      drift.y = (drift.y + driftZ * dt) % 100000;
      mat.uniforms.uFall.value = fall;
      mat.uniforms.uDrift.value.copy(drift);
      mat.uniforms.uTime.value = t % 20000;
      mat.uniforms.uCam.value.copy(cam);
      geo.setDrawRange(0, count * verts);
    },
    resize(h) { mat.uniforms.uScale.value = h / 2; },
  };
}
