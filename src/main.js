// Stillwater Meadow: boot, build the world in a fixed order, and run the frame loop.
import './style.css';
import { updateAtmosphere } from './core/atmosphere.js'; // patches the fog shader; keep first
import * as THREE from 'three';
import { clamp, smooth, rng } from './core/math.js';
import { reduceMotion, debug, query } from './core/env.js';
import { scene, camera, createRenderer } from './core/render.js';
import { timeU, updateDetail, neonU } from './core/materials.js';
import { lakeT, lakePoint, walkable, dockAt, dockDir, onDock, FIRE_SPOT, SPAWN, WORLD, height, heightAt, coldAt, rainAt, dryOf, lushOf, snowOf, groveAt, lakesNear, groundAt, kitOf, KIT, BENCH_SPOT } from './core/shape.js';
import { hooks, seasonState, seats, world, obstacles } from './core/state.js';
import { clock } from './core/clock.js';
import { buildSky, sky, skyU } from './world/sky.js';
import { buildLights, hemi, ambient, sun, placeSun } from './world/lights.js';
import { buildGround, updateGround, pumpGround, settleGround, groundStats, groundU } from './world/terrain.js';
import { buildWater, updateWater, waterLakes, waterU } from './world/water.js';
import { buildTrees, buildRocks, buildGrass, buildFlowers, buildReedsAndPads, buildUndergrowth, treeSpots, TREE_REACH, MODEL_FAR } from './world/vegetation.js';
import { loadKit, kit } from './core/assets.js';
import { loadingStep, paint, loadingDone, initScreen } from './ui/loading.js';
import { buildDockAndBench, buildChairs, buildLamps, lampMat, lampGlows, lampSpots } from './world/props.js';

import { buildWildflowers } from './world/wildflowers.js';
import { buildFarForest } from './world/farforest.js';
import { chooseShrineSite, buildShrine } from './world/shrine.js';
import { buildClouds, buildFireflies, buildButterflies, buildPollen, buildBirds, birds, birdMat, updateAmbientLife, tintClouds, ffMat, fireflies, butterflies, pollen, pollenMat } from './world/ambient.js';
import { buildEffects, updateEffects } from './world/effects.js';
import { player, buildPlayer, updatePlayer } from './characters/player.js';
import { animals, buildAnimals, updateAnimal, separateAnimals, shakeDogs } from './characters/animals.js';
import { registerPetting, updatePetting } from './characters/petting.js';
import { buildBoat, updateBoat } from './characters/boat.js';
import { activity } from './systems/activity.js';
import { evaluateActions, bindKey } from './systems/actions.js';
import { audio, updateBeds } from './systems/audio.js';
import { camState, initPointer } from './systems/input.js';
import { updateCamera, camTarget } from './systems/camera.js';
import { cur, sunDir, moonDir, lightDir, solar, timeCtl, advanceTime, periodName, formatHour, goLive, setManual, wrap24 } from './systems/time.js';
import { wx, WX_LABEL, buildWeather, updateWeather, updatePrecip, weatherModify, cycleWeather, onRainStopped, restoreWeather, resizeWeather } from './systems/weather.js';
import { quality, initQuality, tickQuality, onQualityChange, loadingStarted, loadingFinished } from './systems/quality.js';
import { grassU, updateGrassMap, resetGrassMap } from './world/grassfield.js';
import { farForest } from './world/farforest.js';
import { updateWilds, settleWilds, wildStats, growSquare, growRocks, growSmall } from './world/wilds.js';
import { initPost, resizePost, renderFrame, post } from './systems/post.js';
import { store, onSave, flush } from './systems/save.js';
import { initHud, updateHud, renderPrompts, setClockLabel, togglePanel, reportProblem, showFatal, toast } from './ui/hud.js';
import { initWorldPanel, initPlaces } from './ui/world-panel.js';
import { updateAnchor, moveAnchor, anchorId, settledAbout } from './systems/anchor.js';
import { initSettings } from './ui/settings.js';
import { initPetVoices } from './features/voices.js';
import { initDucks, duckState } from './features/ducks.js';
import { initWildlife } from './features/wildlife.js';
import { initSeasons } from './features/seasons.js';
import { initFlowers, flowerView } from './features/flowers.js';
import { initRod, rodView } from './features/rod.js';
import { initFishing, fishingState, fishingInfo } from './features/fishing.js';
import { initCampfire, fire } from './features/campfire.js';
import { initStargaze } from './features/stargaze.js';
import { initPhoto, photoSaveCount } from './features/photo.js';
import { initMusic } from './features/music.js';
import { initNames } from './features/names.js';
import { initPets, petsView, fetchView } from './features/pets.js';
import { initFriend, friendView, friend } from './features/friend.js';
import { initEmotes, emoteState, playEmote } from './features/emotes.js';
import { initWardrobe, wardrobeNow } from './features/wardrobe.js';
import { initIceDance, danceView, snowmanView } from './features/icedance.js';
import { initDanceCam } from './features/dancecam.js';
import { initDanceMusic } from './features/dancemusic.js';
import { initFoley } from './features/foley.js';
import { ferry, boatSeat, BOARD_POINT, boat } from './characters/boat.js';
import { updateLakeLife, updateLifeLake, lifeLake, lifeStats, lifeOf } from './world/lakelife.js';
import { seasonNow } from './features/seasons.js';

let renderer;
try {
  renderer = createRenderer();
} catch (e) {
  showFatal('Your browser could not start WebGL, which this world needs to draw the meadow.');
  throw e;
}

// If the graphics card gives up (out of memory, a driver reset) and doesn't come back, save and start again a level lower.
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  setTimeout(() => { if (renderer.getContext().isContextLost()) { try { flush(); } catch (err) { /* nothing to save */ } loadingStarted(); location.reload(); } }, 3000);
});
loadingStarted(); // (cleared once the first frame is drawn: still set next time means this load crashed the tab)

// ── Build the world: the models and the things made once. What grows where is worked out as you walk. ──
// (the loading screen's bar follows along; `paint` lets the browser draw it between the heavy steps)
await loadKit((f) => loadingStep(0.05 + f * 0.5, 'Gathering trees and flowers…')); // nature models; the meadow falls back to hand-built shapes without them
loadingStep(0.58, 'Raising the hills…'); await paint();
buildSky();
buildLights();
buildGround(SPAWN.x, SPAWN.z);
buildWater();
loadingStep(0.68, 'Planting the forest…'); await paint();
buildTrees();
chooseShrineSite();
buildRocks();
buildGrass();
buildFlowers();
buildReedsAndPads();
if (kit) buildUndergrowth();
if (kit) buildWildflowers();
if (kit) buildFarForest(renderer);
loadingStep(0.8, 'Setting out the jetty…'); await paint();
buildDockAndBench();
buildChairs();
buildLamps();
buildShrine(lampSpots);
waterU.lampW.value = Array.from({ length: 12 }, (_, i) => lampSpots[i] || new THREE.Vector3(0, -1e4, 0));
buildClouds();
buildFireflies();
buildButterflies();
buildPollen();
buildBirds();
loadingStep(0.9, 'Waking the animals…'); await paint();
buildPlayer();
// Where you begin: where you last were in this world (the save remembers), or `?at=x,z` in the
// address, or by the home lake.
{
  const at = (query.get('at') || '').split(',').map(Number);
  const from = at.length === 2 && at.every(Number.isFinite) ? { x: at[0], z: at[1] } : store.where && store.where.seed === WORLD.seed ? store.where : null;
  if (from && Number.isFinite(from.x) && Number.isFinite(from.z) && walkable(from.x, from.z)) { player.x = from.x; player.z = from.z; player.y = groundAt(from.x, from.z); }
}
buildAnimals();
buildBoat();
buildEffects();
buildWeather();
registerPetting();
settleWilds(player.x, player.z);
// when the landmarks move to another lake: the grass keeps off them there, and the shadows are redrawn
hooks.anchor.push(() => { resetGrassMap(); renderer.shadowMap.needsUpdate = true; });

// ── Interface and systems ──
initHud();
initPointer();
initSettings();
initWorldPanel();
/** Go to a spot at once (the Places list): the ground and what grows there are made ready first. */
function travelTo(x, z, faceX, faceZ) {
  player.x = x; player.z = z; player.slide = null; player.y = groundAt(x, z);
  if (faceX !== undefined) { player.rot = Math.atan2(faceX - x, faceZ - z); camState.yaw = Math.atan2(x - faceX, z - faceZ); }
  updateAnchor(0, true); // (if this is another settled lake, its jetty, fire and bench are here when you arrive)
  updateLifeLake(0, x, z, true);
  settleGround(x, z); settleWilds(x, z); updateWater(x, z); updateLakeLife(x, z);
  flush();
}
/** The lakes within reach, for the Places list and the tests. */
const lakesAbout = (r = 1500) => lakesNear(player.x, player.z, r).map((L) => ({ id: L.id, name: L.name, x: L.x, z: L.z, r: L.R0, rmax: L.rmax, long: L.E, beach: L.beach, ring: L.ring, frozen: L.frozen, settled: !!L.settled, kit: L.settled ? Object.assign({}, kitOf(L)) : null, far: Math.round(Math.max(0, Math.hypot(L.x - player.x, L.z - player.z) - L.R0)) }));
/** Stand on a lake's shore, on the side you came from, facing the water. */
function visitLake(id) {
  const L = lakesNear(player.x, player.z, 6000).find((q) => q.id === id);
  if (!L) return false;
  const a = Math.atan2(player.z - L.z, player.x - L.x);
  for (let k = 0; k < 24; k++) {
    const p = L.point(a + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.26, 1.24);
    if (walkable(p.x, p.z)) { travelTo(p.x, p.z, L.x, L.z); return true; }
  }
  return false;
}
initPlaces({ list: () => lakesAbout(1500).slice(0, 7), go: visitLake });
initScreen();
const resizers = [];
const resize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizePost();
  const h = renderer.domElement.height;
  resizeWeather(h);
  resizers.forEach((fn) => fn(h));
};
initPost(renderer, scene, camera);
initQuality(renderer, resize, store.settings.quality || 'auto', store.settings.gfx || null);
onQualityChange((o) => {
  grassU.density.value = o.grass;
  farForest.forEach((m) => { m.visible = o.forest; });
  TREE_REACH.value = o.forest && farForest.length ? MODEL_FAR : Infinity; // (no cards to take over: keep the tree models at any distance)
  world.wildAllowed = o.flowers; world.wildOn = null; // re-applied with the season below
});
window.addEventListener('resize', resize);

// ── Features, each isolated so one failing can't take down the rest ──
const features = { initPetVoices, initDucks, initWildlife, initSeasons, initRod, initFlowers, initFishing, initCampfire, initStargaze, initPhoto: () => initPhoto(renderNow), initMusic, initPets, initNames, initEmotes, initFriend, initWardrobe, initIceDance, initDanceCam, initDanceMusic, initFoley };
for (const [name, init] of Object.entries(features)) {
  try {
    const r = init();
    if (r && r.resize) resizers.push(r.resize);
  } catch (e) { reportProblem(name.replace(/^init/, ''), e); }
}
resize();
// the landmarks stand where you are: at the settled lake you last left them by, or the one nearest you now
updateAnchor(0, true);
updateLifeLake(0, player.x, player.z, true); // (and the ducks, the heron and the mist are at the lake you are at)

// ── Hotkeys ──
bindKey('KeyH', () => togglePanel('controls'));
bindKey('KeyQ', cycleWeather);
bindKey('KeyL', goLive);
bindKey('BracketLeft', () => setManual(timeCtl.target - 0.5));
bindKey('BracketRight', () => setManual(timeCtl.target + 0.5));
onRainStopped(shakeDogs);

// ── Persist the time and weather choice ──
if (store.time && !timeCtl.fromUrl && store.time.live === false && typeof store.time.hour === 'number') setManual(store.time.hour);
restoreWeather(store.weather);
onSave((s) => {
  s.time = { live: timeCtl.live, hour: timeCtl.target };
  s.weather = { auto: wx.auto, type: wx.type };
  s.where = { seed: WORLD.seed, x: +player.x.toFixed(2), z: +player.z.toFixed(2) };
});

// ── Apply the time-of-day palette to the scene ──
const waterLight = cur.light.clone();
const sunScreen = new THREE.Vector3();
function applySky() {
  weatherModify(cur);
  skyU.sunDir.value.copy(sunDir);
  skyU.moonDir.value.copy(moonDir);
  skyU.moonAmt.value = (1 - smooth(-4, 8, solar.sunElev)) * (1 - wx.cloud * 0.9);
  skyU.moonPhase.value = solar.moonPhase;
  skyU.topColor.value.copy(cur.top);
  skyU.horizonColor.value.copy(cur.horizon);
  skyU.sunColor.value.copy(cur.glow);
  skyU.stars.value = cur.stars;
  neonU.value = (1 - smooth(-10, -2, solar.sunElev)) * (1 - wx.fog * 0.4) * (1 - wx.snow * 0.85); // the flowers glow neon once the sun is well down (dimmed under snow)
  groundU.haze.value = 0.62 + 0.38 * clamp(Math.max(wx.fog, wx.rain * 0.5, wx.snow * 0.5), 0, 1); // far hills show through the haze, unless the weather hides them
  groundU.bloom.value = seasonState.flowerFrac ?? 1;
  const wildOn = seasonState.name !== 'Winter' && world.wildAllowed !== false; // the wildflowers die back under the snow (or are switched off)
  if (world.wild && world.wildOn !== wildOn) { world.wildOn = wildOn; world.wild.forEach((h) => { h.visible = wildOn; }); }
  groundU.autumn.value += ((seasonState.name === 'Autumn' ? 1 : 0) - groundU.autumn.value) * 0.02; // leaves gather and melt away slowly
  scene.fog.color.copy(cur.horizon);
  scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;
  waterU.fogColor.value.copy(cur.horizon);
  waterU.fogGlow.value.copy(cur.glow); waterU.fogSun.value.copy(sunDir);
  waterU.lampAmt.value = cur.eve;
  if (world.bloomMesh) world.bloomMesh.material.emissiveIntensity = 1 + cur.eve * 4; // lilies glow softly at night
  waterU.fogNear.value = cur.fogNear; waterU.fogFar.value = cur.fogFar;
  waterU.deep.value.copy(cur.deep); waterU.shallow.value.copy(cur.shallow);
  waterU.sunDir.value.copy(lightDir);
  waterU.sunColor.value.copy(waterLight.copy(cur.light).multiplyScalar(clamp(cur.lightI * 1.3, 0.45, 1.3)));
  waterU.uIceLight.value = (0.3 + 0.7 * Math.max(cur.day, 0.08)) * (1 - wx.cloud * 0.25);
  waterU.uLight.value = 0.3 + 0.7 * Math.max(cur.day, 0.1);
  sun.color.copy(cur.light); sun.intensity = cur.lightI;
  hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = cur.hemiI;
  ambient.intensity = cur.amb;
  tintClouds(cur.cloud, cur.glow, sunDir, camera.position);
  lampMat.emissiveIntensity = cur.eve * 1.6;
  if (lampGlows.length) lampGlows[0].material.opacity = cur.eve * 0.75; // the lamps share one glow material
  lampGlows.forEach((g) => { g.visible = cur.eve > 0.02; });
  ffMat.opacity = cur.eve * 0.95 * (1 - wx.rain) * (1 - wx.snow * 0.8) * seasonState.bugs;
  fireflies.visible = cur.eve > 0.02 && seasonState.bugs > 0.05;
  const showBf = cur.day > 0.5 && seasonState.bugs > 0.5 && wx.rain < 0.2 && wx.snow < 0.3 && wx.fog < 0.6 && wx.storm < 0.1;
  butterflies.forEach((b) => { b.g.visible = showBf; });
  // pollen glints in clear daylight, most of all in low golden sun
  const pollenAmt = cur.day * (1 - wx.rain) * (1 - wx.snow) * (1 - wx.fog * 0.8) * (1 - wx.cloud * 0.6) * (0.3 + 0.7 * seasonState.bugs);
  pollenMat.opacity = pollenAmt * (0.45 + 0.35 * (1 - smooth(10, 40, solar.sunElev)));
  pollen.visible = pollenAmt > 0.03;
  birds.visible = cur.day > 0.25 && wx.rain < 0.3 && wx.snow < 0.3 && wx.storm < 0.1;
  birdMat.color.copy(cur.hemiGround).multiplyScalar(0.55); // silhouettes, a little lifted by the haze
  post.bloom = smooth(0.2, 0.8, cur.eve) * (1 - wx.fog * 0.6);
  // sunbeams when the sun is on screen (or just off it), strongest when it is low
  sunScreen.copy(sunDir).multiplyScalar(500).add(camera.position).project(camera);
  const onScreen = sunScreen.z < 1 && Math.abs(sunScreen.x) < 1.4 && Math.abs(sunScreen.y) < 1.4;
  post.rays = onScreen ? cur.day * (1 - wx.cloud * 0.85) * (1 - wx.fog) * (1 - wx.rain) * (0.45 + 0.55 * (1 - smooth(8, 35, solar.sunElev))) * (1 - smooth(1.0, 1.4, Math.max(Math.abs(sunScreen.x), Math.abs(sunScreen.y)))) : 0;
  post.sunPos.set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5);
  post.raysTint.copy(cur.glow).lerp(cur.light, 0.4);
  setClockLabel(periodName(timeCtl.hour) + ' · ' + formatHour(timeCtl.hour) + (timeCtl.live ? ' · live' : '') + (seasonState.name ? ' · ' + seasonState.name : '') + (WX_LABEL[wx.type] ? ' · ' + WX_LABEL[wx.type] : ''));
}

// ── The frame ──
function safe(name, fn) {
  try { fn(); } catch (e) { reportProblem(name, e); }
}
function runHooks(list, name, ...args) {
  for (let i = list.length - 1; i >= 0; i--) {
    try { list[i](...args); } catch (e) { reportProblem(name, e); list.splice(i, 1); }
  }
}
let actionTimer = 0;
const sunAim = new THREE.Vector3();
export function tick(dt) {
  clock.elapsed += dt;
  timeU.value += dt * (reduceMotion ? 0.35 : 1) * (1 + wx.wind * 0.7);
  waterU.uTime.value = clock.elapsed * (reduceMotion ? 0.4 : 1);
  skyU.uTime.value = waterU.uTime.value;
  safe('weather', () => updateWeather(dt, { hour: timeCtl.hour, sunElev: solar.sunElev, center: player }));
  safe('time', () => { advanceTime(dt); applySky(); });
  safe('boat', () => updateBoat(dt, clock.elapsed, cur.eve, cur.day));
  safe('player', () => updatePlayer(dt, updatePetting));
  safe('places', () => updateAnchor(dt));
  safe('lake life', () => updateLifeLake(dt, player.x, player.z));
  safe('camera', () => updateCamera(dt, player));
  audio.listener.x = camera.position.x; audio.listener.z = camera.position.z; audio.listener.yaw = camState.yaw;
  safe('animals', () => { for (const a of animals) updateAnimal(a, dt, clock.elapsed); separateAnimals(); });
  safe('ambient', () => updateAmbientLife(dt, clock.elapsed, camTarget, cur.day, wx.wind));
  safe('effects', () => updateEffects(dt, cur.day));
  safe('precipitation', () => updatePrecip(dt, clock.elapsed, camera, cur, sunDir, solar.sunElev));
  safe('sound', () => updateBeds(dt, { nearWater: 1 - smooth(1.0, 1.9, lakeT(player.x, player.z)), day: cur.day, eve: cur.eve, rain: wx.rain, storm: wx.storm, snow: wx.snow, wind: wx.wind, bugs: seasonState.bugs }));
  runHooks(hooks.frame, 'a feature', dt, clock.elapsed, camera);
  sky.position.copy(camera.position);
  sunAim.set(camTarget.x, camTarget.y - 1.55, camTarget.z);
  placeSun(sunAim, lightDir);
  safe('detail', () => updateDetail(camera, camTarget));
  safe('grass', () => updateGrassMap(camera.position.x, camera.position.z));
  updateAtmosphere(camera, sunDir, cur.glow, 1, lampSpots, cur.eve);
  actionTimer -= dt;
  if (actionTimer <= 0) { actionTimer = 0.1; safe('prompts', () => renderPrompts(evaluateActions())); }
  updateHud(dt);
}
function renderNow() {
  renderFrame(quality.opts.effects);
}

let last = performance.now();
function frame(now) {
  const real = (now - last) / 1000;
  const dt = clamp(real, 0, 0.05);
  last = now;
  tick(dt);
  // (before drawing: a resolution change resizes the canvas, which clears it, so it must be redrawn at once
  // in the same frame; done after drawing, the cleared canvas would be shown for a frame as a black flicker)
  tickQuality(clamp(real, 0, 0.5));
  // the ground: choose the tiles round the camera, and spend a few milliseconds making new ones
  updateGround(camera.position.x, camera.position.z);
  pumpGround(3);
  updateWilds(camera.position.x, camera.position.z);
  updateWater(camera.position.x, camera.position.z);
  updateLakeLife(camera.position.x, camera.position.z);
  renderNow();
  requestAnimationFrame(frame);
}
advanceTime(0);
applySky();
updateBoat(0, 0, cur.eve, cur.day);
updatePlayer(0, updatePetting);
updateCamera(0, player);
updateDetail(camera, camTarget);
settleGround(camera.position.x, camera.position.z);
updateGrassMap(camera.position.x, camera.position.z);
renderer.shadowMap.needsUpdate = true;
renderNow();
loadingFinished();
quality.fast = true; // tune quickly while the start screen is up
loadingDone(() => { quality.fast = false; });
requestAnimationFrame(frame);

// A small handle for automated tests and the debug panel.
window.__meadow = {
  get undergrowth() { return world.undergrowth; }, trees: () => treeSpots, get shrine() { return world.shrine; }, tick, player, animals, activity, wx, timeCtl, seasonState, store, ferry, boatSeat, BOARD_POINT, camState, fire, quality, audio, moonDir, sunDir, solar, rng, get renderer() { return renderer; },
  actions: () => evaluateActions().map((a) => ({ id: a.id, key: a.key, label: a.label(), disabled: !!(a.disabled && a.disabled()) })),
  fishing: fishingState, fishingInfo, ducks: duckState, season: seasonNow, photoSaves: photoSaveCount, flowers: flowerView, rod: rodView, pets: petsView, fetch: fetchView, friend: friendView, get friendSt() { return friend && friend.st; }, dance: danceView, snowman: snowmanView, wardrobe: wardrobeNow, emote: playEmote, emoteState, toast,
  geo: { get lakePoint() { return lakePoint; }, lakeT, walkable, dockAt, dockDir, onDock, FIRE_SPOT, BENCH_SPOT, height, heightAt, bench: () => seats.find((s) => s.name === 'bench') }, // (lakePoint: whichever lake the landmarks stand at)
  seed: WORLD.seed,
  /** Lakes: those about you, the ones with water drawn just now, and a way to go to one or to any spot. */
  lakes: lakesAbout, waterLakes, visitLake, travelTo,
  /** Lake life: the lake the creatures are at, and the reeds and lilies drawn just now. */
  life: () => Object.assign({ lake: lifeLake.id }, lifeStats),
  lakeLife: (id) => { const L = lakesNear(player.x, player.z, 6000).find((q) => q.id === id); if (!L) return null; const l = lifeOf(L); return { reeds: l.reeds.length, heads: l.heads.length, pads: l.pads.length, blooms: l.blooms.length, key: JSON.stringify([l.reeds, l.pads].map((list) => list.map((it) => [it.x, it.z, it.s]))) }; },
  /** The landmarks: which lake they stand at, what it has, the settled lakes about, and a way to send them to one. */
  anchor: anchorId, get kit() { return Object.assign({}, KIT); }, settled: settledAbout, boatShown: () => boat.visible,
  moveAnchor: (id) => { const L = lakesNear(player.x, player.z, 6000).find((q) => q.id === id); return !!L && moveAnchor(L); },
  /** What the scene holds besides the ground's own pooled tiles (which fill up once and are then reused), and the lists things are registered in. */
  counts: () => { let n = 0; scene.traverse(() => { n++; }); return { objects: n - groundStats().parts, obstacles: obstacles.length, seats: seats.length }; },
  /** The climate at a spot: how much snow lies, how parched, how lush, how much of a blossom grove (each 0..1). */
  climate: (x, z) => { const rain = rainAt(x, z); return { snow: snowOf(coldAt(x, z, height(x, z))), dry: dryOf(rain), lush: lushOf(rain), grove: groveAt(x, z) }; },
  // the ground's tiles: what is loaded, and ways to bring it up to date without waiting for frames
  ground: { stats: groundStats, update: updateGround, pump: pumpGround, settle: settleGround },
  // the trees beyond the valley: what is loaded, a way to bring it up to date, and one square's trees
  wilds: { stats: wildStats, settle: settleWilds, square: growSquare, rocks: growRocks, small: (ix, iz) => growSmall(ix, iz, growSquare(ix, iz)) },
  /** How many objects the scene holds (it must not creep up as you travel). */
  objects: () => { let n = 0; scene.traverse(() => { n++; }); return n; },
  hour: () => wrap24(timeCtl.hour),
};
if (debug) import('./debug.js').then((m) => m.initDebug(window.__meadow)).catch((e) => console.error(e));
