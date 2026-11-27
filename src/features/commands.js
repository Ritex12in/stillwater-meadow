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
//   give <item> [n] | take <item>     glider, rod, tent, lantern, cone
//   map | map <km>            show the map of the continent you are on, or that far about you
//   wake | wake all | wake <km>       wake the waystones and make the harbours known: within 3 km, on the
//                             continent you are on, or that far about you
//   speed <x>                 how fast you walk and run, times x
//   tick rate <x> | tick freeze | tick unfreeze | tick step [n]     how fast the game runs: faster or
//                             slower than real time, stopped, or stepped on by sixtieths of a second
//   report [what is wrong]    saves a picture of the view and a file of how everything stands (the seed,
//                             where you are, the time, the weather, what you carry, what is drawn, the
//                             machine, the errors seen) to your downloads, to hand over with a complaint
//   seed [text]               this world's seed; or go to another world
import { registerCommand, commandList } from '../ui/console.js';
import { timeCtl, setManual, goLive, formatHour } from '../systems/time.js';
import { wx, setWeather, goAutoWeather, WX_ORDER } from '../systems/weather.js';
import { setSeasonMode, seasonMode, SEASON_MODES } from './seasons.js';
import { HOME, SPAWN, sitesNear, harboursNear, continentAt, latitudeAt, beltOf, height, biomeAt, lakesNear, walkable } from '../core/shape.js';
import { player } from '../characters/player.js';
import { clock } from '../core/clock.js';
import { nearestCountries } from '../ui/countries.js';
import { store, saveSoon, worldSeedText, seedOf, goToWorld } from '../systems/save.js';
import { placeName, setWaystoneAwake } from '../world/landmarks.js';
import { isAwake, knownHarbours, harbourKnown } from './waypoints.js';
import { add as addToPack, count as countInPack, takeAll, kindOf } from '../systems/pack.js';
import { reveal, CELL } from '../systems/explored.js';
import { gliderView } from './glider.js';
import { hereText } from '../ui/world-panel.js';

const far = (m) => (m < 60 ? 'here' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
let lastReport = null;
/** For tests: the last report made ({ name, info, picture: whether a picture was taken }). */
export const lastReportView = () => lastReport;
const SITES = ['heart', 'waystone', 'pagoda', 'castle', 'ruin', 'hut', 'windmill', 'circle', 'cairn', 'spring', 'icecastle', 'grotto', 'volcano', 'beachhut', 'ship', 'skyisle'];

/** `go(x, z, faceX, faceZ)` takes you to a spot; `visitLake(id)` to a lake's shore; `report()` gives the view and how things stand. */
export function initCommands({ go, visitLake, report }) {
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

  // things to carry: the glider (kept apart from the backpack), and what the backpack holds one kind to a stack
  const ITEMS = { rod: 'the fishing rod', tent: 'a tent', lantern: 'lanterns', cone: 'pine cones' };
  const itemsHelp = 'glider ' + Object.keys(ITEMS).join(' ');
  registerCommand('give', `give <item> [how many]: ${itemsHelp}`, (a) => {
    const it = (a[0] || '').toLowerCase(), n = Math.max(1, Math.min(99, Math.floor(+a[1]) || 1));
    if (it === 'glider') { store.glider = true; saveSoon(); return 'The glider is yours.'; }
    if (!ITEMS[it]) return `give <item> [how many]: ${itemsHelp}`;
    let got = 0;
    for (let i = 0; i < n; i++) { if ((kindOf(it).max === 1 && countInPack(it)) || !addToPack(it)) break; got++; } // (one is enough of what does not stack)
    saveSoon();
    const have = countInPack(it);
    return got ? `${kindOf(it).name}: ${got} given (you carry ${have}).` : have && kindOf(it).max === 1 ? `You already carry ${ITEMS[it]}.` : 'No room in the backpack.';
  });
  registerCommand('take', `take <item>: ${itemsHelp} (all of it)`, (a) => {
    const it = (a[0] || '').toLowerCase();
    if (it === 'glider') { delete store.glider; saveSoon(); return 'The glider is gone (it lies where it lay).'; }
    if (!ITEMS[it]) return `take <item>: ${itemsHelp}`;
    const had = countInPack(it);
    takeAll(it); saveSoon();
    return had ? `${kindOf(it).name}: ${had} taken away.` : `You carry none.`;
  });

  // the map: show the land without walking it
  registerCommand('map', 'map (the continent you are on) | map <km> (that far about you)', (a) => {
    const km = +a[0], c = continentAt(player.x, player.z);
    if (a[0] && !(km > 0)) return 'map | map <km>';
    const at = km > 0 || !c ? { x: player.x, z: player.z, r: Math.min(km > 0 ? km : 3, 15) * 1000 } : { x: c.x, z: c.z, r: Math.min(c.R * c.s * 1.25 + 1500, 8000) };
    const n = reveal(at.x, at.z, at.r);
    saveSoon();
    return `${(n * CELL * CELL / 1e6).toFixed(1)} km² more of the map shown${km > 0 || !c ? '' : ' (' + c.name + ')'}. Open it with M.`;
  });

  // waystones and harbours: woken and visited without going to them
  const wake = (x, z, r) => {
    const list = Array.isArray(store.waypoints) ? store.waypoints : (store.waypoints = []);
    let stones = 0, ports = 0;
    for (const s of sitesNear(x, z, r, 'waystone')) if (!isAwake(s.id)) { list.push({ id: s.id, name: placeName(s), x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 }); stones++; }
    for (const h of harboursNear(x, z, r)) if (!harbourKnown(h.id)) { knownHarbours().push({ id: h.id, name: h.name, x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10, ax: h.ax, az: h.az }); ports++; }
    saveSoon(); setWaystoneAwake(isAwake);
    return `${stones} ${stones === 1 ? 'waystone' : 'waystones'} woken, ${ports} ${ports === 1 ? 'harbour' : 'harbours'} made known. Travel to them from the map (M).`;
  };
  registerCommand('wake', 'wake (within 3 km) | wake all (the continent you are on) | wake <km>: waystones and harbours', (a) => {
    const v = (a[0] || '').toLowerCase(), c = continentAt(player.x, player.z);
    if (v === 'all') return c ? wake(c.x, c.z, Math.min(c.R * c.s * 1.25 + 1500, 8000)) + ` (${c.name})` : wake(player.x, player.z, 3000);
    if (v && !(+v > 0)) return 'wake | wake all | wake <km>';
    return wake(player.x, player.z, Math.min(+v > 0 ? +v : 3, 12) * 1000);
  });

  // how fast you go, and how fast the game runs
  const num = (v, lo, hi) => { const n = +v; return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  registerCommand('speed', 'speed <x>: how fast you walk and run, times x (0.1 to 20; speed 1 is as usual)', (a) => {
    if (!a[0]) return `You go at ${clock.walk} times your usual speed (${(2.7 * clock.walk).toFixed(1)} m/s walking, ${(5.4 * clock.walk).toFixed(1)} running).`;
    const n = num(a[0], 0.1, 20);
    if (n === null) return 'speed <x>: 0.1 to 20';
    clock.walk = n;
    return n === 1 ? 'You go at your usual speed.' : `You go at ${n} times your usual speed (${(2.7 * n).toFixed(1)} m/s walking, ${(5.4 * n).toFixed(1)} running).`;
  });
  registerCommand('tick', 'tick | tick rate <x> (0.05 to 10) | tick freeze | tick unfreeze | tick step [n]: how fast the game runs', (a) => {
    const v = (a[0] || '').toLowerCase();
    const now = () => (clock.frozen ? `The game is frozen${clock.steps ? ` (${clock.steps} steps to go)` : ''}. tick step [n] moves it on; tick unfreeze lets it run.` : `The game runs at ${clock.rate} times real time (${Math.round(60 * clock.rate)} sixtieths of a second each second).`);
    if (!v) return now();
    if (v === 'rate') { const n = num(a[1], 0.05, 10); if (n === null) return 'tick rate <x>: 0.05 to 10 (1 is real time)'; clock.rate = n; clock.frozen = false; clock.steps = 0; return now(); }
    if (v === 'freeze') { clock.frozen = true; clock.steps = 0; return now(); }
    if (v === 'unfreeze' || v === 'run') { clock.frozen = false; clock.steps = 0; return now(); }
    if (v === 'step') { const n = a[1] === undefined ? 1 : num(a[1], 1, 6000); if (n === null) return 'tick step [n]: 1 to 6000 sixtieths of a second'; clock.frozen = true; clock.steps += Math.floor(n); return `Stepping on ${Math.floor(n)} ${Math.floor(n) === 1 ? 'sixtieth' : 'sixtieths'} of a second (${(Math.floor(n) / 60).toFixed(2)} s), then frozen.`; }
    return 'tick | tick rate <x> | tick freeze | tick unfreeze | tick step [n]';
  });

  // a report to hand over when something is wrong: the view as a picture, and how everything stands
  registerCommand('report', 'report [what is wrong]: saves a picture of the view and a file of how things stand, to your downloads', (a, raw) => {
    const r = report(), d = new Date(), two = (n) => String(n).padStart(2, '0');
    const name = `stillwater-report-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
    r.info.note = raw || '';
    lastReport = { name, info: r.info, picture: typeof r.picture === 'string' && r.picture.startsWith('data:image/png') };
    const save = (href, file) => { const el = document.createElement('a'); el.href = href; el.download = file; document.body.appendChild(el); el.click(); el.remove(); };
    const text = URL.createObjectURL(new Blob([JSON.stringify(r.info, null, 2)], { type: 'application/json' }));
    save(text, name + '.json');
    setTimeout(() => URL.revokeObjectURL(text), 10000);
    if (lastReport.picture) setTimeout(() => save(r.picture, name + '.png'), 300); // (a moment apart: a browser may hold back two downloads at once)
    return [`Saved to your downloads: ${name}.json${lastReport.picture ? ' and ' + name + '.png' : ' (the picture could not be taken)'}.`, 'If the browser asks whether this site may download several files, allow it.'];
  });

  registerCommand('seed', 'seed | seed <text>: this world, or go to another', (a, raw) => {
    if (!raw) return `Seed ${worldSeedText}.`;
    const s = seedOf(raw);
    if (!s) return 'seed <any word, phrase or number>';
    goToWorld(s.text);
    return `To world ${s.text}…`;
  });
}
