// "Snowman": a 60-second couple dance on the frozen lake, in winter costume. Like the waltz
// (couple.js) it is a pure function of time; the pair skates a slow loop across the ice, and each
// part of the dance is one of three layouts the pair eases between:
//   face to face   (meeting, the twirls): both hands joined between them
//   side by side   (skating together): the inner hands joined, the outer arms out for balance
//   close          (the embrace sway and the dip): face to face, near, both hands held at the chest
//                  (their arms are short and their heads big, so a ballroom hold would bump heads)
//   heads together (the last embrace): side by side, turned in, hands held, heads tipped together
//
//   0-5 s    they glide in from either side, slow, and take hands
//   5-12 s   skating side by side, in step
//   12-20 s  first twirl: she spins clockwise twice, his hand raised over her
//   20-28 s  close hold, swaying, drifting round
//   28-36 s  the dip: she leans back over his supporting arm, one leg reaching
//   36-44 s  skating together again
//   44-52 s  second twirl, faster, her skirt flaring out
//   52-60 s  the last embrace: side by side, heads together, a slow spin that settles to a stop
import * as THREE from 'three';
import { clamp, lerp } from '../core/math.js';
import { poseKid } from './kidpose.js';
import { reach } from './couple.js';

export const SNOW_LENGTH = 60;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const during = (t, a, b, e = 1) => sstep(a - e * 0.5, a + e * 0.5, t) * (1 - sstep(b - e * 0.5, b + e * 0.5, t));
const lerpAngle = (a, b, w) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * w;
export const LOOP_R = 4.2;           // the loop they skate round, metres

/** How far along the loop the pair has gone at time t (speed differs by part), in metres. */
const TRAVEL = (() => {
  // speed profile (m/s) by part, eased between parts; integrated in 0.1 s steps once, then looked up
  const v = (u) => 0.15 + 1.05 * (during(u, 5, 12) + during(u, 36, 44)) + 0.35 * (during(u, 12, 20) + during(u, 44, 52)) + 0.12 * during(u, 20, 28) - 0.12 * sstep(56, 60, u);
  const d = [0];
  for (let i = 1; i <= SNOW_LENGTH * 10; i++) d.push(d[i - 1] + v((i - 0.5) / 10) * 0.1);
  return d;
})();
function travel(t) {
  const f = clamp(t, 0, SNOW_LENGTH) * 10, i = Math.min(Math.floor(f), TRAVEL.length - 2);
  return lerp(TRAVEL[i], TRAVEL[i + 1], f - i);
}

export function snowRoutine(t) {
  t = clamp(t, 0, SNOW_LENGTH);
  const r = { t };
  r.hug = sstep(51.5, 53, t);                                   // the last embrace, side by side
  r.side = during(t, 5, 12) + during(t, 36, 44) + r.hug;
  r.closed = during(t, 20, 36);
  r.face = clamp(1 - r.side - r.closed, 0, 1);
  // meeting: they glide in from apart
  r.sep = lerp(2.4, 0.78, sstep(0.5, 4.5, t));
  r.hands = sstep(3.5, 4.8, t);
  r.twirl = during(t, 12, 20, 0.8) + during(t, 44, 52, 0.8);
  r.spin = sstep(13, 19, t) * Math.PI * 4 + sstep(45, 51, t) * Math.PI * 6; // she turns clockwise: twice, then three times
  r.dip = during(t, 28, 36, 2.2);
  r.sway = Math.sin((t - 20) * Math.PI / 2) * during(t, 20, 28, 1.5);   // side to side, a sway every 4 s
  r.embraceSpin = sstep(20, 28, t) * Math.PI * 2;                   // one slow turn round, back where it began
  r.hugSpin = sstep(52.5, 59, t) * Math.PI * 2;
  r.skate = clamp(r.side * (1 - r.hug) + 0.6 * sstep(0, 1, t) * (1 - sstep(3.5, 5, t)) + 0.4 * r.twirl, 0, 1); // how much they stroke
  r.dist = travel(t);
  r.end = sstep(57, 60, t);
  return r;
}

// ───────────── skates ─────────────
const bladeGeo = new THREE.BoxGeometry(0.014, 0.035, 0.27), bladeMat = new THREE.MeshStandardMaterial({ color: '#d8dee6', metalness: 0.8, roughness: 0.25 });
/** Fit skate blades under a child's boots (once). They lift the child 4 cm. */
export function addSkates(k) {
  if (k.skates) return;
  k.skates = k.knees.map((kn) => { const b = new THREE.Mesh(bladeGeo, bladeMat); b.position.set(0, -k.dims.shin - 0.017, 0.055); b.castShadow = true; kn.add(b); if (k.own) k.own.add(b); return b; });
}
export const BLADE = 0.035;

// ───────────── posing ─────────────
const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V();
/** A skating stroke over the walk pose: knees soft, the pushing leg out to the side, the body leaning on the gliding one. */
function skatePose(k, w, phase) {
  if (w < 0.001) return;
  const s = Math.sin(phase), p0 = Math.max(0, s), p1 = Math.max(0, -s);
  k.legs[0].rotation.set(lerp(k.legs[0].rotation.x, 0.25 * p0, w), 0, lerp(k.legs[0].rotation.z, -0.38 * p0, w));
  k.legs[1].rotation.set(lerp(k.legs[1].rotation.x, 0.25 * p1, w), 0, lerp(k.legs[1].rotation.z, 0.38 * p1, w));
  k.knees.forEach((kn, i) => { kn.rotation.x = lerp(kn.rotation.x, 0.42 - 0.3 * (i ? p1 : p0), w); });
  k.body.position.y = lerp(k.body.position.y, -0.045, w);
  k.body.rotation.x = lerp(k.body.rotation.x, 0.16, w);
  k.body.rotation.z = lerp(k.body.rotation.z, s * 0.08, w);
}

export const CLOSE = 0.78;   // body distance when close: as near as the two big heads allow
/**
 * Where each of them stands at time t, and which way they face: { R, B: {x, z, rot}, G: {x, z, rot}, cx, cz }.
 * `frame` = { x, z, heading } is where the loop starts on the ice and which way it sets off.
 */
export function snowSpots(frame, t, R = snowRoutine(t)) {
  // the pair's centre on the loop, and the way it travels
  const ang = R.dist / LOOP_R, h0 = frame.heading;
  const cx = frame.x + Math.sin(h0) * Math.sin(ang) * LOOP_R + Math.cos(h0) * (1 - Math.cos(ang)) * LOOP_R;
  const cz = frame.z + Math.cos(h0) * Math.sin(ang) * LOOP_R - Math.sin(h0) * (1 - Math.cos(ang)) * LOOP_R;
  const H = h0 - ang; // heading along the loop (turning right, clockwise seen from above)
  // face to face across the line of travel, turning slowly while close; nearer when close, apart for the twirls
  // (she is on his right, as when side by side, so going from one to the other they never cross)
  const A = H - Math.PI / 2 + R.embraceSpin, ax = Math.sin(A), az = Math.cos(A);
  const lb = { x: Math.cos(A), z: -Math.sin(A) };                    // the boy's left when facing A
  let sepF = lerp(R.sep, CLOSE, R.closed) - 0.12 * R.dip;
  sepF = lerp(sepF, 0.98, R.twirl);
  const sw0 = 0.05 * R.sway;                                         // the sway carries them both a little sideways
  const face = {
    b: { x: cx - ax * sepF / 2 + lb.x * sw0, z: cz - az * sepF / 2 + lb.z * sw0, rot: A },
    g: { x: cx + ax * sepF / 2 + lb.x * sw0, z: cz + az * sepF / 2 + lb.z * sw0, rot: A + Math.PI },
  };
  // side by side: facing the way they go, she on his right; in the last embrace turned in a little, spinning slowly
  const Hs = H - R.hugSpin, rx = -Math.cos(Hs), rz = Math.sin(Hs), half = lerp(0.37, 0.44, R.hug), turnIn = 0.35 * R.hug;
  const side = {
    b: { x: cx - rx * half, z: cz - rz * half, rot: Hs - turnIn },
    g: { x: cx + rx * half, z: cz + rz * half, rot: Hs + turnIn },
  };
  const w = R.side, mix = (p, q) => ({ x: lerp(p.x, q.x, w), z: lerp(p.z, q.z, w), rot: lerpAngle(p.rot, q.rot, w) });
  const B = mix(face.b, side.b), G = mix(face.g, side.g);
  // while turning from one to the other they are half facing, leaning in: a little more room then
  const apart = 0.13 * Math.sin(Math.PI * clamp(w, 0, 1)), dx = G.x - B.x, dz = G.z - B.z, dl = Math.hypot(dx, dz) || 1;
  B.x -= dx / dl * apart; B.z -= dz / dl * apart; G.x += dx / dl * apart; G.z += dz / dl * apart;
  G.rot += R.spin;
  return { R, B, G, cx, cz, H };
}

/**
 * Pose the pair at time t. `frame` = { x, z, heading } is where the loop starts on the ice and
 * which way it sets off; `ground` gives the ice height. sb/sg are kept pose states.
 */
export function poseSnow(boy, girl, frame, t, sb, sg, dt, ground = () => 0) {
  const R = snowRoutine(t);
  addSkates(boy); addSkates(girl);
  const { B, G, cx, cz, H } = snowSpots(frame, t, R);
  const y0 = (x, z) => ground(x, z) + BLADE;
  boy.root.position.set(B.x, y0(B.x, B.z), B.z); boy.root.rotation.set(0, B.rot, 0);
  girl.root.position.set(G.x, y0(G.x, G.z), G.z); girl.root.rotation.set(0, G.rot, 0);

  // each child: the standing pose, then the stroke, then the part's own body language
  const stroke = R.dist / 1.3 * Math.PI; // one push per 1.3 m
  for (const [k, st, sd] of [[boy, sb, 0], [girl, sg, Math.PI]]) {
    st.move = 0; st.phase = 0; st.sitAmt = 0; st.petAmt = 0; st.idleT = 0; st.turn = 0; st.t = t;
    poseKid(k, st, dt);
    k.chest.rotation.set(0, 0, 0);
    skatePose(k, R.skate, stroke + sd * (1 - R.side));
    k.head.rotation.set(0, 0, 0);
    // the sway: both lean the same way (his left is her right), knees soft
    k.body.rotation.z += (k === boy ? 1 : -1) * 0.07 * R.sway;
    k.knees.forEach((kn) => { kn.rotation.x = Math.max(kn.rotation.x, 0.18 * R.closed); });
  }
  // the dip: she arches back from the waist on his hands, her right leg reaching forward, the other knee bent under
  // her; he leans in over her, knees bent
  if (R.dip > 0.001) {
    const d = R.dip;
    girl.chest.rotation.x = lerp(girl.chest.rotation.x, -0.38, d); girl.body.rotation.x = lerp(girl.body.rotation.x, -0.1, d);
    girl.body.position.y = lerp(girl.body.position.y, -0.06, d);
    girl.legs[0].rotation.set(lerp(girl.legs[0].rotation.x, -0.55, d), 0, 0); girl.knees[0].rotation.x = lerp(girl.knees[0].rotation.x, 0.05, d);
    girl.legs[1].rotation.set(lerp(girl.legs[1].rotation.x, 0.28, d), 0, 0); girl.knees[1].rotation.x = lerp(girl.knees[1].rotation.x, 0.5, d);
    girl.head.rotation.x = lerp(girl.head.rotation.x, -0.2, d);
    boy.body.rotation.x = lerp(boy.body.rotation.x, 0.16, d); boy.chest.rotation.x = lerp(boy.chest.rotation.x, 0.1, d);
    boy.knees.forEach((kn) => { kn.rotation.x = lerp(kn.rotation.x, 0.4, d); }); boy.legs.forEach((l) => { l.rotation.x = lerp(l.rotation.x, -0.2, d); });
    boy.body.position.y = lerp(boy.body.position.y, -0.05, d);
  }
  // heads: close, both tip a little to the side and nod in; in the last embrace they tip together, and she leans on him
  const lean = R.closed * (1 - R.dip);
  boy.head.rotation.x += 0.08 * lean; girl.head.rotation.x += 0.08 * lean;
  boy.head.rotation.z += -0.1 * lean + (0.12 + 0.04 * R.end) * R.hug;   // + tips his head to his right, toward her
  girl.head.rotation.z += -0.1 * lean - (0.14 + 0.05 * R.end) * R.hug;   // - tips hers to her left, toward him
  boy.body.rotation.z += 0.03 * R.hug; girl.body.rotation.z -= 0.04 * R.hug;
  boy.root.updateMatrixWorld(true); girl.root.updateMatrixWorld(true);

  // ── hands ──
  const hy = Math.min(boy.root.position.y, girl.root.position.y) + 0.7;
  const at = (k, i, out) => k.arms[i].getWorldPosition(out);
  const hold = R.hands * (1 - R.twirl);
  // face to face (and close): both hands joined between them; held at the chest when close, lower in the dip
  const fw = hold * (R.face + R.closed);
  if (fw > 0.001) {
    _d.set(cx, 0, cz);
    for (const [bi, gi] of [[1, 0], [0, 1]]) {
      at(boy, bi, _a); at(girl, gi, _b); _c.addVectors(_a, _b).multiplyScalar(0.5);
      _c.x = lerp(_c.x, (boy.root.position.x + girl.root.position.x) / 2, 0.3 * R.closed);
      _c.z = lerp(_c.z, (boy.root.position.z + girl.root.position.z) / 2, 0.3 * R.closed);
      _c.y = hy + 0.14 * lean - 0.04 * R.dip;
      reach(boy, bi, _c, fw); reach(girl, gi, _c, fw);
    }
  }
  // side by side: his right with her left, low between them; the outer arms out for balance while skating
  const sw = hold * R.side;
  if (sw > 0.001) {
    const fx = Math.sin(H), fz = Math.cos(H);
    at(boy, 0, _a); at(girl, 1, _b); _c.addVectors(_a, _b).multiplyScalar(0.5); _c.y = hy - 0.08 + 0.1 * R.hug; _c.x += fx * 0.06; _c.z += fz * 0.06;
    reach(boy, 0, _c, sw); reach(girl, 1, _c, sw);
    const out = sw * (1 - R.hug);
    boy.arms[1].rotation.z = lerp(boy.arms[1].rotation.z, 0.75, out); boy.elbows[1].rotation.x = lerp(boy.elbows[1].rotation.x, -0.2, out);
    girl.arms[0].rotation.z = lerp(girl.arms[0].rotation.z, -0.75, out); girl.elbows[0].rotation.x = lerp(girl.elbows[0].rotation.x, -0.2, out);
  }
  // the twirls: he lifts his hand toward her; she turns with both arms raised
  if (R.twirl > 0.001) {
    _c.set(G.x, hy + 0.6, G.z).lerp(_a.copy(boy.root.position).setY(hy + 0.6), 0.55);
    reach(boy, 1, _c, R.twirl);
    girl.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(lerp(a.rotation.x, -0.2, R.twirl), 0, lerp(a.rotation.z, s * 2.4, R.twirl)); girl.elbows[i].rotation.set(lerp(girl.elbows[i].rotation.x, -0.5, R.twirl), 0, 0); });
  }
  // faces: calm smiles skating, happy close and in the twirls, eyes shut and blushing in the dip and the last embrace
  const mood = R.dip > 0.5 || R.hug > 0.5 ? 'love' : R.closed > 0.5 || R.twirl > 0.5 ? 'happy' : 'calm';
  boy.face.set(mood); girl.face.set(mood);
  return { R, boy: B, girl: G };
}

/** For checking: gaps (m) between hands that should touch in the current part, and the distance between the heads. */
export function snowContacts(boy, girl, t) {
  const R = snowRoutine(t), p = V(), q = V(), out = {};
  const hd = (k, i, l, j) => { k.hands[i].getWorldPosition(p); l.hands[j].getWorldPosition(q); return p.distanceTo(q); };
  if (R.hands * (R.face + R.closed) * (1 - R.twirl) > 0.95) { out.A = hd(boy, 1, girl, 0); out.B = hd(boy, 0, girl, 1); }
  if (R.hands * R.side * (1 - R.twirl) > 0.95) out.side = hd(boy, 0, girl, 1);
  boy.head.localToWorld(p.set(0, 0.3, 0)); girl.head.localToWorld(q.set(0, 0.3, 0)); out.heads = p.distanceTo(q); // the head centres
  return out;
}
