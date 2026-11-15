// A couple dance for the two children: a waltz-time routine that is a pure function of time, so
// any moment can be posed on its own (the studio scrubs it, the game plays it, the camera cuts on
// it). The pair moves as one rigid frame (a centre, a heading and the space between them); each
// child is posed with the normal walk pose for footwork, then the dance is laid over it, and the
// hands are placed with a small two-bone arm solver so joined hands really meet.
//
//   bars 0-1   bow to each other, step in and take both hands
//   bars 2-5   sway, turning slowly round together
//   bars 6-7   side steps, left then right
//   bars 8-9   the twirl: they let go, he lifts a hand toward her and she spins twice, arms raised
//   bars 10-12 spin together, leaning out
//   bars 13-14 slow and close, she leans back a little in his hands
//   bar 15     let go, and a last bow
import * as THREE from 'three';
import { clamp, lerp } from '../core/math.js';
import { poseKid } from './kidpose.js';

export const BEAT = 60 / 84, BAR = BEAT * 3, BARS = 16, DANCE_LENGTH = BAR * BARS;
export const SEP = 0.74, APART = 1.95; // between the two (root to root) in a two-hand hold: the hair just clears

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const inBars = (t, a, b) => sstep(a * BAR, b * BAR, t);       // 0 before bar a, 1 after bar b
const during = (t, a, b, ease = 0.35) => inBars(t, a, a + ease) * (1 - inBars(t, b - ease, b));

/**
 * The routine at time t (s): where the pair is (in its own frame: centre offset x/z, heading turn),
 * how far apart, which hands are held (A: his left with her right, B: his right with her left),
 * and the extras each child adds.
 */
export function routine(t) {
  t = clamp(t, 0, DANCE_LENGTH);
  const bar = t / BAR, beat = t / BEAT;
  const r = { t, bar, beat, cx: 0, cz: 0, turn: 0, sep: SEP, holdA: 0, holdB: 0, raise: 0, spin: 0, bow: 0, lean: 0, swayK: 0, step: 0, close: 0 };
  // bow (bar 0), then step in and take hands (bar 1); a last bow in bar 15
  // they bow from a polite distance (the heads are big: bowing closer they would bump), then step in
  r.bow = Math.max(during(t, 0, 0.85, 0.3), during(t, 15.35, 16, 0.25));
  const hands = inBars(t, 1.25, 1.7) * (1 - inBars(t, 14.85, 15.1));
  r.sep = lerp(APART, SEP, inBars(t, 0.85, 1.6));
  r.sep = lerp(r.sep, APART, inBars(t, 14.95, 15.4));
  const free = during(t, 8, 10, 0.25);                                  // both hands let go for the twirl
  r.holdA = hands * (1 - free); r.holdB = hands * (1 - free);
  // footwork: a step every beat while dancing
  r.walk = Math.max(during(t, 0.85, 1.6, 0.2), during(t, 14.95, 15.4, 0.15)); // stepping in and back
  r.step = inBars(t, 1.4, 1.9) * (1 - inBars(t, 14.8, 15.0));
  // sway, turning a quarter round over four bars
  r.swayK = during(t, 2, 6) + during(t, 13, 15) * 0.6;
  r.turn = inBars(t, 2, 6) * Math.PI * 0.5;
  // side steps: a step left each beat for a bar, then right
  r.cx = (inBars(t, 6, 7) - inBars(t, 7, 8)) * 0.55;
  // the twirl: his right arm goes up holding her left hand, and she turns twice
  r.raise = during(t, 8, 10, 0.3);
  r.spin = inBars(t, 8.3, 9.8) * Math.PI * 4;
  // spinning together: a turn and a half, faster in the middle, leaning out
  r.turn += inBars(t, 10, 13) * Math.PI * 3.5; // (with the quarter turn before, a whole number of turns: they end facing as they began)
  r.lean = during(t, 10, 13, 0.5) * 0.12;
  // close and slow, then she leans back in his hands at the end of bar 14
  r.close = during(t, 13, 15, 0.5);
  r.sep -= r.close * 0.04;
  r.dipK = during(t, 13.9, 15, 0.45);
  return r;
}

// ───────────── a two-bone arm solver ─────────────
const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _u = new THREE.Vector3(), _b = new THREE.Vector3(), _z = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _m = new THREE.Matrix4(), _p = new THREE.Vector3();
/**
 * Put arm i of kid k so its hand is at `target` (world space), the elbow pointing toward `pole`
 * (a direction in the chest's frame). `w` blends from the current pose to the solved one.
 */
export function reach(k, i, target, w = 1, pole = null) {
  if (w < 0.001) return;
  const sh = k.arms[i], el = k.elbows[i], L1 = k.dims.arm - (k.dims.handY ? -k.dims.handY : 0), L2 = -k.dims.handY;
  sh.parent.updateMatrixWorld(true);
  _t.copy(target); sh.parent.worldToLocal(_t);                  // the target in the chest's frame
  _s.copy(sh.position);
  _t.sub(_s);
  const d = clamp(_t.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  _t.normalize();
  // angle at the shoulder between the upper arm and the line to the target, and the elbow's bend
  const alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const inner = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  // the elbow swings out toward the pole: by default down, a little out to the side and back
  _p.copy(pole || _p.set(i ? 0.5 : -0.5, -1, -0.35));
  _b.copy(_p).addScaledVector(_t, -_p.dot(_t)).normalize();
  _u.copy(_t).multiplyScalar(Math.cos(alpha)).addScaledVector(_b, Math.sin(alpha)).normalize(); // the upper arm
  // the shoulder's frame: its -y along the upper arm, +z toward the target (the elbow bends forearm toward +z)
  _y.copy(_u).negate();
  _z.copy(_t).addScaledVector(_u, -_t.dot(_u)).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  const q = new THREE.Quaternion().setFromRotationMatrix(_m);
  sh.quaternion.slerp(q, w);
  el.rotation.set(lerp(el.rotation.x, -(Math.PI - inner), w), 0, lerp(el.rotation.z, 0, w));
}

const _h = new THREE.Vector3(), _g = new THREE.Vector3(), _mid = new THREE.Vector3();
/**
 * Pose the pair at routine time t. `frame` = { x, z, heading } is where the dance floor's centre
 * is and which way the boy starts out facing; `ground(x, z)` gives the floor's height. `sb`/`sg`
 * are the boy's and girl's pose states (as poseKid wants; kept between calls). Returns the routine
 * and each child's root position and facing, so the caller can keep their own records in step.
 */
export function poseCouple(boy, girl, frame, t, sb, sg, dt, ground = () => 0) {
  const R = routine(t), H = frame.heading + R.turn;
  const fx = Math.sin(H), fz = Math.cos(H), rx = Math.cos(H), rz = -Math.sin(H);
  const cx = frame.x + rx * R.cx + fx * R.cz, cz = frame.z + rz * R.cx + fz * R.cz;
  const half = R.sep / 2;
  const bx = cx - fx * half, bz = cz - fz * half, gx = cx + fx * half, gz = cz + fz * half;
  const brot = H, grot = H + Math.PI + R.spin;
  boy.root.position.set(bx, ground(bx, bz), bz); boy.root.rotation.set(0, brot, 0);
  girl.root.position.set(gx, ground(gx, gz), gz); girl.root.rotation.set(0, grot, 0);
  // footwork: the walk cycle, one step a beat, small strides (bigger while spinning)
  for (const [k, st] of [[boy, sb], [girl, sg]]) {
    st.move = R.step * (1.1 + 1.2 * R.lean / 0.12 + (k === girl ? 2.2 * R.raise : 0)) + R.walk * 1.3;
    st.phase = R.beat * Math.PI;
    st.sitAmt = 0; st.petAmt = 0; st.idleT = 0; st.turn = 0; st.t = t;
    poseKid(k, st, dt);
    // the dancing body: a sway each bar, leaning out while spinning, a bow at either end
    const sw = Math.sin(R.bar * Math.PI * 2) * 0.07 * R.swayK;
    k.body.rotation.z += sw * (k === boy ? 1 : -1);
    k.body.rotation.x += R.bow * 0.16 - R.lean;
    k.chest.rotation.x += R.bow * 0.12;
    if (R.bow > 0.01) {
      const w = R.bow, set = (i, x, z, ex) => { k.arms[i].rotation.set(lerp(k.arms[i].rotation.x, x, w), 0, lerp(k.arms[i].rotation.z, z, w)); k.elbows[i].rotation.set(lerp(k.elbows[i].rotation.x, ex, w), 0, 0); };
      // (arm 0 is the right arm: it sits on the -x side, and a +z turn swings it in across the body)
      if (k === boy) { set(0, -0.55, 0.62, -1.95); set(1, 0.3, 1.3, -0.12); }          // a gentleman's bow: right hand to his chest, left arm swept out
      else {                                                                       // a curtsy: arms out to the sides, one foot back, knees dipping
        set(0, 0.22, -1.05, -0.15); set(1, 0.22, 1.05, -0.15);
        k.legs[1].rotation.x = lerp(k.legs[1].rotation.x, 0.35, w); k.knees.forEach((kn) => { kn.rotation.x = lerp(kn.rotation.x, 0.55, w); });
        k.legs[0].rotation.x = lerp(k.legs[0].rotation.x, -0.25, w);
        k.body.position.y -= 0.07 * w;
      }
    }
    k.chest.rotation.y = 0;
    k.head.rotation.set(R.bow * 0.42 - R.lean * 0.5, 0, sw * 0.6);
  }
  // her lean back at the end, and his lean in to hold her
  girl.body.rotation.x -= R.dipK * 0.2; boy.body.rotation.x += R.dipK * 0.14;
  boy.root.updateMatrixWorld(true); girl.root.updateMatrixWorld(true);
  // joined hands meet half way between them at chest height; as she leans back the meeting point follows her
  const hy = Math.min(boy.root.position.y, girl.root.position.y) + 0.72 - R.dipK * 0.05;
  const F = new THREE.Vector3(fx, 0, fz), toward = R.dipK * 0.06;
  const pair = (bi, gi, w) => {
    if (w < 0.001) return;
    const side = bi ? 1 : -1; // his arm 1 sits on the +x side of his own frame, which is `r` in the pair's frame (and her arm 0 lands there too, facing him)
    _mid.set(cx + rx * side * 0.17, hy, cz + rz * side * 0.17).addScaledVector(F, toward);
    _h.copy(_mid).addScaledVector(F, -0.035);      // his hand a little on his side of the meeting point, hers on hers
    _g.copy(_mid).addScaledVector(F, 0.035);
    reach(boy, bi, _h, w);
    reach(girl, gi, _g, w);
  };
  pair(1, 0, R.holdA);
  pair(0, 1, R.holdB);
  if (R.raise > 0.01) {
    // he lifts his right hand toward her, over her head; she turns with both arms raised and curved
    _h.set(gx, hy + 0.62, gz).addScaledVector(F, -0.25);
    reach(boy, 1, _h, R.raise);
    girl.arms.forEach((a, i) => { const sd = i ? 1 : -1; a.rotation.set(lerp(a.rotation.x, -0.25, R.raise), 0, lerp(a.rotation.z, sd * 2.5, R.raise)); girl.elbows[i].rotation.set(lerp(girl.elbows[i].rotation.x, -0.55, R.raise), 0, 0); });
    girl.face.flash('happy', 0.3);
  }
  return { R, boy: { x: bx, z: bz, rot: brot }, girl: { x: gx, z: gz, rot: grot } };
}

/** For checking: the distance between each held pair of hands (A, B), in metres. */
export function handGaps(boy, girl) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  boy.hands[1].getWorldPosition(a); girl.hands[0].getWorldPosition(b); const gA = a.distanceTo(b);
  boy.hands[0].getWorldPosition(a); girl.hands[1].getWorldPosition(b); const gB = a.distanceTo(b);
  return [gA, gB];
}
