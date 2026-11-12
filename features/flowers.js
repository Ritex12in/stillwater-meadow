/* Pick flowers around the meadow (G), carry a bouquet, and give it to the skipper or leave it on the bench.
   Picked flowers grow back after a few minutes; flowers thin out in autumn and vanish in winter. */
(() => {
  'use strict';
  const SW = window.SW;
  if (!SW) return;
  const { THREE, rand, lerp, damp, clamp, player, std } = SW;
  const items = SW.world.flowerItems || [];
  const stem = SW.world.flowerStem, head = SW.world.flowerHead;
  if (!items.length || !stem || !head) return;

  const MAX = 12, REGROW = 240;
  const base = items.map((_, i) => { const m = new THREE.Matrix4(); head.getMatrixAt(i, m); return m; });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const picked = new Float32Array(items.length).fill(-1e9);
  const shown = new Uint8Array(items.length).fill(1);
  const keep = items.map((it) => ((Math.sin(it.x * 12.9898 + it.z * 78.233) * 43758.5453) % 1 + 1) % 1); // stable per flower
  let dirty = false;
  function setShown(i, on) {
    if (shown[i] === on) return;
    shown[i] = on;
    stem.setMatrixAt(i, on ? base[i] : zero);
    head.setMatrixAt(i, on ? base[i] : zero);
    dirty = true;
  }
  let refreshIn = 0;
  function refresh() {
    const frac = SW.seasonState.flowerFrac === undefined ? 1 : SW.seasonState.flowerFrac;
    const now = SW.elapsed;
    for (let i = 0; i < items.length; i++) setShown(i, keep[i] < frac && now - picked[i] > REGROW ? 1 : 0);
    if (dirty) { stem.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true; dirty = false; }
  }

  // ── bouquet model ─────────────────────────────────────────────
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
  let bouquet = [];
  let inHand = null;
  function rebuildHand() {
    if (inHand) SW.hero.arms[1].remove(inHand);
    inHand = bouquet.length ? buildBouquet(bouquet) : null;
    if (inHand) { inHand.position.set(0, -0.64, 0.02); inHand.rotation.order = 'ZYX'; SW.hero.arms[1].add(inHand); }
  }

  // places to leave it, restored from the save
  let onBench = null, onBoat = null;
  const benchSeat = SW.seats.find((s) => s.name === 'bench');
  function placeOnBench(colors) {
    if (onBench) SW.scene.remove(onBench);
    if (!benchSeat) return;
    onBench = buildBouquet(colors);
    const side = benchSeat.rot + Math.PI / 2;
    onBench.position.set(benchSeat.x + Math.sin(side) * 0.6, SW.height(benchSeat.x, benchSeat.z) + 0.53, benchSeat.z + Math.cos(side) * 0.6);
    onBench.rotation.set(0, benchSeat.rot + 0.4, Math.PI / 2 - 0.15);
    SW.scene.add(onBench);
  }
  function placeOnBoat(colors) {
    if (onBoat) SW.boat.remove(onBoat);
    onBoat = buildBouquet(colors);
    onBoat.position.set(0.15, 0.2, 1.75);
    onBoat.rotation.set(Math.PI / 2 - 0.3, 0, 0.3);
    SW.boat.add(onBoat);
  }
  if (SW.store.benchBouquet) placeOnBench(SW.store.benchBouquet);
  if (SW.store.boatBouquet) placeOnBoat(SW.store.boatBouquet);

  // ── interaction ───────────────────────────────────────────────
  let nearFlower = -1, context = '';
  const skipperPos = new THREE.Vector3();
  function act() {
    if (context === 'skipper') {
      placeOnBoat(bouquet);
      SW.store.boatBouquet = bouquet.slice(); SW.saveSoon();
      SW.sk.nod = 0.9; SW.sk.waveT = 1.6;
      SW.toast('The skipper smiles and tucks your bouquet into the bow of the boat.');
      bouquet = []; rebuildHand();
    } else if (context === 'bench') {
      placeOnBench(bouquet);
      SW.store.benchBouquet = bouquet.slice(); SW.saveSoon();
      SW.toast('You leave the bouquet on the bench.');
      bouquet = []; rebuildHand();
    } else if (context === 'pick' && nearFlower >= 0) {
      const i = nearFlower;
      picked[i] = SW.elapsed;
      setShown(i, 0);
      stem.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true;
      bouquet.push('#' + items[i].color.getHexString());
      rebuildHand();
      player.pickT = 0.6;
      if (bouquet.length === 1) SW.toast('Picked a flower. Gather more, then give the bouquet to the skipper or leave it on the bench.', 4.5);
      if (bouquet.length === MAX) SW.toast('Your hands are full of flowers.');
    }
  }
  const prompt = SW.addPrompt('G', act);
  SW.onKey('KeyG', act);

  let scanIn = 0;
  SW.hooks.frame.push((dt) => {
    refreshIn -= dt;
    if (refreshIn <= 0) { refresh(); refreshIn = 1; }
    scanIn -= dt;
    if (scanIn > 0) return;
    scanIn = 0.2;
    context = ''; nearFlower = -1;
    const free = !player.seat && !player.petting && !player.lie && !player.fishing;
    if (free && bouquet.length) {
      SW.skipper.root.getWorldPosition(skipperPos);
      if (SW.ferry.state === 'docked' && Math.hypot(skipperPos.x - player.x, skipperPos.z - player.z) < 3.2) context = 'skipper';
      else if (benchSeat && Math.hypot(benchSeat.x - player.x, benchSeat.z - player.z) < 2.3) context = 'bench';
    }
    if (free && !context && bouquet.length < MAX) {
      let best = 1.2;
      for (let i = 0; i < items.length; i++) {
        if (!shown[i]) continue;
        const it = items[i], d = Math.abs(it.x - player.x) + Math.abs(it.z - player.z);
        if (d < best) { best = d; nearFlower = i; }
      }
      if (nearFlower >= 0) context = 'pick';
    }
    prompt.set(context === 'skipper' ? 'Give the bouquet to the skipper'
      : context === 'bench' ? 'Leave the bouquet on the bench'
        : context === 'pick' ? `Pick a flower${bouquet.length ? ` (${bouquet.length}/${MAX})` : ''}` : '');
  });

  // crouch to pick; hold the bouquet in front when walking
  SW.hooks.pose.push((dt) => {
    const hero = SW.hero;
    if (player.pickT > 0) {
      player.pickT = Math.max(0, player.pickT - dt);
      const e = Math.sin((1 - player.pickT / 0.6) * Math.PI);
      hero.body.rotation.x += 0.7 * e;
      hero.body.position.y -= 0.25 * e;
      hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -1.3, e);
    }
    if (inHand) {
      inHand.visible = !player.fishing;
      if (inHand.visible && !player.seat && player.petAmt < 0.05) {
        hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -0.55, 0.85);
        hero.arms[1].rotation.z = -0.15;
      }
      inHand.rotation.set(-(hero.arms[1].rotation.x + hero.body.rotation.x) - 0.25, 0, -hero.arms[1].rotation.z);
    }
  });
})();
