// Small math helpers and the two random streams.
// `rng`/`rand`/`pick` build the world: they are seeded and consumed in a fixed order at boot,
// so trees, flowers and rocks land in the same places every visit. Runtime behaviour
// (animal wandering, weather changes, sounds) draws from `rnd`/`rndPick` instead, so adding
// a feature never reshuffles the landscape.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Frame-rate independent exponential approach of `a` toward `b` with rate `k` (1/s). */
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
/** Signed shortest angle from a to b, in (-π, π]. */
export function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export const turnTo = (a, b, step) => a + clamp(angDiff(a, b), -step, step);
export const wrap = (v, min, max) => { const r = max - min; return ((((v - min) % r) + r) % r) + min; };

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const layout = mulberry32(20261112);
export const rng = () => layout();
export const rand = (a, b) => a + (b - a) * layout();
export const pick = (arr) => arr[Math.floor(layout() * arr.length)];

const runtime = mulberry32(90210);
export const rnd = (a = 0, b = 1) => a + (b - a) * runtime();
export const rndPick = (arr) => arr[Math.floor(runtime() * arr.length)];

export function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}
