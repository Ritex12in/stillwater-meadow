// Pick flowers (G), carry a bouquet, give it to the skipper or leave it on the bench.
// Picked flowers grow back after a few minutes; there are fewer in autumn and none in winter.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { lerp } from '../core/math.js';
import { heightAt } from '../core/shape.js';
import { std } from '../core/materials.js';
import { clock } from '../core/clock.js';
import { hooks, seats, seasonState, world } from '../core/state.js';
import { player, hero } from '../characters/player.js';
import { boat, ferry, sk, skipper } from '../characters/boat.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { store, saveSoon, onSave } from '../systems/save.js';
import { toast } from '../ui/hud.js';

const MAX = 12, REGROW = 240;
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
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), std(hex));
    h.position.set(Math.cos(a) * (r + 0.05), 0.3 + (i % 3) * 0.02, Math.sin(a) * (r + 0.05));
    g.add(s, h);
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function initFlowers() {
  const items = world.flowerItems, stem = world.flowerStem, head = world.flowerHead;
  const picked = new Float32Array(items.length).fill(-1e9);
  const shownF = new Uint8Array(items.length).fill(1);
  const keep = items.map((it) => ((Math.sin(it.x * 12.9898 + it.z * 78.233) * 43758.5453) % 1 + 1) % 1); // stable per flower
  const setShown = (i, on) => {
    if (shownF[i] === on) return;
    shownF[i] = on;
    stem.setVisibleAt(i, !!on);
    head.setVisibleAt(i, !!on);
  };
  const refresh = () => {
    const frac = seasonState.flowerFrac;
    for (let i = 0; i < items.length; i++) setShown(i, keep[i] < frac && clock.elapsed - picked[i] > REGROW ? 1 : 0);
    stem.commit(); head.commit();
  };

  let bouquet = Array.isArray(store.bouquet) ? store.bouquet.slice(0, MAX) : [];
  let inHand = null;
  const rebuildHand = () => {
    if (inHand) hero.arms[1].remove(inHand);
    inHand = bouquet.length ? buildBouquet(bouquet) : null;
    if (inHand) { inHand.position.set(0, -0.64, 0.02); inHand.rotation.order = 'ZYX'; hero.arms[1].add(inHand); }
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

  const skipperPos = new THREE.Vector3();
  const nearSkipper = () => { skipper.root.getWorldPosition(skipperPos); return ferry.state === 'docked' && Math.hypot(skipperPos.x - player.x, skipperPos.z - player.z) < 3.2; };
  const nearBench = () => benchSeat && Math.hypot(benchSeat.x - player.x, benchSeat.z - player.z) < 2.3;
  let nearFlower = -1;
  const scan = () => {
    nearFlower = -1;
    let best = 1.2;
    for (let i = 0; i < items.length; i++) {
      if (!shownF[i]) continue;
      const it = items[i], d = Math.abs(it.x - player.x) + Math.abs(it.z - player.z);
      if (d < best) { best = d; nearFlower = i; }
    }
  };

  registerAction({
    id: 'give-skipper', key: 'KeyG', keyLabel: 'G', score: () => 10,
    available: () => activity.free && bouquet.length && nearSkipper(),
    label: () => 'Give the bouquet to the skipper',
    run: () => {
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
    id: 'pick', key: 'KeyG', keyLabel: 'G', score: () => 0,
    available: () => activity.free && bouquet.length < MAX && nearFlower >= 0,
    label: () => `Pick a flower${bouquet.length ? ` (${bouquet.length}/${MAX})` : ''}`,
    run: () => {
      const i = nearFlower;
      if (i < 0) return;
      picked[i] = clock.elapsed;
      setShown(i, 0);
      stem.commit(); head.commit();
      bouquet.push('#' + items[i].color.getHexString());
      rebuildHand();
      player.pickT = 0.6;
      if (bouquet.length === 1) toast('Picked a flower. Gather more, then give the bouquet to the skipper or leave it on the bench.', 4.5);
      if (bouquet.length === MAX) toast('Your hands are full of flowers.');
      scan();
    },
  });

  let refreshIn = 0, scanIn = 0;
  hooks.frame.push((dt) => {
    refreshIn -= dt;
    if (refreshIn <= 0) { refresh(); refreshIn = 1; }
    scanIn -= dt;
    if (scanIn <= 0) { scan(); scanIn = 0.2; }
  });

  // crouch to pick; hold the bouquet in front while walking
  hooks.pose.push((dt) => {
    if (player.pickT > 0) {
      player.pickT = Math.max(0, player.pickT - dt);
      const e = Math.sin((1 - player.pickT / 0.6) * Math.PI);
      hero.body.rotation.x += 0.7 * e;
      hero.body.position.y -= 0.25 * e;
      hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -1.3, e);
    }
    if (inHand) {
      inHand.visible = !activity.is('fish');
      if (inHand.visible && !player.seat && player.petAmt < 0.05) {
        hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -0.55, 0.85);
        hero.arms[1].rotation.z = -0.15;
      }
      inHand.rotation.set(-(hero.arms[1].rotation.x + hero.body.rotation.x) - 0.25, 0, -hero.arms[1].rotation.z);
    }
  });
}
