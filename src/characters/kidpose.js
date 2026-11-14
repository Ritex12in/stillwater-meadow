// How a child (characters/kid.js) moves. `poseKid` sets every joint from a small state: how fast
// it is going, where it is in its stride, how seated it is, whether it is kneeling to pet, how long
// it has stood idle. Layers are blended, so walking eases into running, standing into sitting, and
// an idle figure shifts its weight, looks about and tucks its hands into its pockets. The player and
// the girl who wanders the meadow share it; features (fishing, flowers, stargazing) then adjust
// single joints on top.
import { lerp, clamp, damp } from '../core/math.js';

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Stride phase advances this many radians per metre walked (two steps per cycle). */
export const STRIDE_RATE = 3.5;

/**
 * Pose a child.
 * st: { move (m/s), phase, sitAmt 0..1, seatTop (m), petAmt 0..1, idleT (s standing still), turn (rad/s),
 *       pocket (0..1, kept by this function), look (kept), t (clock) }
 */
export function poseKid(k, st, dt) {
  const D = k.dims, t = st.t, sa = st.sitAmt || 0, pa = st.petAmt || 0;
  const go = clamp(st.move / 2.7, 0, 1) * (1 - sa);                 // 0 standing .. 1 walking
  const run = sstep(3.2, 5.0, st.move) * (1 - sa);                  // 0 walking .. 1 running
  const s = Math.sin(st.phase), c = Math.cos(st.phase);
  const still = 1 - go;

  // ── legs: swing from the hip, the knee bending as the leg comes through ──
  const swing = lerp(0.62, 1.0, run) * go;
  const lift = lerp(0.75, 1.5, run) * go;
  const hipL = s * swing - 0.12 * run * go, hipR = -s * swing - 0.12 * run * go;
  const kneeL = Math.max(0, Math.sin(st.phase - 1.0)) * lift, kneeR = Math.max(0, Math.sin(st.phase - 1.0 + Math.PI)) * lift;
  k.legs[0].rotation.x = lerp(hipL, -1.5, sa); k.legs[1].rotation.x = lerp(hipR, -1.44, sa);
  k.knees[0].rotation.x = lerp(kneeL, 1.42, sa); k.knees[1].rotation.x = lerp(kneeR, 1.32, sa);
  k.legs[0].rotation.z = k.legs[1].rotation.z = 0;

  // ── body: bob twice a stride, lean into the motion and into turns, sway at the hips ──
  const breathe = Math.sin(t * 1.7) * 0.006 * still;
  const bob = Math.abs(c) * lerp(0.03, 0.065, run) * go;
  const lean = (0.05 * go + 0.2 * run);
  const drop = (1 - Math.cos(swing)) * (D.thigh + D.shin) * 0.85;   // legs apart reach less far down: lower the hips so the feet stay on the ground
  k.body.position.y = lerp(bob + breathe - drop, (st.seatTop || 0.44) + 0.105 - D.hip + breathe, sa);
  k.body.rotation.x = lerp(lean, -0.05, sa);
  k.body.rotation.z = s * 0.035 * go - clamp(st.turn || 0, -3, 3) * 0.035 * go + Math.sin(t * 0.45) * 0.018 * still * (1 - sa);
  k.body.rotation.y = 0;
  // the chest turns against the hips, and breathes
  k.chest.rotation.y = -s * lerp(0.1, 0.2, run) * go;
  k.chest.rotation.x = Math.sin(t * 1.7) * 0.012 * still + 0.04 * sa;
  k.chest.rotation.z = 0;

  // ── arms: swing against the legs; elbows a little bent walking, right-angled running ──
  st.pocket = damp(st.pocket || 0, st.idleT > 3.5 && sa < 0.05 && pa < 0.05 ? 1 : 0, 4, dt);
  const pk = st.pocket;
  const armSwing = lerp(0.5, 0.95, run) * go;
  const elbow = -(0.12 + 0.2 * go + 1.15 * run);
  [0, 1].forEach((i) => {
    const sd = i ? 1 : -1, sw = (i ? s : -s) * armSwing;
    let ax = sw - 0.06 * run, az = sd * 0.07, ex = elbow - Math.max(0, -sw) * 0.35;
    // seated: hands rest on the knees
    ax = lerp(ax, -0.3, sa); az = lerp(az, -sd * 0.06, sa); ex = lerp(ex, -1.0, sa);
    // idle for a while: hands tucked into the pockets
    ax = lerp(ax, 0.1, pk); az = lerp(az, -sd * 0.16, pk); ex = lerp(ex, -0.62, pk);
    k.arms[i].rotation.set(ax, 0, az);
    k.elbows[i].rotation.set(ex, 0, 0);
  });

  // ── head: steady against the body's lean, looking about when idle ──
  st.look = damp(st.look || 0, st.idleT > 1.5 ? Math.sin(t * 0.31) * 0.45 * (0.5 + 0.5 * Math.sin(t * 0.13 + 1)) : 0, 2.5, dt);
  k.head.rotation.x = -lean * 0.7 + Math.sin(t * 0.9) * 0.02 * still;
  k.head.rotation.y = -k.chest.rotation.y * 0.7 + st.look * (1 - sa * 0.5);
  k.head.rotation.z = Math.sin(t * 0.23 + 2) * 0.04 * still;

  // ── kneeling to pet: down on one knee, one hand stroking ──
  if (pa > 0.001) {
    const stroke = Math.sin(t * 4.2);
    k.legs[1].rotation.x = lerp(k.legs[1].rotation.x, -1.45, pa); k.knees[1].rotation.x = lerp(k.knees[1].rotation.x, 1.5, pa);
    k.legs[0].rotation.x = lerp(k.legs[0].rotation.x, 0.1, pa); k.knees[0].rotation.x = lerp(k.knees[0].rotation.x, 1.5, pa);
    k.body.position.y = lerp(k.body.position.y, D.thigh + 0.09 - D.hip, pa);
    k.body.rotation.x = lerp(k.body.rotation.x, 0.2, pa);
    k.chest.rotation.x = lerp(k.chest.rotation.x, 0.25, pa);
    k.arms[1].rotation.x = lerp(k.arms[1].rotation.x, -1.05 + stroke * 0.2, pa); k.arms[1].rotation.z = lerp(k.arms[1].rotation.z, -0.1, pa);
    k.elbows[1].rotation.x = lerp(k.elbows[1].rotation.x, -0.25 - stroke * 0.12, pa);
    k.arms[0].rotation.x = lerp(k.arms[0].rotation.x, -0.45, pa); k.elbows[0].rotation.x = lerp(k.elbows[0].rotation.x, -0.5, pa);
    k.head.rotation.x = lerp(k.head.rotation.x, 0.3, pa); k.head.rotation.y *= 1 - pa;
  }
}

/**
 * Poses laid over the base one, each eased in by its amount (0..1):
 *   ground: sitting on the ground, legs out, leaning back on the hands
 *   lie:    flat on the back, hands behind the head (stargazing)
 *   hold:   one arm (index `side`) held out a little to the side, for walking hand in hand
 */
export function poseExtras(k, o) {
  const D = k.dims, g = o.ground || 0, la = o.lie || 0;
  if (g > 0.001) {
    k.legs.forEach((l, i) => { l.rotation.x = lerp(l.rotation.x, -1.48 + (i ? 0.06 : 0), g); l.rotation.z = lerp(l.rotation.z, i ? 0.14 : -0.14, g); });
    k.knees.forEach((kn, i) => { kn.rotation.x = lerp(kn.rotation.x, i ? 0.22 : 0.1, g); });
    k.body.position.y = lerp(k.body.position.y, 0.115 - D.hip, g);
    k.body.rotation.x = lerp(k.body.rotation.x, -0.16, g);
    k.chest.rotation.x = lerp(k.chest.rotation.x, 0.06, g);
    k.arms.forEach((a, i) => { const sd = i ? 1 : -1; a.rotation.x = lerp(a.rotation.x, 0.55, g); a.rotation.z = lerp(a.rotation.z, sd * 0.3, g); k.elbows[i].rotation.x = lerp(k.elbows[i].rotation.x, -0.08, g); });
  }
  if (la > 0.001) {
    k.body.rotation.x = lerp(k.body.rotation.x, -1.52, la);
    k.body.position.y = lerp(k.body.position.y, 0.2, la);
    k.legs.forEach((l, i) => { l.rotation.x = lerp(l.rotation.x, i ? 0.05 : -0.08, la); });
    k.knees.forEach((kn, i) => { kn.rotation.x = lerp(kn.rotation.x, i ? 0.4 : 0, la); });
    k.arms.forEach((a, i) => { a.rotation.x = lerp(a.rotation.x, -2.7, la); a.rotation.z = lerp(a.rotation.z, i ? -0.5 : 0.5, la); k.elbows[i].rotation.x = lerp(k.elbows[i].rotation.x, -1.6, la); });
    k.chest.rotation.x = lerp(k.chest.rotation.x, 0, la); k.chest.rotation.y = lerp(k.chest.rotation.y, 0, la);
    k.head.rotation.x = lerp(k.head.rotation.x, -0.2, la); k.head.rotation.y = lerp(k.head.rotation.y, 0, la);
  }
  if (o.hold > 0.001) {
    const i = o.side, sd = i ? 1 : -1, h = o.hold;
    k.arms[i].rotation.x = lerp(k.arms[i].rotation.x, k.arms[i].rotation.x * 0.25, h);   // the joined hands swing only a little
    k.arms[i].rotation.z = lerp(k.arms[i].rotation.z, sd * 0.3, h);
    k.elbows[i].rotation.x = lerp(k.elbows[i].rotation.x, -0.1, h);
  }
}

/** A gesture laid over the pose: 'wave', 'cheer' or 'dance', eased in by `amt`, at clock `t`. */
export function gesture(k, name, amt, t) {
  if (amt < 0.001) { k.elbows[0].rotation.z = k.elbows[1].rotation.z = 0; return; }
  const w = amt;
  if (name === 'wave') {
    k.arms[1].rotation.x = lerp(k.arms[1].rotation.x, -0.2, w); k.arms[1].rotation.z = lerp(k.arms[1].rotation.z, 2.35, w);
    k.elbows[1].rotation.set(lerp(k.elbows[1].rotation.x, 0, w), 0, w * (0.55 + Math.sin(t * 9) * 0.45));
    k.head.rotation.z = lerp(k.head.rotation.z, 0.12, w);
  } else if (name === 'cheer') {
    const hop = Math.abs(Math.sin(t * 7.5));
    k.body.position.y += hop * 0.09 * w;
    k.arms.forEach((a, i) => { const sd = i ? 1 : -1; a.rotation.x = lerp(a.rotation.x, -0.15, w); a.rotation.z = lerp(a.rotation.z, sd * (2.55 + 0.2 * Math.sin(t * 7.5)), w); k.elbows[i].rotation.set(lerp(k.elbows[i].rotation.x, -0.15, w), 0, 0); });
    k.legs.forEach((l) => { l.rotation.x = lerp(l.rotation.x, 0.1 - hop * 0.25, w); });
    k.knees.forEach((kn) => { kn.rotation.x = lerp(kn.rotation.x, hop * 0.5, w); });
    k.head.rotation.x = lerp(k.head.rotation.x, -0.18, w);
  } else if (name === 'dance') {
    const b = Math.sin(t * 6), b2 = Math.sin(t * 3);
    k.body.position.y += Math.abs(b) * 0.05 * w;
    k.body.rotation.z = lerp(k.body.rotation.z, b2 * 0.13, w);
    k.chest.rotation.y = lerp(k.chest.rotation.y, b2 * 0.4, w);
    k.arms.forEach((a, i) => { const sd = i ? 1 : -1; a.rotation.x = lerp(a.rotation.x, -1.5 + sd * b2 * 0.9, w); a.rotation.z = lerp(a.rotation.z, sd * 0.35, w); k.elbows[i].rotation.set(lerp(k.elbows[i].rotation.x, -1.0, w), 0, 0); });
    k.legs.forEach((l, i) => { l.rotation.x = lerp(l.rotation.x, (i ? 1 : -1) * b * 0.22, w); l.rotation.z = lerp(l.rotation.z, (i ? 1 : -1) * 0.08, w); });
    k.knees.forEach((kn, i) => { kn.rotation.x = lerp(kn.rotation.x, Math.max(0, (i ? 1 : -1) * b) * 0.55, w); });
    k.head.rotation.z = lerp(k.head.rotation.z, -b2 * 0.14, w);
  }
}

/** Ease one arm's elbow straight (for a feature that drives the whole arm: a rod, a throw). */
export function straighten(k, i, amt = 1, bend = 0) {
  k.elbows[i].rotation.x = lerp(k.elbows[i].rotation.x, bend, amt);
}
