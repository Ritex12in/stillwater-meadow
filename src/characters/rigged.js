// An imported, rigged and animated character standing in for the code-built one (milestone 6, first
// step: shown to the owner before anything else is rewired). The model is KayKit's Rogue from the
// "Adventurers" pack (CC0, Kay Lousberg: public/assets/characters/kaykit/LICENSE.txt), a fully rigged
// glTF with 76 animations. Turn it on with `?hero=kaykit`; the code-built figure is then hidden (it
// still runs underneath, so everything that reads its pose keeps working) and this one follows the
// player, choosing its animation from what the player is doing, with short cross-fades.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from '../core/render.js';
import { query } from '../core/env.js';

/** Is the imported character asked for? */
export const RIGGED = query.get('hero') === 'kaykit';
/** How tall it stands in the meadow (m): a child's height, like the figure it replaces. */
const HEIGHT = 1.3;
// the adventurer's weapons are not for this world
const HIDE = /Knife|Crossbow|Throwable|Spellbook|Staff|Wand|Sword|Axe|Shield|Mug/i;

/** Load a character (by file name) and get it ready: { root, mixer, play(name), hand }. Resolves null if it cannot be loaded. */
export async function loadRigged(file = 'Rogue') {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/characters/kaykit/${file}.glb`).catch((e) => { console.error('rigged', e); return null; });
  if (!gltf) return null;
  const model = gltf.scene;
  model.traverse((o) => { if (HIDE.test(o.name)) o.visible = false; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const box = new THREE.Box3().setFromObject(model), s = HEIGHT / Math.max(0.01, box.max.y - box.min.y);
  model.scale.setScalar(s);
  const root = new THREE.Group();
  root.add(model);
  scene.add(root);
  const mixer = new THREE.AnimationMixer(model), clips = {};
  for (const c of gltf.animations) clips[c.name] = mixer.clipAction(c);
  let current = null;
  const play = (name, fade = 0.25) => {
    const next = clips[name] || clips.Idle;
    if (!next || next === current) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = next;
  };
  play('Idle', 0);
  let hand = null;
  model.traverse((o) => { if (o.name === 'handslot.r') hand = o; });
  return { root, mixer, play, hand, clips: Object.keys(clips) };
}

/**
 * Follow the player each frame: where they are, which way they face, and an animation for what
 * they are doing. `p` is the player's state (characters/player.js); `c`: { act: the activity,
 * ground: how far into sitting on the grass, emote: the emote showing (wave, cheer, dance) }.
 */
export function followPlayer(r, p, dt, c) {
  r.root.position.set(p.x, p.y, p.z);
  r.root.rotation.y = p.rot;
  let anim = 'Idle';
  if (p.lieAmt > 0.6) anim = 'Lie_Idle';
  else if (p.seat && p.sitAmt > 0.6) anim = 'Sit_Chair_Idle';
  else if (c.ground > 0.6) anim = 'Sit_Floor_Idle';
  else if (p.pickT > 0) anim = 'PickUp';
  else if (p.petAmt > 0.3) anim = 'Interact';
  else if (c.act === 'fish') anim = 'Use_Item';
  else if (c.emote === 'wave' || c.emote === 'cheer' || c.emote === 'dance') anim = 'Cheer';
  else if (p.move > 3.2) anim = 'Running_A';
  else if (p.move > 0.3) anim = p.skating ? 'Walking_C' : 'Walking_A';
  r.play(anim);
  r.mixer.update(dt);
}
