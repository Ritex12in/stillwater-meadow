// Stillwater Meadow: boot, build the world in a fixed order, and run the frame loop.
import './style.css';
import { updateAtmosphere } from './core/atmosphere.js'; // patches the fog shader; keep first
import { clamp, smooth, rng } from './core/math.js';
import { reduceMotion, debug } from './core/env.js';
import { scene, camera, createRenderer } from './core/render.js';
import { timeU, updateDetail } from './core/materials.js';
import { lakeT, lakePoint, walkable, dockAt, dockDir, onDock, FIRE_SPOT } from './core/shape.js';
import { hooks, seasonState, seats, world } from './core/state.js';
import { clock } from './core/clock.js';
import { buildSky, sky, skyU, starMat } from './world/sky.js';
import { buildLights, hemi, ambient, sun } from './world/lights.js';
import { buildTerrain } from './world/terrain.js';
import { buildWater, waterU } from './world/water.js';
import { buildTrees, buildRocks, buildGrass, buildFlowers, buildReedsAndPads, buildUndergrowth, treeSpots } from './world/vegetation.js';
import { loadKit, kit } from './core/assets.js';
import { buildDockAndBench, buildChairs, buildLamps, lampMat, lampGlows } from './world/props.js';
import { buildClouds, buildFireflies, buildButterflies, buildPollen, updateAmbientLife, cloudMat, ffMat, fireflies, butterflies, pollen, pollenMat } from './world/ambient.js';
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
import { quality, initQuality, tickQuality, LEVELS } from './systems/quality.js';
import { initPost, resizePost, renderFrame, post } from './systems/post.js';
import { store, onSave } from './systems/save.js';
import { initHud, updateHud, renderPrompts, setClockLabel, togglePanel, reportProblem, showFatal, toast } from './ui/hud.js';
import { initWorldPanel } from './ui/world-panel.js';
import { initSettings } from './ui/settings.js';
import { initPetVoices } from './features/voices.js';
import { initDucks, duckState } from './features/ducks.js';
import { initWildlife } from './features/wildlife.js';
import { initSeasons } from './features/seasons.js';
import { initFlowers, flowerView } from './features/flowers.js';
import { initFishing, fishingState } from './features/fishing.js';
import { initCampfire, fire } from './features/campfire.js';
import { initStargaze } from './features/stargaze.js';
import { initPhoto, photoSaveCount } from './features/photo.js';
import { initMusic } from './features/music.js';
import { initNames } from './features/names.js';
import { initFoley } from './features/foley.js';
import { ferry, boatSeat, BOARD_POINT } from './characters/boat.js';
import { seasonNow } from './features/seasons.js';

let renderer;
try {
  renderer = createRenderer();
} catch (e) {
  showFatal('Your browser could not start WebGL, which this world needs to draw the meadow.');
  throw e;
}

// ── Build the world. The order matters: it fixes where every tree and flower grows. ──
await loadKit(); // nature models; the meadow falls back to hand-built shapes without them
buildSky();
buildLights();
buildTerrain();
buildWater();
buildTrees();
buildRocks();
buildGrass();
buildFlowers();
buildReedsAndPads();
if (kit) buildUndergrowth(treeSpots);
buildDockAndBench();
buildChairs();
buildLamps();
buildClouds();
buildFireflies();
buildButterflies();
buildPollen();
buildPlayer();
buildAnimals();
buildBoat();
buildEffects();
buildWeather();
registerPetting();

// ── Interface and systems ──
initHud();
initPointer();
initSettings();
initWorldPanel();
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
initQuality(renderer, resize, store.settings.quality || 'auto');
window.addEventListener('resize', resize);

// ── Features, each isolated so one failing can't take down the rest ──
const features = { initPetVoices, initDucks, initWildlife, initSeasons, initFlowers, initFishing, initCampfire, initStargaze, initPhoto: () => initPhoto(renderNow), initMusic, initNames, initFoley };
for (const [name, init] of Object.entries(features)) {
  try {
    const r = init();
    if (r && r.resize) resizers.push(r.resize);
  } catch (e) { reportProblem(name.replace(/^init/, ''), e); }
}
resize();

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
});

// ── Apply the time-of-day palette to the scene ──
const waterLight = cur.light.clone();
function applySky() {
  weatherModify(cur);
  skyU.sunDir.value.copy(sunDir);
  skyU.moonDir.value.copy(moonDir);
  skyU.moonAmt.value = (1 - smooth(-4, 8, solar.sunElev)) * (1 - wx.cloud * 0.9);
  skyU.moonPhase.value = solar.moonPhase;
  skyU.topColor.value.copy(cur.top);
  skyU.horizonColor.value.copy(cur.horizon);
  skyU.sunColor.value.copy(cur.glow);
  starMat.opacity = cur.stars;
  scene.fog.color.copy(cur.horizon);
  scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;
  waterU.fogColor.value.copy(cur.horizon);
  waterU.fogGlow.value.copy(cur.glow); waterU.fogSun.value.copy(sunDir);
  waterU.fogNear.value = cur.fogNear; waterU.fogFar.value = cur.fogFar;
  waterU.deep.value.copy(cur.deep); waterU.shallow.value.copy(cur.shallow);
  waterU.sunDir.value.copy(lightDir);
  waterU.sunColor.value.copy(waterLight.copy(cur.light).multiplyScalar(clamp(cur.lightI * 1.3, 0.45, 1.3)));
  waterU.uIceLight.value = (0.3 + 0.7 * Math.max(cur.day, 0.08)) * (1 - wx.cloud * 0.25);
  waterU.uLight.value = 0.3 + 0.7 * Math.max(cur.day, 0.1);
  sun.color.copy(cur.light); sun.intensity = cur.lightI;
  hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = cur.hemiI;
  ambient.intensity = cur.amb;
  cloudMat.color.copy(cur.cloud); cloudMat.emissive.copy(cur.cloud);
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
  post.bloom = smooth(0.2, 0.8, cur.eve) * (1 - wx.fog * 0.6);
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
export function tick(dt) {
  clock.elapsed += dt;
  timeU.value += dt * (reduceMotion ? 0.35 : 1) * (1 + wx.wind * 0.7);
  waterU.uTime.value = clock.elapsed * (reduceMotion ? 0.4 : 1);
  safe('weather', () => updateWeather(dt, { hour: timeCtl.hour, sunElev: solar.sunElev, center: player }));
  safe('time', () => { advanceTime(dt); applySky(); });
  safe('boat', () => updateBoat(dt, clock.elapsed, cur.eve, cur.day));
  safe('player', () => updatePlayer(dt, updatePetting));
  safe('camera', () => updateCamera(dt, player));
  audio.listener.x = camera.position.x; audio.listener.z = camera.position.z; audio.listener.yaw = camState.yaw;
  safe('animals', () => { for (const a of animals) updateAnimal(a, dt, clock.elapsed); separateAnimals(); });
  safe('ambient', () => updateAmbientLife(dt, clock.elapsed, camTarget, cur.day, wx.wind));
  safe('effects', () => updateEffects(dt, cur.day));
  safe('precipitation', () => updatePrecip(dt, clock.elapsed, camera, cur, sunDir, solar.sunElev));
  safe('sound', () => updateBeds(dt, { nearWater: 1 - smooth(1.0, 1.9, lakeT(player.x, player.z)), day: cur.day, eve: cur.eve, rain: wx.rain, storm: wx.storm, snow: wx.snow, wind: wx.wind, bugs: seasonState.bugs }));
  runHooks(hooks.frame, 'a feature', dt, clock.elapsed, camera);
  sky.position.copy(camera.position);
  sun.position.set(camTarget.x + lightDir.x * 140, camTarget.y - 1.55 + lightDir.y * 140, camTarget.z + lightDir.z * 140);
  sun.target.position.set(camTarget.x, camTarget.y - 1.55, camTarget.z);
  safe('detail', () => updateDetail(camera, camTarget));
  updateAtmosphere(camera, sunDir, cur.glow, 1);
  actionTimer -= dt;
  if (actionTimer <= 0) { actionTimer = 0.1; safe('prompts', () => renderPrompts(evaluateActions())); }
  updateHud(dt);
}
function renderNow() { renderFrame(LEVELS[quality.level].bloom); }

let last = performance.now();
function frame(now) {
  const real = (now - last) / 1000;
  const dt = clamp(real, 0, 0.05);
  last = now;
  tick(dt);
  renderNow();
  tickQuality(clamp(real, 0, 0.5));
  requestAnimationFrame(frame);
}
advanceTime(0);
applySky();
updateBoat(0, 0, cur.eve, cur.day);
updatePlayer(0, updatePetting);
updateCamera(0, player);
updateDetail(camera, camTarget);
renderer.shadowMap.needsUpdate = true;
renderNow();
requestAnimationFrame(frame);

// A small handle for automated tests and the debug panel.
window.__meadow = {
  get undergrowth() { return world.undergrowth; }, trees: () => treeSpots, tick, player, animals, activity, wx, timeCtl, seasonState, store, ferry, boatSeat, BOARD_POINT, camState, fire, quality, audio, moonDir, sunDir, solar, rng, get renderer() { return renderer; },
  actions: () => evaluateActions().map((a) => ({ id: a.id, key: a.key, label: a.label(), disabled: !!(a.disabled && a.disabled()) })),
  fishing: fishingState, ducks: duckState, season: seasonNow, photoSaves: photoSaveCount, flowers: flowerView, toast,
  geo: { lakePoint, walkable, dockAt, dockDir, onDock, FIRE_SPOT, bench: () => seats.find((s) => s.name === 'bench') },
  hour: () => wrap24(timeCtl.hour),
};
if (debug) import('./debug.js').then((m) => m.initDebug(window.__meadow)).catch((e) => console.error(e));
