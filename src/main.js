// Stillwater Meadow: boot, build the world in a fixed order, and run the frame loop.
import './style.css';
import { updateAtmosphere } from './core/atmosphere.js'; // patches the fog shader; keep first
import * as THREE from 'three';
import { clamp, smooth, rng } from './core/math.js';
import { reduceMotion, debug, query } from './core/env.js';
import { scene, camera, canvas, createRenderer } from './core/render.js';
import { timeU, updateDetail, neonU } from './core/materials.js';
import { lakeT, lakePoint, walkable, dockAt, dockDir, onDock, FIRE_SPOT, SPAWN, WORLD, height, rawHeight, heightAt, shrineSitesNear, coldAt, moistAt, snowCold, dryOf, lushOf, snowOf, groveAt, lakesNear, groundAt, kitOf, KIT, BENCH_SPOT, HOME, landNear, riverNear, harbourById, slopeAt, continentAt, latitudeAt, beltOf, seaAt } from './core/shape.js';
import { hooks, seasonState, seats, world, obstacles } from './core/state.js';
import { clock } from './core/clock.js';
import { buildSky, sky, skyU } from './world/sky.js';
import { buildLights, hemi, ambient, sun, placeSun } from './world/lights.js';
import { buildGround, updateGround, pumpGround, settleGround, groundStats, groundU } from './world/terrain.js';
import { buildWater, updateWater, waterLakes, waterU, seaShown, seaDrawnAt } from './world/water.js';
import { updateRivers, riversShown, resizeRivers, riversView } from './world/rivers.js';
import { updateCrossings, crossingsShown } from './world/crossings.js';
import { updateTrailside, lightTrailside, trailsideShown, lanternSpots } from './world/trailside.js';
import { buildTrees, buildRocks, buildGrass, buildFlowers, buildReedsAndPads, buildUndergrowth, treeSpots, TREE_REACH, MODEL_FAR } from './world/vegetation.js';
import { loadKit, kit } from './core/assets.js';
import { loadingStep, paint, loadingDone, initScreen } from './ui/loading.js';
import { buildDockAndBench, buildChairs, buildLamps, lampMat, lampGlows, lampSpots } from './world/props.js';

import { buildWildflowers } from './world/wildflowers.js';
import { buildFarForest } from './world/farforest.js';
import { chooseShrineSite, buildShrine, shrineNear } from './world/shrine.js';
import { buildClouds, buildFireflies, buildButterflies, buildPollen, buildBirds, birds, birdMat, updateAmbientLife, tintClouds, ffMat, fireflies, butterflies, pollen, pollenMat } from './world/ambient.js';
import { buildEffects, updateEffects } from './world/effects.js';
import { player, hero, buildPlayer, updatePlayer } from './characters/player.js';
import { resetMoves, movesView, pressJump, dropFrom, MOVES } from './characters/moves.js';
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
import { updateWilds, settleWilds, wildStats, growSquare, growRocks, growSmall, growPicks, picksNear, growBiome } from './world/wilds.js';
import { buildBiomeThings } from './world/biomethings.js';
import { biomesAt, biomeAt } from './core/biome.js';
import { initPost, resizePost, renderFrame, post } from './systems/post.js';
import { store, onSave, flush, saveSoon, landChanged, worldSeedText } from './systems/save.js';
import { initHud, updateHud, renderPrompts, setClockLabel, togglePanel, reportProblem, showFatal, toast } from './ui/hud.js';
import { initWorldPanel, hereText } from './ui/world-panel.js';
import { nearestCountries } from './ui/countries.js';
import { initConsole, runCommand, problems, typed } from './ui/console.js';
import { initCommands } from './features/commands.js';
import { initBackpack, backpackView } from './ui/backpack.js';
import { initFoundPlaces, foundView } from './features/places.js';
import { initMap, mapView } from './ui/map.js';
import { initWaypoints, waypointsView, travelToPoint, track } from './features/waypoints.js';
import { initHarbours, harboursView, sail } from './features/harbours.js';
import { initGlider, gliderView } from './features/glider.js';
import { initCamp } from './features/camp.js';
import { initLandmarks, landmarksView, landmarkBlocks, landmarkSeats } from './world/landmarks.js';
import { initSignposts, signsNear, signBlocks } from './world/signposts.js';
import { initCloudSea } from './world/cloudsea.js';
import * as pack from './systems/pack.js';
import { initCompass, compassView } from './ui/compass.js';
import { updateAnchor, moveAnchor, anchorId, settledAbout } from './systems/anchor.js';
import { initSettings } from './ui/settings.js';
import { initPetVoices } from './features/voices.js';
import { initDucks, duckState } from './features/ducks.js';
import { initWildlife, wildView } from './features/wildlife.js';
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
import { initIceDance, danceView, snowmanView } from './features/icedance.js';
import { initDanceCam } from './features/dancecam.js';
import { initDanceMusic } from './features/dancemusic.js';
import { initFoley } from './features/foley.js';
import { ferry, boatSeat, BOARD_POINT, boat } from './characters/boat.js';
import { updateLakeLife, updateLifeLake, lifeLake, lifeStats, lifeOf } from './world/lakelife.js';
import { seasonNow, holdPhase, settleSeason } from './features/seasons.js';

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
buildBiomeThings();
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
shrineNear(player.x, player.z, true); // (the shrine stands at the site nearest where you start)
settleWilds(player.x, player.z);
// when the landmarks move to another lake: the grass keeps off them there, and the shadows are redrawn
hooks.anchor.push(() => { resetGrassMap(); renderer.shadowMap.needsUpdate = true; });

// ── Interface and systems ──
initHud();
initBackpack();
initCompass();
initPointer();
initSettings();
initWorldPanel();
/** Go to a spot at once (the Places list): the ground and what grows there are made ready first. */
function travelTo(x, z, faceX, faceZ) {
  if (!walkable(x, z)) { const to = landNear(x, z); if (faceX === undefined && (to.x !== x || to.z !== z)) { faceX = x; faceZ = z; } x = to.x; z = to.z; } // (out at sea, say: the nearest shore, facing it)
  resetMoves();
  player.x = x; player.z = z; player.slide = null; player.y = groundAt(x, z);
  if (faceX !== undefined) { player.rot = Math.atan2(faceX - x, faceZ - z); camState.yaw = Math.atan2(x - faceX, z - faceZ); }
  updateAnchor(0, true); // (if this is another settled lake, its jetty, fire and bench are here when you arrive)
  updateLifeLake(0, x, z, true);
  shrineNear(x, z, true); // (and the shrine, if a site of its own is nearer here)
  settleSeason(x, z); // (and the season is the one here)
  settleGround(x, z); settleWilds(x, z); updateWater(x, z, true); updateRivers(x, z, true); updateCrossings(x, z, true); updateTrailside(x, z, true); updateLakeLife(x, z);
  // your companions come with you: your friend if you walk together, and the dogs following you
  if (friend && friend.st && friend.st.together) { friend.st.x = x + 1; friend.st.z = z + 0.5; friend.st.y = groundAt(x + 1, z + 0.5); }
  for (const a of animals) if (a.state === 'follow') { const ang = Math.random() * Math.PI * 2; a.x = x + Math.cos(ang) * 2; a.z = z + Math.sin(ang) * 2; if (a.root) a.root.position.set(a.x, groundAt(a.x, a.z), a.z); }
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
initConsole();
initCommands({ go: travelTo, visitLake, report: makeReport });
initScreen();
const resizers = [];
const resize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizePost();
  const h = renderer.domElement.height;
  resizeWeather(h);
  resizeRivers(h);
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
const features = { initCloudSea, initSignposts, initFoundPlaces: () => initFoundPlaces((x, z) => travelTo(x, z)), initMap: () => initMap((x, z) => travelTo(x, z)), initWaypoints: () => initWaypoints(travelTo, () => groundStats().queued), initHarbours, initGlider, initCamp, initLandmarks, initPetVoices, initDucks, initWildlife, initSeasons, initRod, initFlowers, initFishing, initCampfire, initStargaze, initPhoto: () => initPhoto(renderNow), initMusic, initPets, initNames, initEmotes, initFriend, initIceDance, initDanceCam, initDanceMusic, initFoley };
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
onRainStopped(shakeDogs);

// ── Persist the time and weather choice ──
if (store.time && !timeCtl.fromUrl && store.time.live === false && typeof store.time.hour === 'number') setManual(store.time.hour);
restoreWeather(store.weather);
onSave((s) => {
  s.time = { live: timeCtl.live, hour: timeCtl.target };
  s.weather = { auto: wx.auto, type: wx.type };
  if (!player.mode) s.where = { seed: WORLD.seed, x: +player.x.toFixed(2), z: +player.z.toFixed(2) }; // (not on a face or in the air: you wake where you last stood)
});

// ── Apply the time-of-day palette to the scene ──
const waterLight = cur.light.clone();
const sunScreen = new THREE.Vector3();
// The air of a place: in a blossom grove the sky, the haze and the light turn toward pink and lavender, and
// a mist closes in (after the owner's picture of a cherry blossom valley: a third of it pink, a third of
// it bright, almost none of it green). Eased in as you walk into one; less at night, and under snow.
let groveAir = 0;
const airC = new THREE.Color(), lumOf = (c) => 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
function airOfPlace() {
  groveAir += ((seasonState.groveHere || 0) * (seasonState.winterHere ? 0.35 : 1) - groveAir) * 0.02;
  const g = smooth(0.15, 0.7, groveAir);
  if (g <= 0.002) return;
  // toward a colour, at about the brightness the thing already has (so night stays night), a little lifted
  const toward = (c, hex, k, lift = 1.12) => { airC.set(hex); c.lerp(airC.multiplyScalar(Math.min(1.7, (lumOf(c) + 0.03) / lumOf(airC) * lift)), k * g); };
  toward(cur.top, '#c3a2ea', 0.6); toward(cur.horizon, '#f8c3dd', 0.75, 1.2); toward(cur.glow, '#ffc7dc', 0.5);
  toward(cur.light, '#ffdfeb', 0.4); toward(cur.hemiSky, '#f5cde6', 0.55, 1.2); toward(cur.hemiGround, '#d6a0b6', 0.6, 1.25);
  if (cur.cloud) toward(cur.cloud, '#ffe3ef', 0.5);
  cur.fogNear *= 1 - 0.35 * g; cur.fogFar *= 1 - 0.3 * g;
  cur.hemiI *= 1 + 0.22 * g; cur.amb *= 1 + 0.2 * g;
}
function applySky() {
  weatherModify(cur);
  airOfPlace();
  skyU.sunDir.value.copy(sunDir);
  skyU.moonDir.value.copy(moonDir);
  skyU.moonAmt.value = (1 - smooth(-4, 8, solar.sunElev)) * (1 - wx.cloud * 0.9);
  skyU.moonPhase.value = solar.moonPhase;
  skyU.topColor.value.copy(cur.top);
  skyU.horizonColor.value.copy(cur.horizon);
  skyU.sunColor.value.copy(cur.glow);
  skyU.stars.value = cur.stars;
  skyU.aurora.value += ((seasonState.auroraHere || 0) * (1 - wx.cloud * 0.9) - skyU.aurora.value) * 0.01;
  neonU.value = (1 - smooth(-10, -2, solar.sunElev)) * (1 - wx.fog * 0.4) * (1 - wx.snow * 0.85); // the flowers glow neon once the sun is well down (dimmed under snow)
  groundU.haze.value = 0.62 + 0.38 * clamp(Math.max(wx.fog, wx.rain * 0.5, wx.snow * 0.5), 0, 1); // far hills show through the haze, unless the weather hides them
  groundU.bloom.value = seasonState.flowerFrac ?? 1;
  const wildOn = seasonState.flowerFrac > 0.05 && world.wildAllowed !== false; // the wildflowers die back under the snow (or are switched off)
  if (world.wild && world.wildOn !== wildOn) { world.wildOn = wildOn; world.wild.forEach((h) => { h.visible = wildOn; }); }
  groundU.autumn.value += ((seasonState.leavesHere === 'autumn' ? 1 : 0) - groundU.autumn.value) * 0.02; // leaves gather and melt away slowly
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
  lightTrailside(cur.eve);
  if (lampGlows.length) lampGlows[0].material.opacity = cur.eve * 0.75; // the lamps share one glow material
  lampGlows.forEach((g) => { g.visible = cur.eve > 0.02; });
  const ffAmt = Math.max(seasonState.bugs, seasonState.enchantedHere || 0); // (the enchanted wood has its fireflies in any season)
  ffMat.opacity = cur.eve * 0.95 * (1 - wx.rain) * (1 - wx.snow * 0.8) * ffAmt;
  fireflies.visible = cur.eve > 0.02 && ffAmt > 0.05;
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
  setClockLabel(periodName(timeCtl.hour) + ' · ' + formatHour(timeCtl.hour) + (timeCtl.live ? ' · live' : '') + (seasonState.nameHere ? ' · ' + seasonState.nameHere : '') + (WX_LABEL[wx.type] ? ' · ' + WX_LABEL[wx.type] : ''));
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

/**
 * A report of how things stand, for the `report` command (features/commands.js): the view as it is
 * drawn just now (a PNG, as a data URL; the game's own picture, without the interface over it) and
 * everything there is to say about where you are and what the game is doing.
 */
function makeReport() {
  const m = window.__meadow, x = player.x, z = player.z, gl = renderer.getContext();
  let gpu = '';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { gpu = 'unknown'; }
  const part = (fn) => { try { return fn(); } catch (e) { return 'failed: ' + e.message; } };
  renderNow(); // (drawn afresh, so the picture can be read back at once)
  const picture = part(() => canvas.toDataURL('image/png'));
  const info = {
    made: new Date().toISOString(), address: location.href, seed: WORLD.seed, seedText: worldSeedText,
    you: part(() => ({ x: +x.toFixed(2), z: +z.toFixed(2), y: +player.y.toFixed(2), facing: +player.rot.toFixed(3), ground: +groundAt(x, z).toFixed(2), slope: +slopeAt(x, z).toFixed(2), walkable: walkable(x, z), fromHome: Math.round(Math.hypot(x - HOME.x, z - HOME.z)), activity: activity.current, mode: player.mode || null, seat: player.seat ? player.seat.name : null, onFloor: !!player.floor, skating: !!player.skating, moving: +player.move.toFixed(2) })),
    moves: part(() => { const v = movesView(); return { mode: v.mode, vy: +v.vy.toFixed(2), speed: +v.speed.toFixed(2), landing: v.landing, rolling: v.rolling }; }),
    camera: part(() => ({ yaw: +camState.yaw.toFixed(3), pitch: +camState.pitch.toFixed(3), dist: +camState.dist.toFixed(2), x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1), far: camera.far })),
    time: part(() => ({ hour: +wrap24(timeCtl.hour).toFixed(2), shown: formatHour(timeCtl.hour), live: timeCtl.live, period: periodName(timeCtl.hour) })),
    weather: part(() => ({ type: wx.type, auto: wx.auto, wind: +wx.wind.toFixed(2), wet: +wx.wet.toFixed(2) })),
    season: part(() => Object.assign({}, seasonState, { mapWeather: undefined })),
    here: part(() => hereText()),
    place: part(() => { const c = continentAt(x, z), L = latitudeAt(x, z), lake = lakesNear(x, z, 600)[0]; return { continent: c ? c.name : null, belt: beltOf(L), latitude: +L.toFixed(3), sea: +seaAt(x, z).toFixed(3), climate: m.climate(x, z), biomes: m.biomes(x, z), biome: m.biomeAt(x, z), river: !!riverNear(x, z), nearestLake: lake ? { name: lake.name, far: Math.round(Math.hypot(lake.x - x, lake.z - z)), frozen: !!lake.frozen } : null }; }),
    about: part(() => ({ landmarks: landmarksView().map((l) => ({ kind: l.kind, name: l.name, far: Math.round(Math.hypot(l.x - x, l.z - z)) })), harbours: harboursView().near.slice(0, 3).map((h) => ({ name: h.name, far: Math.round(Math.hypot(h.x - x, h.z - z)), known: h.known })), actions: evaluateActions().map((a) => a.id) })),
    carried: part(() => ({ pack: pack.packView().filter(Boolean).map((it) => `${it.type}${it.key !== null && it.key !== undefined ? ':' + it.key : ''} x${it.n}${it.held ? ' (held)' : ''}`), glider: gliderView().has })),
    travel: part(() => { const w = waypointsView(); return { awake: w.awake.length, tracking: w.track, harboursKnown: harboursView().known.length, placesFound: foundView().length, mapCells: mapView().cells, mapKm2: +(mapView().cells * 32 * 32 / 1e6).toFixed(2) }; }),
    drawing: part(() => ({ fps: Math.round(quality.fps), quality: quality.level, setting: quality.setting, options: quality.opts, scale: quality.scale, pixelRatio: quality.dpr, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, ground: groundStats(), wilds: wildStats(), objects: m.objects() })),
    debug: { tickRate: clock.rate, frozen: clock.frozen, walkSpeed: clock.walk, landNumber: store.gen, typed: typed.slice(-20), problems: problems.slice() },
    machine: { screen: `${window.innerWidth}x${window.innerHeight}`, devicePixelRatio: window.devicePixelRatio, canvas: `${canvas.width}x${canvas.height}`, gpu, browser: navigator.userAgent, touch: matchMedia('(pointer: coarse)').matches, language: navigator.language },
  };
  return { picture, info };
}

let last = performance.now();
function frame(now) {
  const real = (now - last) / 1000;
  const dt = clamp(real, 0, 0.05);
  last = now;
  // (the game's own time: as real time, unless a debug command has it faster, slower, frozen or stepping;
  // run faster, it is taken in steps no longer than a real frame's, so nothing moves too far at once)
  if (clock.frozen) { if (clock.steps > 0) { clock.steps--; tick(1 / 60); } else tick(0); }
  else if (clock.rate === 1) tick(dt);
  else { const n = Math.max(1, Math.ceil(clock.rate)); for (let i = 0; i < n; i++) tick(dt * clock.rate / n); }
  // (before drawing: a resolution change resizes the canvas, which clears it, so it must be redrawn at once
  // in the same frame; done after drawing, the cleared canvas would be shown for a frame as a black flicker)
  tickQuality(clamp(real, 0, 0.5));
  // the ground: choose the tiles round the camera, and spend a few milliseconds making new ones
  const far = [1900, 3200, 3600][quality.opts.view === undefined ? 1 : quality.opts.view]; if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); } // (the view distance setting)
  updateGround(camera.position.x, camera.position.z);
  pumpGround(3);
  updateWilds(camera.position.x, camera.position.z);
  updateWater(camera.position.x, camera.position.z);
  updateRivers(camera.position.x, camera.position.z);
  updateCrossings(camera.position.x, camera.position.z);
  updateTrailside(camera.position.x, camera.position.z);
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
loadingDone(() => { quality.fast = false; if (landChanged) setTimeout(() => { toast('The land beyond home has changed since you were last here: the world now has poles and an equator. Your map, places and waystones start afresh; what you carry and your journals are kept.', 12); saveSoon(); }, 6500); }); // (after the welcome's own line)
requestAnimationFrame(frame);

// A small handle for automated tests and the debug panel.
window.__meadow = {
  get undergrowth() { return world.undergrowth; }, trees: () => treeSpots, get shrine() { return world.shrine; }, get shrineStands() { return world.shrineStands; }, blockedAt: (x, z) => obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r), tick, player, animals, activity, wx, timeCtl, seasonState, store, ferry, boatSeat, BOARD_POINT, camState, fire, quality, audio, moonDir, sunDir, solar, rng, get renderer() { return renderer; },
  actions: () => evaluateActions().map((a) => ({ id: a.id, key: a.key, label: a.label(), disabled: !!(a.disabled && a.disabled()) })),
  fishing: fishingState, fishingInfo, ducks: duckState, season: seasonNow, photoSaves: photoSaveCount, flowers: flowerView, rod: rodView, pets: petsView, fetch: fetchView, friend: friendView, get friendSt() { return friend && friend.st; }, dance: danceView, snowman: snowmanView, emote: playEmote, emoteState, toast,
  geo: { get lakePoint() { return lakePoint; }, lakeT, riverNear, walkable, dockAt, dockDir, onDock, FIRE_SPOT, BENCH_SPOT, height, heightAt, bench: () => seats.find((s) => s.name === 'bench') }, // (lakePoint: whichever lake the landmarks stand at)
  seed: WORLD.seed,
  backpack: backpackView,
  found: foundView, landmarks: landmarksView, signs: signsNear,
  /** The backpack's contents and the ways to change them (systems/pack.js). */
  pack: { view: pack.packView, add: pack.add, addItem: pack.addItem, take: pack.take, count: pack.count, hold: pack.hold, held: pack.held, fish: () => pack.units('fish').map((u) => ({ id: u.key, cm: u.unit })), tie: (kinds) => world.tieBouquet(kinds) },
  compass: compassView,
  /** The map (ui/map.js): how it stands, and what of the land is explored. */
  get map() { return mapView(); },
  /** Waystones (features/waypoints.js): those awake, the points you can travel to, those asleep about you; and a way to travel to a point. */
  get waypoints() { return waypointsView(); }, travelToPoint, track,
  /** Harbours (features/harbours.js): those about you, those visited, the passages from the nearest; and a way to sail one. */
  /** Jumping, climbing, sliding, gliding (characters/moves.js): how it stands, and Space. */
  /** Run a debug command as typed (ui/console.js). */
  command: runCommand,
  get moves() { return movesView(); }, get glider() { return gliderView(); }, jump: pressJump, dropFrom, MOVES,
  get harbours() { return harboursView(); }, sail: (id) => { const h = harbourById(id); return !!h && sail(h); },
  /** The year: hold it at a phase (0 midwinter .. 0.5 midsummer; null lets it run), and how it is now. */
  year: { hold: holdPhase, get state() { return Object.assign({}, seasonState, { mapWeather: undefined }); } },
  /** The home lake's middle, and where you first arrive beside it. */
  home: { x: HOME.x, z: HOME.z, r: HOME.R0, rmax: HOME.rmax }, spawn: { x: SPAWN.x, z: SPAWN.z },
  /** Lakes: those about you, the ones with water drawn just now, and a way to go to one or to any spot. */
  lakes: lakesAbout, waterLakes, visitLake, travelTo,
  /** Lake life: the lake the creatures are at, and the reeds and lilies drawn just now. */
  life: () => Object.assign({ lake: lifeLake.id }, lifeStats),
  lakeLife: (id) => { const L = lakesNear(player.x, player.z, 6000).find((q) => q.id === id); if (!L) return null; const l = lifeOf(L); return { reeds: l.reeds.length, heads: l.heads.length, pads: l.pads.length, blooms: l.blooms.length, key: JSON.stringify([l.reeds, l.pads].map((list) => list.map((it) => [it.x, it.z, it.s]))) }; },
  /** The landmarks: which lake they stand at, what it has, the settled lakes about, and a way to send them to one. */
  anchor: anchorId, get kit() { return Object.assign({}, KIT); }, settled: settledAbout, boatShown: () => boat.visible,
  moveAnchor: (id) => { const L = lakesNear(player.x, player.z, 6000).find((q) => q.id === id); return !!L && moveAnchor(L); },
  /** What the scene holds besides the ground's own pooled tiles (which fill up once and are then reused), and the lists things are registered in. */
  // (the biomes' buildings are left out: each kind's copies are made the first time one is needed, then reused)
  counts: () => { let n = 0; const walk = (o) => { if (o.userData.pooledLandmark) return; n++; o.children.forEach(walk); }; walk(scene); return { objects: n - groundStats().parts, obstacles: obstacles.length - landmarkBlocks() - signBlocks(), seats: seats.length - landmarkSeats() }; },
  /** The climate at a spot: how much snow lies, how parched, how lush, how much of a blossom grove (each 0..1). */
  climate: (x, z) => { const wet = moistAt(x, z), cold = coldAt(x, z, height(x, z)); return { snow: snowOf(snowCold(cold, wet)), cold, wet, dry: dryOf(wet), lush: lushOf(wet), grove: groveAt(x, z) }; },
  // the ground's tiles: what is loaded, and ways to bring it up to date without waiting for frames
  ground: { stats: groundStats, update: updateGround, pump: pumpGround, settle: settleGround },
  // the trees beyond the valley: what is loaded, a way to bring it up to date, and one square's trees
  /** The shrine sites within `r` metres of you (the shrine stands at `shrine`, one of them). */
  shrines: (r = 1500) => shrineSitesNear(player.x, player.z, r), rawHeight,
  seaShown, seaDrawnAt, riversShown, riversView, crossingsShown, trailsideShown, lanternSpots,
  wild: () => wildView(),
  characters: () => ({ heroShown: hero.root.visible, friendShown: !!(friend && friend.k && friend.k.root.visible) }),
  countries: (x = player.x, z = player.z) => nearestCountries(x, z),
  wilds: { stats: wildStats, settle: settleWilds, square: growSquare, rocks: growRocks, small: (ix, iz) => growSmall(ix, iz, growSquare(ix, iz)), picks: growPicks, picksNear, biome: growBiome },
  /** The biomes at a spot (core/biome.js): their weights, and the strongest. */
  biomes: (x, z) => biomesAt(x, z, height(x, z)), biomeAt: (x, z) => biomeAt(x, z, height(x, z)),
  /** How many objects the scene holds (it must not creep up as you travel). */
  objects: () => { let n = 0; scene.traverse(() => { n++; }); return n; },
  hour: () => wrap24(timeCtl.hour),
};
if (debug) import('./debug.js').then((m) => m.initDebug(window.__meadow)).catch((e) => console.error(e));
