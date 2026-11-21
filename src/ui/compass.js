// The compass along the top of the screen, and the names of places as you come to them.
//
// North is -z, as the sky has it (the sun rises in the east-north-east, +x a little toward -z,
// and stands due south, +z, at noon: systems/time.js). The strip shows the half of the horizon
// you are facing, with the cardinal points and a few named places on it: the home lake, the
// nearest shrine, and the settled lakes nearest you. Which places it shows is worked out twice
// a second; only their positions follow the camera.
import * as THREE from 'three';
import { HOME, lakesNear, shrineSitesNear } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { toast } from './hud.js';

const $ = (id) => document.getElementById(id);
const SPAN = 180;  // degrees of horizon across the strip
const MARKS = 4;   // named places shown at most
const POINTS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
const deg = (r) => (r * 180) / Math.PI;
/** Compass bearing (degrees, 0 north, 90 east) from one spot toward another. */
export const bearing = (fx, fz, tx, tz) => (deg(Math.atan2(tx - fx, -(tz - fz))) + 360) % 360;
const far = (m) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km');

/** The named places worth a mark from here: `{ key, name, x, z, kind }`, nearest first after home. */
export function marksFrom(x, z) {
  const out = [];
  const home = Math.hypot(HOME.x - x, HOME.z - z);
  if (home > 60) out.push({ key: 'lake:home', name: HOME.name, x: HOME.x, z: HOME.z, kind: 'home' });
  const shrine = shrineSitesNear(x, z, 2500)[0];
  if (shrine && Math.hypot(shrine.x - x, shrine.z - z) > 30) out.push({ key: 'shrine:' + shrine.id, name: shrine.name, x: shrine.x, z: shrine.z, kind: 'shrine' });
  for (const L of lakesNear(x, z, 1500)) {
    if (out.length >= MARKS) break;
    if (!L.settled || L === HOME || Math.hypot(L.x - x, L.z - z) < L.R0 * 2) continue;
    out.push({ key: 'lake:' + L.id, name: L.name, x: L.x, z: L.z, kind: 'lake' });
  }
  return out;
}

let view = { heading: 0, marks: [] };
/** For tests: which way you face, and the places on the compass with their bearings and distances. */
export const compassView = () => view;

export function initCompass() {
  const box = $('compass'), track = $('compassTrack');
  if (!box) return;
  const width = () => box.clientWidth || 360;
  const points = POINTS.map(([label, at]) => {
    const el = document.createElement('span');
    el.className = 'pt' + (label.length === 1 ? ' main' : '');
    el.textContent = label;
    track.appendChild(el);
    return { el, at };
  });
  const pins = []; // (made once, reused: one per mark shown)
  const pin = (i) => {
    if (pins[i]) return pins[i];
    const el = document.createElement('span'), name = document.createElement('b'), dist = document.createElement('i');
    el.className = 'mark'; el.append(name, dist);
    track.appendChild(el);
    return (pins[i] = { el, name, dist });
  };
  const place = (el, at, heading, w) => {
    const d = ((at - heading + 540) % 360) - 180, px = (d / SPAN) * w;
    const show = Math.abs(d) < SPAN / 2;
    el.hidden = !show;
    if (show) el.style.transform = `translateX(${px.toFixed(1)}px)`;
    return show ? px : null;
  };
  let marks = [], lookIn = 0, last = NaN;
  const dir = new THREE.Vector3();
  hooks.frame.push((dt, t, camera) => {
    lookIn -= dt;
    if (lookIn <= 0) {
      lookIn = 0.5;
      marks = marksFrom(player.x, player.z);
      marks.forEach((m, i) => {
        const p = pin(i);
        p.el.className = 'mark ' + m.kind;
        if (p.name.textContent !== m.name) p.name.textContent = m.name;
      });
      for (let i = marks.length; i < pins.length; i++) pins[i].el.hidden = true;
      last = NaN; // (the distances and places may have changed: redraw)
    }
    camera.getWorldDirection(dir);
    const heading = (deg(Math.atan2(dir.x, -dir.z)) + 360) % 360;
    if (Math.abs(heading - last) < 0.05) return;
    last = heading;
    const w = width();
    for (const p of points) place(p.el, p.at, heading, w);
    view = { heading, marks: marks.map((m) => ({ name: m.name, kind: m.kind, bearing: bearing(player.x, player.z, m.x, m.z), far: Math.hypot(m.x - player.x, m.z - player.z) })) };
    // (nearer places first: where two lie the same way, the farther shows only its dot)
    const named = [];
    view.marks.map((m, i) => [m, i]).sort((a, b) => a[0].far - b[0].far).forEach(([m, i]) => {
      const p = pins[i], px = place(p.el, m.bearing, heading, w), d = far(m.far);
      if (p.dist.textContent !== d) p.dist.textContent = d;
      const crowded = px !== null && named.some((q) => Math.abs(q - px) < 96);
      p.el.classList.toggle('dot', crowded);
      if (px !== null && !crowded) named.push(px);
    });
  });

  // Coming to a place: its name. (The lake you are at changes only once you have left the last one behind.)
  hooks.lake.push((L) => toast(L === HOME ? `${L.name} · home` : `${L.name}${L.settled ? '' : ' · a wild lake'}${L.frozen ? ', frozen' : ''}`, 3.5));
  let atShrine = null;
  setInterval(() => {
    const s = shrineSitesNear(player.x, player.z, 40)[0] || null;
    if (s && s !== atShrine) toast(s.name, 3.5);
    atShrine = s;
  }, 1000);
}
