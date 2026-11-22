// A sea of cloud in the valleys below the windy cliffs (core/shape.js cliffsAt): a soft layer at a
// fixed height, drifting slowly, seen when you stand high above it in that country. One wide plane
// that follows the camera, faded in and out by where you are.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { cliffsAt } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { cur } from '../systems/time.js';

/** The height of the cloud's top (m). */
const SEA = 26;
export function initCloudSea() {
  const u = { uTime: { value: 0 }, uAmt: { value: 0 }, uLight: { value: 1 }, uTint: { value: new THREE.Color('#ffffff') } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform float uAmt; uniform float uLight; uniform vec3 uTint; varying vec2 vP;
      float h(vec2 p) { return fract(sin(dot(mod(p, 512.0), vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        vec2 p = vP * 0.012 + vec2(uTime * 0.01, uTime * 0.004);
        float c = n(p) * 0.5 + n(p * 2.1 + 3.0) * 0.3 + n(p * 4.3 + 7.0) * 0.2;
        float a = smoothstep(0.32, 0.62, c) * uAmt;
        gl_FragColor = vec4(uTint * uLight * (0.88 + 0.12 * c), a * 0.92);
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), mat);
  sea.position.y = SEA; sea.renderOrder = 2; sea.frustumCulled = false; sea.visible = false;
  scene.add(sea);
  let lookIn = 0, want = 0;
  hooks.frame.push((dt, t, camera) => {
    lookIn -= dt;
    if (lookIn <= 0) { lookIn = 1; want = cliffsAt(camera.position.x, camera.position.z) > 0.35 && camera.position.y > SEA + 12 ? 1 : 0; }
    u.uAmt.value += (want - u.uAmt.value) * Math.min(1, dt * 0.5);
    sea.visible = u.uAmt.value > 0.01;
    if (!sea.visible) return;
    sea.position.x = camera.position.x; sea.position.z = camera.position.z;
    u.uTime.value = t;
    u.uLight.value = 0.35 + 0.65 * Math.max(cur.day, 0.15);
  });
}
