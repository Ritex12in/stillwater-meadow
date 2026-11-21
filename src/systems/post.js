// Post-processing: a soft bloom that wakes up at dusk so lanterns, lamps, the campfire and the
// moon glow; sunbeams when you look toward a low sun; and a depth-of-field pass for photo mode.
// All are skipped entirely when idle.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Sunbeams: bright sky seen through gaps (between leaves, over ridges) smeared toward the sun.
const RaysShader = {
  uniforms: { tDiffuse: { value: null }, sunPos: { value: new THREE.Vector2(0.5, 0.5) }, strength: { value: 0 }, tint: { value: new THREE.Color(1, 0.9, 0.7) }, aspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 sunPos; uniform float strength; uniform vec3 tint; uniform float aspect; varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 delta = (vUv - sunPos) / 40.0 * 0.85;
      vec2 c = vUv;
      float decay = 1.0, sum = 0.0;
      for (int i = 0; i < 40; i++) {
        c -= delta;
        vec3 s = texture2D(tDiffuse, clamp(c, 0.0, 1.0)).rgb;
        sum += max(dot(s, vec3(0.3, 0.59, 0.11)) - 0.66, 0.0) * decay;
        decay *= 0.955;
      }
      // fade with distance from the sun on screen, so the rays fan out from it and die away
      vec2 d = (vUv - sunPos) * vec2(aspect, 1.0);
      float fall = 1.0 - smoothstep(0.0, 1.1, length(d));
      gl_FragColor = vec4(base.rgb + tint * sum * 0.16 * strength * fall, base.a);
    }`,
};

let composer = null, bloom = null, bokeh = null, rays = null, renderer, scene, camera;
export const post = { bloom: 0, focus: false, focusDist: 8, rays: 0, sunPos: new THREE.Vector2(), raysTint: new THREE.Color() };

export function initPost(r, s, c) {
  renderer = r; scene = s; camera = c;
  // render into a multisampled target where WebGL 2 allows, so edges stay smooth with effects on
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = renderer.capabilities.isWebGL2
    ? new THREE.WebGLMultisampleRenderTarget(size.x, size.y, { format: THREE.RGBAFormat })
    : undefined;
  // (a 24-bit depth buffer: the default for such a target is 16-bit, far too coarse for ground kilometres away)
  if (target) target.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.82);
  composer.addPass(bloom);
  rays = new ShaderPass(RaysShader);
  composer.addPass(rays);
  bokeh = new BokehPass(scene, camera, { focus: 8, aperture: 0.0012, maxblur: 0.012, width: window.innerWidth, height: window.innerHeight });
  composer.addPass(bokeh);
  resizePost();
}

export function resizePost() {
  if (!composer) return;
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
}

/** Render the frame, through the composer only when an effect is actually on. */
export function renderFrame(bloomAllowed) {
  const useBloom = bloomAllowed && post.bloom > 0.02, useRays = bloomAllowed && post.rays > 0.02;
  if (!useBloom && !post.focus && !useRays) { renderer.render(scene, camera); return; }
  bloom.enabled = useBloom;
  rays.enabled = useRays;
  if (useRays) {
    rays.uniforms.sunPos.value.copy(post.sunPos);
    rays.uniforms.strength.value = post.rays;
    rays.uniforms.tint.value.copy(post.raysTint);
    rays.uniforms.aspect.value = window.innerWidth / window.innerHeight;
  }
  bloom.strength = 0.55 * post.bloom;
  bokeh.enabled = post.focus;
  if (post.focus) bokeh.uniforms.focus.value = post.focusDist;
  composer.render();
}
