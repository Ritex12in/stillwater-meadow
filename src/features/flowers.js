// Pick flowers (G): they go into your backpack. Tie some into a bouquet there, hold it, and give
// it to the skipper or your friend, or leave it on the bench.
// Flowers grow wherever the land says (world/wilds.js, square by square); the ones near you are
// kept here. Picked flowers grow back after a few minutes; there are fewer in autumn and none in winter.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { lerp } from '../core/math.js';
import { heightAt, yearOf } from '../core/shape.js';
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
import { store } from '../systems/save.js';
import { toast } from '../ui/hud.js';
import { itemKind, add, addItem, take, removeItem, held, hold, has, units, packSlots, onPack, roomFor } from '../systems/pack.js';
import { packActions } from '../ui/backpack.js';
import { ICONS } from '../ui/icons.js';
import { flowerName } from '../world/vegetation.js';
import { flowersOut } from '../core/year.js';
import { coldAt, height, moistAt, groveAt, biomesAt, snowCold } from '../core/shape.js';
import { onPanel } from '../ui/hud.js';

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

itemKind('flower', {
  name: (it) => flowerName(it.key), max: 32,
  icon: (it) => ICONS.flower(it.list && it.list.length ? it.list[it.list.length - 1] : undefined),
  detail: (it) => `${it.n} picked. Put some aside and tie them into a bouquet.`,
});
itemKind('bouquet', {
  name: 'Bouquet', holdable: true,
  icon: (it) => ICONS.bouquet(it.list.map((f) => String(f).split(':')[0])),
  detail: (it) => { const kinds = new Set(it.list.map((f) => String(f).split(':')[1])).size; return `${it.list.length} ${it.list.length === 1 ? 'flower' : 'flowers'} of ${kinds} ${kinds === 1 ? 'kind' : 'kinds'}. Hold it to give it: G by the skipper, your friend or the bench.`; },
});

/** A name for the kind of country at a spot, for the journals. */
export function countryName(x, z) {
  const h = height(x, z), c = coldAt(x, z, h), w = moistAt(x, z), B = biomesAt(x, z, h);
  if (B.enchanted > 0.5) return 'the enchanted wood';
  if (B.desert > 0.5) return 'the desert';
  if (B.swamp > 0.5) return 'the swamp';
  if (groveAt(x, z) > 0.6) return 'a blossom grove';
  if (snowCold(c, w) > 0.55) return 'the snowfields';
  if (c > 0.45) return 'the tundra';
  if (c < -0.25) return w < 0.42 ? 'the warm dry hills' : 'the warm woods';
  if (w < 0.4) return 'the heath';
  if (w > 0.6) return 'the lush woods';
  return 'the meadows';
}

export function initFlowers() {
  // `items`: the flowers of the squares near you (they change as you walk); `shown`: those of them
  // standing just now. A picked flower is remembered by its name until it has grown back, so it
  // stays picked while you are away and its square is forgotten and grown again.
  let items = world.picks || [], shown = [], lastFrac = -1, lastCool = false, nearFlower = null, nearDist = 9;
  const picked = new Map();
  const redraw = () => {
    const now = clock.elapsed, s = seasonState.season, cool = seasonState.cooling;
    for (const [id, t] of picked) if (now - t > REGROW) picked.delete(id);
    shown = items.filter((it) => it.keep < flowersOut(it.chill || 0, s, cool, yearOf(it)) && !picked.has(it.id)); // (each by its own place's season)
    world.picksDropped = world.drawPicks ? world.drawPicks(shown) : 0;
    lastFrac = s; lastCool = cool;
  };
  world.setPicks = (list) => { items = list; nearFlower = null; redraw(); };
  debugView = () => { const up = new Set(shown); return items.map((it) => ({ id: it.id, x: it.x, z: it.z, shown: up.has(it), kind: it.kind })); };
  /** Once a second: redraw if the season has taken or given flowers, or a picked one has grown back. */
  const refresh = () => {
    let due = Math.abs(seasonState.season - lastFrac) > 0.002 || seasonState.cooling !== lastCool;
    if (!due) for (const t of picked.values()) if (clock.elapsed - t > REGROW) { due = true; break; }
    if (due) redraw();
  };
  redraw();

  // a bouquet carried in the hand before the backpack (an older save) is a bouquet in the backpack, held
  if (Array.isArray(store.bouquet)) { const old = store.bouquet.slice(0, MAX); delete store.bouquet; if (old.length) { const b = addItem({ type: 'bouquet', list: old }); if (b) hold(b.uid); } }
  /** The bouquet you would give: the one in your hand, else the first in the backpack. */
  const giving = () => { const h = held(); return h && h.type === 'bouquet' ? h : packSlots().find((it) => it && it.type === 'bouquet') || null; };
  /** Give the bouquet away (out of the backpack): returns its flowers. */
  const handOver = () => { const b = giving(); if (!b) return []; removeItem(b.uid); return b.list.slice(); };
  // the held bouquet is in the figure's hand
  let inHand = null, inHandUid = null;
  const rebuildHand = () => {
    const h = held(), want = h && h.type === 'bouquet' ? h : null;
    if ((want ? want.uid : null) === inHandUid) return;
    if (inHand) hero.arms[1].remove(inHand);
    inHand = want ? buildBouquet(want.list) : null;
    inHandUid = want ? want.uid : null;
    if (inHand) { inHand.position.set(0, -hero.dims.arm + 0.03, 0.03); inHand.scale.setScalar(0.8); inHand.rotation.order = 'ZYX'; hero.arms[1].add(inHand); }
  };
  onPack(rebuildHand);
  rebuildHand();

  // ── tying a bouquet in the backpack ──
  // Flowers are put on one side, one at a time or a mixed handful, then tied (up to MAX of them).
  // Those put aside stay in the backpack until the bouquet is tied, so nothing is lost if you stop.
  let aside = []; // [{ key, unit }]: which flowers, by kind and colour
  const asideOf = (key) => aside.filter((a) => a.key === key).length;
  const putAside = (key) => {
    if (aside.length >= MAX) return;
    const left = units('flower').filter((u) => u.key === key).map((u) => u.unit);
    const used = aside.filter((a) => a.key === key).map((a) => a.unit);
    for (const u of used) { const i = left.indexOf(u); if (i >= 0) left.splice(i, 1); }
    if (left.length) aside.push({ key, unit: left[left.length - 1] });
  };
  /** A mixed handful: one of each kind in turn until the bouquet is full or the flowers run out. */
  const mixAside = () => {
    const keys = [...new Set(units('flower').map((u) => u.key))];
    for (let round = 0; aside.length < MAX && round < MAX; round++) for (const k of keys) { if (aside.length >= MAX) break; const before = aside.length; putAside(k); if (aside.length === before) continue; }
  };
  /** Tie what is put aside into a bouquet, and hold it. False if there is nothing, or no room. */
  const tie = () => {
    if (!aside.length) return false;
    // (there must be a slot for it once the flowers are out: an empty one, or a stack the flowers empty)
    const empties = packSlots().some((it) => !it) || packSlots().some((it) => it && it.type === 'flower' && it.n === asideOf(it.key));
    if (!empties) { toast('No room in your backpack for a bouquet.'); return false; }
    const flowers = [];
    for (const a of aside) { const t = take('flower', a.key, (list) => list.lastIndexOf(a.unit)); if (t) flowers.push(t.unit + ':' + t.key); }
    aside = [];
    const b = addItem({ type: 'bouquet', list: flowers });
    if (!b) { for (const f of flowers) { const [c, k] = f.split(':'); add('flower', Number(k), c); } return false; }
    hold(b.uid);
    toast(`You tie ${flowers.length} ${flowers.length === 1 ? 'flower' : 'flowers'} into a bouquet. You hold it now: give it with G.`, 4);
    return true;
  };
  /** Take a bouquet apart: its flowers go back in the backpack (if they fit). */
  const untie = (b) => {
    removeItem(b.uid);
    for (const f of b.list) { const [c, k] = String(f).split(':'); if (!add('flower', Number(k), c)) { addItem({ type: 'bouquet', list: b.list.slice(b.list.indexOf(f)) }); break; } }
  };
  world.tieBouquet = (keys) => { aside = []; if (keys) keys.forEach(putAside); else mixAside(); return tie(); }; // (for tests)
  packActions((it) => {
    if (it.type === 'flower') {
      const out = [{ label: `Put one aside (${aside.length}/${MAX})`, disabled: aside.length >= MAX || asideOf(it.key) >= it.n, run: () => putAside(it.key) }];
      if (aside.length) out.push({ label: `Tie a bouquet of ${aside.length}`, primary: true, run: tie }, { label: 'Put them back', run: () => { aside = []; } });
      else out.push({ label: 'Tie a mixed bouquet', primary: true, run: () => { mixAside(); tie(); } });
      return out;
    }
    if (it.type === 'bouquet') return [{ label: 'Untie', run: () => untie(it) }];
    return [];
  });

  let onBench = null, onBoat = null;
  const benchSeat = seats.find((s) => s.name === 'bench');
  const layOnBench = () => {
    if (!onBench) return;
    const side = benchSeat.rot + Math.PI / 2;
    onBench.position.set(benchSeat.x + Math.sin(side) * 0.6, heightAt(benchSeat.x, benchSeat.z) + 0.53, benchSeat.z + Math.cos(side) * 0.6);
    onBench.rotation.set(0, benchSeat.rot + 0.4, Math.PI / 2 - 0.15);
  };
  const placeOnBench = (colors) => {
    if (onBench) scene.remove(onBench);
    onBench = buildBouquet(colors);
    layOnBench();
    scene.add(onBench);
  };
  // The landmarks have moved to another lake. A bouquet left on a bench or in a boat belongs to
  // that place: the ones here are taken up, and this place's own (systems/anchor.js has put them
  // in the save's bench and boat slots) are laid out.
  hooks.anchor.push(() => {
    if (onBench) { scene.remove(onBench); onBench = null; }
    if (onBoat) { boat.remove(onBoat); onBoat = null; }
    if (store.benchBouquet) placeOnBench(store.benchBouquet);
    if (store.boatBouquet) placeOnBoat(store.boatBouquet);
  });
  const placeOnBoat = (colors) => {
    if (onBoat) boat.remove(onBoat);
    onBoat = buildBouquet(colors);
    onBoat.position.set(0.15, 0.2, 1.75);
    onBoat.rotation.set(Math.PI / 2 - 0.3, 0, 0.3);
    boat.add(onBoat);
  };
  if (store.benchBouquet) placeOnBench(store.benchBouquet);
  if (store.boatBouquet) placeOnBoat(store.boatBouquet);

  const nearBench = () => benchSeat && Math.hypot(benchSeat.x - player.x, benchSeat.z - player.z) < 2.3;
  const scan = () => {
    nearFlower = null;
    let best = 1.2;
    for (const it of shown) {
      const d = Math.abs(it.x - player.x) + Math.abs(it.z - player.z);
      if (d < best) { best = d; nearFlower = it; }
    }
    nearDist = best;
  };

  const flowerList = document.getElementById('flowerList');
  if (flowerList) onPanel('journal', (open) => {
    if (!open) return;
    const fj = store.flowerJournal || {}, kinds = [0, 1, 2, 3, 4, 5, 6];
    flowerList.replaceChildren(...kinds.map((k) => {
      const j = fj[k], li = document.createElement('li');
      li.className = j ? 'got' : '';
      const sw = document.createElement('span'); sw.className = 'sw';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = j ? flowerName(k) : 'Not yet picked';
      const st = document.createElement('span'); st.className = 'st'; st.textContent = j ? `${j.n} picked · first in ${j.where}` : '';
      li.append(sw, nm, st);
      return li;
    }));
  });
  registerAction({
    id: 'give-friend', key: 'KeyG', keyLabel: 'G', score: () => 9,
    available: () => activity.free && !!giving() && friendNear(2.6),
    label: () => 'Give her the bouquet',
    run: () => { giftFriend(handOver()); player.pickT = 0.6; },
  });
  registerAction({
    id: 'give-skipper', key: 'KeyG', keyLabel: 'G', score: () => 10,
    available: () => activity.free && !!giving() && nearSkipper(),
    label: () => (hasRod() ? 'Give the bouquet to the skipper' : 'Offer the bouquet for the fishing rod'),
    run: () => {
      if (!hasRod()) {
        // without a rod, the bouquet is a trade: he only takes a proper one
        const v = judgeBouquet(giving().list);
        if (!v.ok) { sk.nod = 0.5; toast(`The skipper: ${v.why}`, 5); return; }
        const b = handOver(); // (paid before the rod goes in, so there is room for it)
        placeOnBoat(b);
        store.boatBouquet = b;
        giveRod('bouquet');
        return;
      }
      const b = handOver();
      placeOnBoat(b);
      store.boatBouquet = b;
      sk.nod = 0.9; sk.waveT = 1.6;
      toast('The skipper smiles and tucks your bouquet into the bow of the boat.');
    },
  });
  registerAction({
    id: 'leave-bench', key: 'KeyG', keyLabel: 'G', score: () => 9,
    available: () => activity.free && !!giving() && nearBench(),
    label: () => 'Leave the bouquet on the bench',
    run: () => {
      const b = handOver();
      placeOnBench(b);
      store.benchBouquet = b;
      toast('You leave the bouquet on the bench.');
    },
  });
  // with flowers but no bouquet, where one could be given: say how to make one
  registerAction({
    id: 'tie-hint', key: 'KeyG', keyLabel: 'G', score: () => -4,
    available: () => activity.free && !giving() && has('flower') && (nearSkipper() || friendNear(2.6) || nearBench()),
    disabled: () => true,
    label: () => 'Tie your flowers into a bouquet first (backpack, I)',
    run: () => {},
  });
  registerAction({
    id: 'pick', key: 'KeyG', keyLabel: 'G', score: () => (nearDist < 0.7 ? 20 : 0), // standing on a flower picks it
    available: () => activity.free && !!nearFlower,
    disabled: () => !!nearFlower && !roomFor('flower', nearFlower.kind),
    label: () => (nearFlower && !roomFor('flower', nearFlower.kind) ? 'Backpack is full' : 'Pick a flower'),
    run: () => {
      const f = nearFlower;
      if (!f || !add('flower', f.kind, '#' + f.color.getHexString())) return;
      // the flower journal: each kind, how many, and the country it was first found in
      const fj = store.flowerJournal || (store.flowerJournal = {}), first = !fj[f.kind];
      fj[f.kind] = fj[f.kind] || { n: 0, where: countryName(f.x, f.z) };
      fj[f.kind].n++;
      if (first) toast(`A new flower for your journal: ${flowerName(f.kind)}.`, 3);
      picked.set(f.id, clock.elapsed);
      redraw();
      player.pickT = 0.6;
      if (!store.pickedOnce) {
        store.pickedOnce = true;
        toast(hasRod() ? 'Picked a flower: it is in your backpack (I). Tie flowers into a bouquet there to give one away.' : 'Picked a flower: it is in your backpack (I). Tie a bouquet of 12, of three kinds or more, and the skipper may trade you his fishing rod.', 6);
      }
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
