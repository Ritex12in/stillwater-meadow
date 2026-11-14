// Pick flowers (G), carry a bouquet, give it to the skipper or leave it on the bench.
// Picked flowers grow back after a few minutes; there are fewer in autumn and none in winter.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { lerp } from '../core/math.js';
import { heightAt } from '../core/shape.js';
import { std, bothSides } from '../core/materials.js';
import { flowerHeadGeos, flowerCentreGeo, FLOWER_KINDS, FLOWER_CENTRE, BOUQUET_SHAPE, STEM_H } from '../world/detail.js';
import { clock } from '../core/clock.js';
import { hooks, seats, seasonState, world } from '../core/state.js';
import { player, hero } from '../characters/player.js';
import { boat, sk } from '../characters/boat.js';
import { hasRod, judgeBouquet, nearSkipper, giveRod } from './rod.js';
import { friendNear, giftFriend } from './friend.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { store, saveSoon, onSave } from '../systems/save.js';
import { toast } from '../ui/hud.js';

const MAX = 12, REGROW = 240;
let debugView = () => [];
/** For tests: every flower with whether it is currently shown. */
export const flowerView = () => debugView();
const headGeos = flowerHeadGeos(), centreGeo = flowerCentreGeo();
const stemMat = std('#4f7a36'), wrapMat = std('#f2e6cf', { side: THREE.DoubleSide });

function buildBouquet(colors) {
  const g = new THREE.Group();
  const wrap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 7, 1, true).rotateX(Math.PI), wrapMat);
  wrap.position.y = 0.1;
  g.add(wrap);
  colors.forEach((hex, i) => {
    const a = (i / Math.max(colors.length, 1)) * Math.PI * 2 * 2.3, r = 0.02 + (i % 4) * 0.018;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 3).translate(0, 0.15, 0), stemMat);
    s.position.set(Math.cos(a) * r * 0.5, 0, Math.sin(a) * r * 0.5);
    s.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    // saved as "#colour:kind"; older saves hold only the colour
    const [colour, kind] = String(hex).split(':');
    const k = BOUQUET_SHAPE[Number(kind)] ?? 4;
    const h = new THREE.Mesh(headGeos[k], bothSides(new THREE.MeshLambertMaterial({ color: colour, vertexColors: true })));
    h.scale.setScalar(0.5);
    h.position.set(Math.cos(a) * (r + 0.05), 0.3 + (i % 3) * 0.02 - STEM_H * 0.5, Math.sin(a) * (r + 0.05));
    h.rotation.y = a;
    g.add(s, h);
    const centre = FLOWER_CENTRE[FLOWER_KINDS[k]];
    if (centre) { const c = new THREE.Mesh(centreGeo, std(centre)); h.add(c); }
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function initFlowers() {
  const items = world.flowerItems, set = world.flowerSet;
  const picked = new Float32Array(items.length).fill(-1e9);
  const shownF = new Uint8Array(items.length).fill(1);
  debugView = () => items.map((it, i) => ({ x: it.x, z: it.z, shown: !!shownF[i], kind: it.kind }));
  const keep = items.map((it) => ((Math.sin(it.x * 12.9898 + it.z * 78.233) * 43758.5453) % 1 + 1) % 1); // stable per flower
  const setShown = (i, on) => {
    if (shownF[i] === on) return;
    shownF[i] = on;
    set.setVisibleAt(i, !!on);
  };
  const refresh = () => {
    const frac = seasonState.flowerFrac;
    for (let i = 0; i < items.length; i++) setShown(i, keep[i] < frac && clock.elapsed - picked[i] > REGROW ? 1 : 0);
    set.commit();
  };

  let bouquet = Array.isArray(store.bouquet) ? store.bouquet.slice(0, MAX) : [];
  let inHand = null;
  const rebuildHand = () => {
    if (inHand) hero.arms[1].remove(inHand);
    inHand = bouquet.length ? buildBouquet(bouquet) : null;
    if (inHand) { inHand.position.set(0, -hero.dims.arm + 0.03, 0.03); inHand.scale.setScalar(0.8); inHand.rotation.order = 'ZYX'; hero.arms[1].add(inHand); }
    store.bouquet = bouquet.slice();
    saveSoon();
  };
  rebuildHand();

  let onBench = null, onBoat = null;
  const benchSeat = seats.find((s) => s.name === 'bench');
  const placeOnBench = (colors) => {
    if (onBench) scene.remove(onBench);
    onBench = buildBouquet(colors);
    const side = benchSeat.rot + Math.PI / 2;
    onBench.position.set(benchSeat.x + Math.sin(side) * 0.6, heightAt(benchSeat.x, benchSeat.z) + 0.53, benchSeat.z + Math.cos(side) * 0.6);
    onBench.rotation.set(0, benchSeat.rot + 0.4, Math.PI / 2 - 0.15);
    scene.add(onBench);
  };
  const placeOnBoat = (colors) => {
    if (onBoat) boat.remove(onBoat);
    onBoat = buildBouquet(colors);
    onBoat.position.set(0.15, 0.2, 1.75);
    onBoat.rotation.set(Math.PI / 2 - 0.3, 0, 0.3);
    boat.add(onBoat);
  };
  if (store.benchBouquet) placeOnBench(store.benchBouquet);
  if (store.boatBouquet) placeOnBoat(store.boatBouquet);
  onSave((s) => { s.bouquet = bouquet.slice(); });

  const nearBench = () => benchSeat && Math.hypot(benchSeat.x - player.x, benchSeat.z - player.z) < 2.3;
  let nearFlower = -1, nearDist = 9;
  const scan = () => {
    nearFlower = -1;
    let best = 1.2;
    for (let i = 0; i < items.length; i++) {
      if (!shownF[i]) continue;
      const it = items[i], d = Math.abs(it.x - player.x) + Math.abs(it.z - player.z);
      if (d < best) { best = d; nearFlower = i; }
    }
    nearDist = best;
  };

  registerAction({
    id: 'give-friend', key: 'KeyG', keyLabel: 'G', score: () => 9,
    available: () => activity.free && bouquet.length && friendNear(2.6),
    label: () => 'Give her the bouquet',
    run: () => { giftFriend(bouquet.slice()); bouquet = []; rebuildHand(); player.pickT = 0.6; },
  });
  registerAction({
    id: 'give-skipper', key: 'KeyG', keyLabel: 'G', score: () => 10,
    available: () => activity.free && bouquet.length && nearSkipper(),
    label: () => (hasRod() ? 'Give the bouquet to the skipper' : 'Offer the bouquet for the fishing rod'),
    run: () => {
      if (!hasRod()) {
        // without a rod, the bouquet is a trade: he only takes a proper one
        const v = judgeBouquet(bouquet);
        if (!v.ok) { sk.nod = 0.5; toast(`The skipper: ${v.why}`, 5); return; }
        placeOnBoat(bouquet);
        store.boatBouquet = bouquet.slice();
        bouquet = []; rebuildHand();
        giveRod('bouquet');
        return;
      }
      placeOnBoat(bouquet);
      store.boatBouquet = bouquet.slice();
      sk.nod = 0.9; sk.waveT = 1.6;
      toast('The skipper smiles and tucks your bouquet into the bow of the boat.');
      bouquet = []; rebuildHand();
    },
  });
  registerAction({
    id: 'leave-bench', key: 'KeyG', keyLabel: 'G', score: () => 9,
    available: () => activity.free && bouquet.length && nearBench(),
    label: () => 'Leave the bouquet on the bench',
    run: () => {
      placeOnBench(bouquet);
      store.benchBouquet = bouquet.slice();
      toast('You leave the bouquet on the bench.');
      bouquet = []; rebuildHand();
    },
  });
  registerAction({
    id: 'pick', key: 'KeyG', keyLabel: 'G', score: () => (nearDist < 0.7 ? 20 : 0), // standing on a flower picks it
    available: () => activity.free && bouquet.length < MAX && nearFlower >= 0,
    label: () => `Pick a flower${bouquet.length ? ` (${bouquet.length}/${MAX})` : ''}`,
    run: () => {
      const i = nearFlower;
      if (i < 0) return;
      picked[i] = clock.elapsed;
      setShown(i, 0);
      set.commit();
      bouquet.push('#' + items[i].color.getHexString() + ':' + items[i].kind);
      rebuildHand();
      player.pickT = 0.6;
      if (bouquet.length === 1) toast(hasRod() ? 'Picked a flower. Gather more, then give the bouquet to the skipper or leave it on the bench.' : 'Picked a flower. A full bouquet of three kinds or more could win you the skipper\'s fishing rod.', 4.5);
      if (bouquet.length === MAX) toast('Your hands are full of flowers.');
      scan();
    },
  });

  let refreshIn = 0, scanIn = 0;
  hooks.frame.push((dt) => {
    refreshIn -= dt;
    if (refreshIn <= 0) { refresh(); refreshIn = 1; }
    scanIn -= dt;
    if (scanIn <= 0) { scan(); scanIn = 0.1; }
  });

  // crouch to pick; hold the bouquet in front while walking
  hooks.pose.push((dt) => {
    if (player.pickT > 0) {
      player.pickT = Math.max(0, player.pickT - dt);
      const e = Math.sin((1 - player.pickT / 0.6) * Math.PI);
      hero.body.rotation.x += 0.7 * e;
      hero.body.position.y -= 0.14 * e;
      hero.elbows[1].rotation.x = lerp(hero.elbows[1].rotation.x, -0.15, e);
      hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -1.3, e);
    }
    if (inHand) {
      inHand.visible = !activity.is('fish');
      if (inHand.visible && !player.seat && player.petAmt < 0.05) {
        hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -0.55, 0.85);
        hero.arms[1].rotation.z = -0.15;
        hero.elbows[1].rotation.x = lerp(hero.elbows[1].rotation.x, 0, 0.85); // the bouquet arm stays straight so the flowers stand upright
      }
      inHand.rotation.set(-(hero.arms[1].rotation.x + hero.body.rotation.x + hero.chest.rotation.x) - 0.25, 0, -hero.arms[1].rotation.z);
    }
  });
}
