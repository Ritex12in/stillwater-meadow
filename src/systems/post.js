// Post-processing: a soft bloom that wakes up at dusk so lanterns, lamps, the campfire and the
// moon glow; and a depth-of-field pass for photo mode. Both are skipped entirely when idle.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

let composer = null, bloom = null, bokeh = null, renderer, scene, camera;
export const post = { bloom: 0, focus: false, focusDist: 8 };

export function initPost(r, s, c) {
  renderer = r; scene = s; camera = c;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.82);
  composer.addPass(bloom);
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
  const useBloom = bloomAllowed && post.bloom > 0.02;
  if (!useBloom && !post.focus) { renderer.render(scene, camera); return; }
  bloom.enabled = useBloom;
  bloom.strength = 0.55 * post.bloom;
  bokeh.enabled = post.focus;
  if (post.focus) bokeh.uniforms.focus.value = post.focusDist;
  composer.render();
}
