// The debug commands (ui/console.js: the `/` key). What the World panel's pickers and lists used to
// do, and a few things more:
//   help                      the commands
//   time 14 | 14:30 | +2 | -1 | live     the time of day
//   weather clear|rain|storm|fog|snow|auto
//   season spring|summer|autumn|winter|auto
//   pos                       where you are: the spot, its height, continent, belt, biome
//   tp <x> <z> | tp home      go to a spot
//   goto                      the kinds of country and things there are to go to, and how far each is
//   goto <kind>               go to the nearest: a kind of country (desert, swamp, snow ...), or
//                             waystone, harbour, cairn, castle (any building), glider, lake
//   lakes | lake <n>          the lakes about you; go to one of them
//   give glider | take glider
//   wake                      wake the waystones within 3 km
//   seed [text]               this world's seed; or go to another world
import { registerCommand, commandList } from '../ui/console.js';
import { timeCtl, setManual, goLive, formatHour } from '../systems/time.js';
import { wx, setWeather, goAutoWeather, WX_ORDER } from '../systems/weather.js';
import { setSeasonMode, seasonMode, SEASON_MODES } from './seasons.js';
import { HOME, SPAWN, sitesNear, harboursNear, continentAt, latitudeAt, beltOf, height, biomeAt, lakesNear, walkable } from '../core/shape.js';
import { player } from '../characters/player.js';
import { nearestCountries } from '../ui/countries.js';
import { store, saveSoon, worldSeedText, seedOf, goToWorld } from '../systems/save.js';
import { placeName, setWaystoneAwake } from '../world/landmarks.js';
import { isAwake } from './waypoints.js';
import { gliderView } from './glider.js';
import { hereText } from '../ui/world-panel.js';

const far = (m) => (m < 60 ? 'here' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const SITES = ['waystone', 'pagoda', 'castle', 'ruin', 'hut', 'windmill', 'circle', 'cairn', 'spring', 'icecastle', 'grotto', 'volcano', 'beachhut', 'ship', 'skyisle'];

/** `go(x, z, faceX, faceZ)` takes you to a spot; `visitLake(id)` to a lake's shore. */
export function initCommands({ go, visitLake }) {
  registerCommand('help', 'the commands', () => commandList().map((c) => `${c.name.padEnd(8)} ${c.help}`));

  registerCommand('time', 'time 14 | 14:30 | +2 | -1 | live', (a) => {
    const v = (a[0] || '').toLowerCase();
    if (!v) return `It is ${formatHour(timeCtl.target)} (${timeCtl.live ? 'live' : 'held'}).`;
    if (v === 'live') { goLive(); return 'The time follows your clock.'; }
    const m = /^([+-]?)(\d{1,2})(?::(\d{2}))?(\.\d+)?$/.exec(v);
    if (!m) return 'time 14 | 14:30 | +2 | -1 | live';
    const h = +m[2] + (m[3] ? +m[3] / 60 : 0) + (m[4] ? +m[4] : 0);
    setManual(m[1] ? timeCtl.target + (m[1] === '-' ? -h : h) : h);
    return `It is ${formatHour(timeCtl.target)}.`;
  });

  registerCommand('weather', WX_ORDER.join(' | '), (a) => {
    const v = (a[0] || '').toLowerCase();
    if (!v) return `The weather is ${wx.type}${wx.auto ? ' (on its own)' : ' (held)'}.`;
    if (!WX_ORDER.includes(v)) return 'weather ' + WX_ORDER.join(' | ');
    if (v === 'auto') goAutoWeather(); else setWeather(v, true);
    return v === 'auto' ? 'The weather changes on its own.' : `The weather is ${v}.`;
  });

  registerCommand('season', SEASON_MODES.join(' | '), (a) => {
    const v = (a[0] || '').toLowerCase();
    if (!v) return `The season is ${seasonMode() === 'auto' ? 'turning on its own' : 'held at ' + seasonMode()}. ${hereText()}`;
    if (!SEASON_MODES.includes(v)) return 'season ' + SEASON_MODES.join(' | ');
    setSeasonMode(v);
    return v === 'auto' ? 'The year turns on its own.' : `The season is ${v}.`;
  });

  registerCommand('pos', 'where you are', () => {
    const c = continentAt(player.x, player.z), L = latitudeAt(player.x, player.z), b = biomeAt(player.x, player.z, height(player.x, player.z));
    return [`x ${player.x.toFixed(1)}  z ${player.z.toFixed(1)}  height ${player.y.toFixed(1)} m  ·  ${far(Math.hypot(player.x - HOME.x, player.z - HOME.z))} from home`,
      `${c ? c.name : 'open sea'} · ${beltOf(L)} belt (latitude ${L.toFixed(2)})${b ? ' · ' + b.id : ''}`, hereText()];
  });

  registerCommand('tp', 'tp <x> <z> | tp home', (a) => {
    if ((a[0] || '').toLowerCase() === 'home') { go(SPAWN.x, SPAWN.z, HOME.x, HOME.z); return 'Home.'; }
    const x = +a[0], z = +a[1];
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 'tp <x> <z> | tp home';
    go(x, z);
    return `At ${player.x.toFixed(0)}, ${player.z.toFixed(0)}${walkable(x, z) ? '' : ' (the nearest ground to stand on)'}.`;
  });

  // the nearest of a kind of thing: { name, x, z, faceX, faceZ } or null
  const nearest = (kind) => {
    const x = player.x, z = player.z;
    if (kind === 'harbour') { const h = harboursNear(x, z, 12000)[0]; return h && { name: h.name, x: h.ax, z: h.az, faceX: h.x, faceZ: h.z }; }
    if (kind === 'glider') { const s = gliderView().spot; return s && { name: 'the glider, by the ' + s.name, x: s.x + 1.2, z: s.z, faceX: s.x, faceZ: s.z }; }
    if (kind === 'lake') { const L = lakesNear(x, z, 3000).filter((q) => Math.hypot(q.x - x, q.z - z) > q.rmax + 20)[0]; return L && { name: L.name, lake: L.id }; }
    if (SITES.includes(kind) && !['skyisle', 'grotto', 'volcano'].includes(kind)) { const s = sitesNear(x, z, 6000, kind).filter((q) => Math.hypot(q.x - x, q.z - z) > 12)[0]; if (!s) return null; const r = (s.out || 2) + 3, d = Math.hypot(x - s.x, z - s.z) || 1; return { name: placeName(s), x: s.x + (x - s.x) / d * r, z: s.z + (z - s.z) / d * r, faceX: s.x, faceZ: s.z }; }
    const c = nearestCountries(x, z).find((q) => q.id === kind);
    return c && c.far !== null ? { name: c.name, x: c.x, z: c.z, faceX: c.faceX, faceZ: c.faceZ } : null;
  };
  registerCommand('goto', 'goto (lists what there is) | goto <kind>', (a) => {
    const kind = (a[0] || '').toLowerCase();
    if (!kind) return [...nearestCountries(player.x, player.z).map((c) => `${c.id.padEnd(10)} ${c.name} · ${c.far === null ? 'none within 6 km' : far(c.far)}`), 'also: ' + ['lake', 'harbour', 'glider', ...SITES.filter((s) => !['skyisle', 'grotto', 'volcano'].includes(s))].join(' ')];
    const t = nearest(kind);
    if (!t) return `Nothing of that kind within reach: ${kind}.`;
    if (t.lake) visitLake(t.lake); else go(t.x, t.z, t.faceX, t.faceZ);
    return `${t.name}.`;
  });

  const lakes = () => lakesNear(player.x, player.z, 1500).slice(0, 9);
  registerCommand('lakes', 'the lakes about you', () => lakes().map((L, i) => `${i + 1}  ${L.name} · ${far(Math.hypot(L.x - player.x, L.z - player.z))}${L.frozen ? ' · frozen' : ''}`));
  registerCommand('lake', 'lake <n>: go to one of them (see lakes)', (a) => {
    const L = lakes()[(+a[0] || 0) - 1];
    if (!L) return 'lake <n>: a number from the list (lakes)';
    return visitLake(L.id) ? `${L.name}.` : `No shore to stand on at ${L.name}.`;
  });

  registerCommand('give', 'give glider', (a) => { if ((a[0] || '') !== 'glider') return 'give glider'; store.glider = true; saveSoon(); return 'The glider is yours.'; });
  registerCommand('take', 'take glider', (a) => { if ((a[0] || '') !== 'glider') return 'take glider'; delete store.glider; saveSoon(); return 'The glider is gone (it lies where it lay).'; });

  registerCommand('wake', 'wake the waystones within 3 km', () => {
    const list = Array.isArray(store.waypoints) ? store.waypoints : (store.waypoints = []);
    let n = 0;
    for (const s of sitesNear(player.x, player.z, 3000, 'waystone')) if (!isAwake(s.id)) { list.push({ id: s.id, name: placeName(s), x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 }); n++; }
    saveSoon(); setWaystoneAwake(isAwake);
    return `${n} ${n === 1 ? 'waystone' : 'waystones'} woken.`;
  });

  registerCommand('seed', 'seed | seed <text>: this world, or go to another', (a, raw) => {
    if (!raw) return `Seed ${worldSeedText}.`;
    const s = seedOf(raw);
    if (!s) return 'seed <any word, phrase or number>';
    goToWorld(s.text);
    return `To world ${s.text}…`;
  });
}
