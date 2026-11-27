// How a child looks off the ground (characters/moves.js says what it is doing): jumping, falling,
// landing, rolling, climbing a steep face, sliding down one, gliding. Each pose is laid over the base
// one (characters/kidpose.js) by its amount, 0..1, so they ease in and out of walking and of each
// other. Whole-body turns (the pitch of a climb, a roll, a glider's bank) go on the hips (`k.body`).
//
// The joints, as kidpose.js uses them: a leg's or an arm's `x` below 0 swings it forward and up,
// above 0 back; a knee's `x` above 0 bends it; an elbow's `x` below 0 bends it; an arm's `z` lifts it
// out sideways (left arm negative, right positive); the hips' `x` above 0 leans the body forward.
// The rig has no ankles or wrists: toes cannot point, heels cannot lift.
import { lerp, clamp } from '../core/math.js';

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const to = (o, ax, v, w) => { o.rotation[ax] = lerp(o.rotation[ax], v, w); };

/**
 * Lay the moves' poses over a child.
 * m: { crouch, air, vy, run, long, land, heavy, roll (-1, or 0..1 through it), climb, cphase, ctilt,
 *      clook (-1 down .. 1 up), cmove (0 still .. 1 moving), cside (-1..1), shake (0..1), top (-1, or 0..1),
 *      slide, glide, bank (-1..1), pitch (-1 flare .. 1 dive), open (0..1 since the wing opened), hang }
 */
export function poseMoves(k, m, t) {
  const L = k.legs, K = k.knees, A = k.arms, E = k.elbows, B = k.body, C = k.chest, H = k.head;

  // ── the crouch before a jump: hips down, knees deep, chest forward, arms swung back ──
  if (m.crouch > 0.001) {
    const w = m.crouch;
    B.position.y -= 0.13 * w;
    for (const i of [0, 1]) { to(L[i], 'x', -0.85, w); to(K[i], 'x', 1.45, w); to(A[i], 'x', 0.95, w); to(A[i], 'z', (i ? 1 : -1) * 0.18, w); to(E[i], 'x', -0.25, w); }
    to(B, 'x', 0.38, w); to(C, 'x', 0.12, w); to(H, 'x', 0.12, w);
  }

  // ── in the air ──
  if (m.air > 0.001) {
    const w = m.air, up = sstep(-1.5, 2.5, m.vy), down = 1 - up, run = m.run, long = m.long;
    const flut = Math.sin(t * 15) * 0.07 * down, flut2 = Math.sin(t * 13 + 1.7) * 0.07 * down;
    // rising: knees tucked (standing jump) or a stride held in the air (running jump); arms thrown up and out
    // falling: legs reaching down a little apart, arms rising as the body drops
    // a long fall: spread flat, arms and legs wide, everything fluttering
    const legL = lerp(lerp(-1.0, -1.15, run), lerp(-0.3, 0.45, long), down), legR = lerp(lerp(-0.45, 0.55, run), lerp(0.08, 0.55, long), down);
    const kneeL = lerp(lerp(1.5, 0.55, run), lerp(0.4, 0.6, long), down), kneeR = lerp(lerp(1.0, 0.95, run), lerp(0.25, 0.75, long), down);
    to(L[0], 'x', legL + flut * 0.5, w); to(L[1], 'x', legR - flut2 * 0.5, w);
    to(K[0], 'x', kneeL, w); to(K[1], 'x', kneeR, w);
    const spread = lerp(0.05, lerp(0.14, 0.42, long), down);
    to(L[0], 'z', -spread, w); to(L[1], 'z', spread, w);
    for (const i of [0, 1]) {
      const sd = i ? 1 : -1;
      // (rising: thrown forward and up, elbows soft; at the top: floating out; falling: lifting out wider the faster you drop)
      const fast = clamp(-m.vy / 11, 0, 1);
      to(A[i], 'x', lerp(lerp(-1.15, -0.5 + sd * 0.55 * run, run), lerp(lerp(-0.45, -0.2, fast), -0.15, long), down) + (i ? flut : flut2), w);
      to(A[i], 'z', sd * (lerp(lerp(0.5, 0.45, run), lerp(lerp(0.85, 1.55, fast), 1.45, long), down) + (i ? flut2 : flut)), w);
      to(E[i], 'x', lerp(-0.85, lerp(lerp(-0.75, -0.4, fast), -0.2, long), down), w);
    }
    to(B, 'x', lerp(lerp(0.02, 0.22, run), lerp(0.12, 0.85, long), down), w);
    to(C, 'x', lerp(-0.12, 0.05, down), w);
    to(H, 'x', lerp(-0.2, lerp(0.15, -0.55, long), down), w); // (chin up going up; down at the ground coming down; up again when flat out)
    to(B, 'z', 0, w); to(C, 'y', 0, w);
  }

  // ── landing: the knees soak it up, the chest bows, the arms come down and forward ──
  if (m.land > 0.001) {
    const w = m.land, hv = m.heavy;
    B.position.y -= (0.15 + 0.2 * hv) * w;
    to(L[0], 'x', -0.95 - 0.35 * hv, w); to(L[1], 'x', -0.8 - 0.25 * hv, w);
    to(K[0], 'x', 1.6 + 0.45 * hv, w); to(K[1], 'x', 1.4 + 0.5 * hv, w);
    to(B, 'x', 0.42 + 0.3 * hv, w); to(C, 'x', 0.1 + 0.15 * hv, w);
    to(A[0], 'x', lerp(-0.45, -1.15, hv), w); to(A[0], 'z', -0.2, w); to(E[0], 'x', lerp(-0.4, -0.05, hv), w); // (a heavy one: this hand goes to the ground)
    to(A[1], 'x', lerp(-0.45, 0.5, hv), w); to(A[1], 'z', lerp(0.2, 0.75, hv), w); to(E[1], 'x', -0.4, w);      // (and this one out behind, for balance)
    to(H, 'x', lerp(0.1, -0.25, hv), w);
  }

  // ── a roll out of a long fall: tucked, over one shoulder, up onto a knee ──
  if (m.roll >= 0) {
    const p = m.roll, tuck = sstep(0, 0.12, p) * (1 - sstep(0.7, 1, p)), spin = sstep(0.05, 0.75, p), knee = sstep(0.7, 0.82, p) * (1 - sstep(0.88, 1, p));
    B.rotation.x += spin * Math.PI * 2;
    B.rotation.z += Math.sin(spin * Math.PI) * 0.35; // (over the right shoulder)
    B.position.y -= 0.42 * tuck + 0.26 * knee;
    for (const i of [0, 1]) { to(L[i], 'x', -1.95, tuck); to(K[i], 'x', 2.25, tuck); to(A[i], 'x', -1.3, tuck); to(A[i], 'z', (i ? -1 : 1) * 0.35, tuck); to(E[i], 'x', -1.9, tuck); }
    to(C, 'x', 0.45, tuck); to(H, 'x', 0.6, tuck);
    // up on one knee, a hand on it
    to(L[0], 'x', -1.45, knee); to(K[0], 'x', 1.5, knee); to(L[1], 'x', 0.1, knee); to(K[1], 'x', 1.5, knee);
    to(A[0], 'x', -0.9, knee); to(E[0], 'x', -0.6, knee);
    H.rotation.z += Math.sin(sstep(0.86, 1, p) * Math.PI * 2) * 0.22; // (and shakes its head once, standing)
  }

  // ── climbing: flat to the face, opposite hand and foot moving together ──
  if (m.climb > 0.001) {
    const w = m.climb, s = Math.sin(m.cphase), c = Math.cos(m.cphase), mv = m.cmove, side = m.cside, up = 1 - Math.abs(side);
    // the reach: one hand high as the other pulls down past the shoulder; the knee on the pulling hand's side lifts high and out
    const reach = (sgn) => -2.35 - sgn * s * 0.55 * mv * up, bend = (sgn) => -0.4 + sgn * s * 0.32 * mv * up;
    const hang = m.hang * (1 - mv); // (resting: arms long, the body hanging off them)
    to(A[0], 'x', lerp(reach(1), -2.75, hang), w); to(A[1], 'x', lerp(reach(-1), -2.75, hang), w);
    to(E[0], 'x', lerp(bend(1), -0.12, hang), w); to(E[1], 'x', lerp(bend(-1), -0.12, hang), w);
    to(A[0], 'z', -0.55 - Math.max(0, -side) * 0.55 * Math.max(0, c) * mv, w); to(A[1], 'z', 0.55 + Math.max(0, side) * 0.55 * Math.max(0, c) * mv, w);
    // (the knees turned out to the sides, frog-wise, so the body can lie close to the face)
    to(L[0], 'x', -0.7 + s * 0.5 * mv * up, w); to(L[1], 'x', -0.7 - s * 0.5 * mv * up, w);
    to(K[0], 'x', 0.95 - s * 0.5 * mv * up, w); to(K[1], 'x', 0.95 + s * 0.5 * mv * up, w);
    to(L[0], 'z', -0.85 - Math.max(0, -side) * 0.25 * Math.max(0, c) * mv, w); to(L[1], 'z', 0.85 + Math.max(0, side) * 0.25 * Math.max(0, c) * mv, w);
    B.position.y -= (0.06 + 0.08 * hang) * w;
    to(B, 'x', m.ctilt, w);                                  // (the body lies along the face)
    to(B, 'z', s * 0.09 * mv * up + side * 0.12 * mv, w);    // (the hips sway toward the reaching hand)
    to(B, 'y', 0, w);
    to(C, 'y', s * 0.16 * mv * up, w); to(C, 'x', -0.08, w); to(C, 'z', 0, w);
    to(H, 'x', lerp(-0.55, 0.45, sstep(0.3, -0.6, m.clook)) - m.ctilt * 0.3, w); // (up at the next hold; down over the shoulder going down)
    to(H, 'y', m.clook < -0.3 ? 0.55 : side * 0.5, w); to(H, 'z', 0, w);
    // resting, now and then a hand lets go, shakes out and goes back
    if (m.shake > 0.001) { const q = Math.sin(m.shake * Math.PI); to(A[1], 'x', -0.5, q * w); to(A[1], 'z', 0.5, q * w); to(E[1], 'x', -0.6 + Math.sin(t * 22) * 0.35, q * w); }
  }

  // ── over the top: forearms on the edge, a heave, one knee onto the ledge, up ──
  if (m.top >= 0) {
    const p = m.top, heave = 1 - sstep(0.25, 0.6, p), knee = sstep(0.3, 0.55, p) * (1 - sstep(0.75, 1, p)), dust = sstep(0.8, 0.9, p) * (1 - sstep(0.95, 1, p));
    const w = 1 - sstep(0.85, 1, p);
    B.position.y -= (0.55 * heave + 0.3 * knee) * w;
    to(B, 'x', lerp(0.25, 0.95, heave), w);
    for (const i of [0, 1]) { to(A[i], 'x', lerp(0.25, -1.75, heave), w); to(E[i], 'x', lerp(-0.2, -1.35, heave), w); to(A[i], 'z', (i ? 1 : -1) * 0.3, w); }
    to(L[0], 'x', lerp(0.25 * heave, -1.6, knee), w); to(K[0], 'x', lerp(0.3 * heave, 1.75, knee), w); to(L[0], 'z', -0.35 * knee, w);
    to(L[1], 'x', 0.3 * heave + 0.15 * knee, w); to(K[1], 'x', 0.25 * heave + 0.9 * knee, w);
    to(H, 'x', -0.35 * heave, w);
    // dusting the hands off
    for (const i of [0, 1]) { to(A[i], 'x', -0.75, dust); to(A[i], 'z', (i ? -1 : 1) * 0.42, dust); to(E[i], 'x', -1.1 + Math.sin(t * 26 + i * 3.1) * 0.22, dust); }
  }

  // ── sliding down a steep face: sat back on the heels, one leg out ahead, arms wide ──
  if (m.slide > 0.001) {
    const w = m.slide, wob = Math.sin(t * 11) * 0.05;
    B.position.y -= 0.3 * w;
    to(B, 'x', -0.42 + wob * 0.5, w); to(B, 'z', m.bank * 0.2, w);
    to(L[0], 'x', -1.25, w); to(K[0], 'x', 0.45, w); to(L[1], 'x', -0.95, w); to(K[1], 'x', 1.5, w);
    to(L[0], 'z', -0.1, w); to(L[1], 'z', 0.16, w);
    for (const i of [0, 1]) { const sd = i ? 1 : -1; to(A[i], 'x', 0.35 + wob * sd, w); to(A[i], 'z', sd * (1.15 + wob - m.bank * sd * 0.3), w); to(E[i], 'x', -0.35, w); }
    to(C, 'x', 0.2, w); to(H, 'x', 0.25, w);
  }

  // ── gliding: hanging from the wing's handles, legs trailing ──
  if (m.glide > 0.001) {
    const w = m.glide, swing = Math.sin(clamp(m.open, 0, 1) * Math.PI) * (1 - m.open) * 1.6; // (the wing snaps open: the body swings under it, the legs kick forward once)
    const p = m.pitch, dive = Math.max(0, p), flare = Math.max(0, -p), sway = Math.sin(t * 1.3) * 0.03;
    for (const i of [0, 1]) { const sd = i ? 1 : -1; to(A[i], 'x', -2.85 + dive * 0.25 - flare * 0.15, w); to(A[i], 'z', sd * (0.2 + (m.bank * sd > 0 ? 0 : 0.12 * Math.abs(m.bank))), w); to(E[i], 'x', -0.18 - (m.bank * sd > 0 ? 0.55 * Math.abs(m.bank) : 0), w); } // (the inside arm pulls down in a turn)
    to(B, 'x', 0.5 + dive * 0.45 - flare * 0.75 - swing + sway, w);
    to(B, 'z', -m.bank * 0.5, w); to(B, 'y', 0, w);
    to(L[0], 'x', 0.3 + dive * 0.25 - flare * 0.85 - swing * 0.9, w); to(L[1], 'x', 0.42 + dive * 0.25 - flare * 0.7 - swing * 0.7, w);
    to(K[0], 'x', 0.35 + flare * 0.3, w); to(K[1], 'x', 0.5 + flare * 0.3, w);
    to(L[0], 'z', -0.04 + m.bank * 0.2, w); to(L[1], 'z', 0.04 + m.bank * 0.2, w); // (the legs swing to the outside of a turn)
    to(C, 'x', -0.1, w); to(C, 'y', 0, w); to(C, 'z', 0, w);
    to(H, 'x', -0.5 - dive * 0.2 + flare * 0.3, w); to(H, 'y', -m.bank * 0.3, w); to(H, 'z', 0, w);
  }
}
