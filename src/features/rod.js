// The fishing rod is earned. You start without one; the skipper will trade his old rod for a
// proper bouquet: a full one, with at least three kinds of flower. In winter, when there are no
// flowers, he asks for five pine cones from under the pines instead. Once given, the rod is yours
// for good (saved). Old saves that already have catches in the journal keep their rod.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, mulberry32 } from '../core/math.js';
import { heightAt } from '../core/shape.js';
import { std } from '../core/materials.js';
import { hooks, seasonState } from '../core/state.js';
import { player } from '../characters/player.js';
import { ferry, sk, skipper } from '../characters/boat.js';
import { treeSpots } from '../world/vegetation.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { toast } from '../ui/hud.js';

export const BOUQUET_FULL = 12, BOUQUET_KINDS = 3, CONES_NEEDED = 5;

/** Does the player own the rod? */
export const hasRod = () => !!store.rod;
let coneView = () => [];
/** For tests: the pine cones still lying about, and whether they are showing. */
export const rodView = () => ({ rod: !!store.rod, cones: store.cones || 0, lying: coneView() });
const winter = () => seasonState.name === 'Winter';

/** What the skipper thinks of a bouquet (array of "#colour:kind"), when you have no rod yet. */
export function judgeBouquet(bouquet) {
  const kinds = new Set(bouquet.map((b) => String(b).split(':')[1] || '?')).size;
  if (bouquet.length >= BOUQUET_FULL && kinds >= BOUQUET_KINDS) return { ok: true };
  if (bouquet.length < BOUQUET_FULL) return { ok: false, why: `"A few more flowers, I think. A full bouquet: ${BOUQUET_FULL} stems."` };
  return { ok: false, why: `"Pretty, but all the same. Mix in at least ${BOUQUET_KINDS} kinds of flower."` };
}

/** Hand over the rod (called by whichever gift earned it). */
export function giveRod(how) {
  store.rod = true;
  saveSoon();
  sk.nod = 1; sk.waveT = 2;
  toast(`The skipper takes the ${how} with a grin and hands you his old fishing rod. Press R by the water to cast.`, 6);
}

const skipperPos = new THREE.Vector3();
export function nearSkipper(range = 3.2) {
  skipper.root.getWorldPosition(skipperPos);
  return ferry.state === 'docked' && Math.hypot(skipperPos.x - player.x, skipperPos.z - player.z) < range;
}

export function initRod() {
  if (!store.rod && store.journal && Object.keys(store.journal).length) store.rod = true; // older saves

  // the skipper says what he wants the first time you come near without a rod
  let told = false;
  hooks.frame.push(() => {
    if (store.rod || told || !nearSkipper(4)) return;
    told = true;
    toast(winter()
      ? `The skipper: "No flowers this time of year. Bring me ${CONES_NEEDED} pine cones from under the pines and my old rod is yours."`
      : `The skipper: "Fancy fishing? Bring me a proper bouquet, ${BOUQUET_FULL} flowers of at least ${BOUQUET_KINDS} kinds, and my old rod is yours."`, 7);
  });

  // ── winter: pine cones under the pines, only while you still need them ──
  const r = mulberry32(7310);
  const pines = treeSpots.filter((t) => t.type === 'pine' && Math.hypot(t.x, t.z) < 80);
  const coneGeo = new THREE.ConeGeometry(0.07, 0.17, 7).rotateZ(Math.PI / 2);
  const coneMat = std('#7a5232');
  const cones = [];
  for (let i = 0; i < 18 && pines.length; i++) {
    const t = pines[Math.floor(r() * pines.length)], a = r() * TAU, d = 0.9 + r() * 1.2;
    const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
    const m = new THREE.Mesh(coneGeo, coneMat);
    m.position.set(x, heightAt(x, z) + 0.05, z); m.rotation.y = r() * TAU; m.castShadow = true;
    m.visible = false;
    scene.add(m);
    cones.push({ m, x, z, taken: false });
  }
  store.cones = store.cones || 0;
  coneView = () => cones.filter((c) => !c.taken).map((c) => ({ x: c.x, z: c.z, shown: c.m.visible }));
  let nearCone = null;
  registerAction({
    id: 'pick-cone', key: 'KeyG', keyLabel: 'G', score: () => 15,
    available: () => activity.free && nearCone,
    label: () => `Pick up a pine cone (${store.cones}/${CONES_NEEDED})`,
    run: () => {
      if (!nearCone) return;
      nearCone.taken = true; nearCone.m.visible = false;
      store.cones++; saveSoon();
      player.pickT = 0.6;
      if (store.cones === CONES_NEEDED) toast('That makes five pine cones. Take them to the skipper at the jetty.', 4.5);
    },
  });
  registerAction({
    id: 'give-cones', key: 'KeyG', keyLabel: 'G', score: () => 11,
    available: () => activity.free && !store.rod && winter() && store.cones > 0 && nearSkipper(),
    label: () => 'Give the pine cones to the skipper',
    run: () => {
      if (store.cones < CONES_NEEDED) { toast(`The skipper: "That's ${store.cones}. I'll need ${CONES_NEEDED}."`, 4); return; }
      store.cones = 0;
      giveRod('pine cones');
    },
  });
  let scanIn = 0;
  hooks.frame.push((dt) => {
    const want = winter() && !store.rod && store.cones < CONES_NEEDED;
    for (const c of cones) c.m.visible = want && !c.taken;
    scanIn -= dt;
    if (scanIn > 0) return;
    scanIn = 0.15;
    nearCone = null;
    if (!want) return;
    let best = 1.3;
    for (const c of cones) {
      if (c.taken) continue;
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      if (d < best) { best = d; nearCone = c; }
    }
  });
}
