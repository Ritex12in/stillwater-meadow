// The children: chibi figures about three heads tall, with a big round head, large eyes, fluffy
// hair, short limbs and chunky sneakers. One builder makes both (the boy you play and the girl who
// wanders the meadow) from a spec of outfit, hair and colours.
//
// Joints are groups, so limbs rotate: hips and knees, shoulders and elbows, the head, the hair and
// the backpack (which lag a little behind the body), and a face whose eyes, brows and mouth change
// with the expression (see makeFace). `dims` gives the sizes other code needs (hip height, where
// the hand is on the arm, eye height) so nothing else hard-codes the body's measurements.
import * as THREE from 'three';
import { TAU, damp } from '../core/math.js';
import { sculpt, sphere, ellipsoid, capsule, rbox, strand, ring, blend, union, carve, both, grow, mirror, above, frontOf } from '../core/sculpt.js';

/** Soft, drawn-looking shading: a warm glow round the edges and lifted shadows, on any standard material. */
function soft(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
      float kRim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
      outgoingLight += diffuseColor.rgb * (kRim * 0.2 + 0.05) * vec3(1.0, 0.94, 0.88);
      gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
  };
  m.customProgramCacheKey = () => 'kidsoft';
  return m;
}
const smooth = (color, extra) => soft(new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0 }, extra || {})));
const tone = (hex, k) => smooth(new THREE.Color(hex).multiplyScalar(k));
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const EUL = new THREE.Euler(), MAT = new THREE.Matrix4();
/** Move a geometry into place: optional turn (rx, ry, rz), then scale, then position. */
function put(g, x, y, z, o = {}) {
  if (o.s) g.scale(o.s[0], o.s[1], o.s[2]);
  if (o.r) g.applyMatrix4(MAT.makeRotationFromEuler(EUL.set(o.r[0], o.r[1], o.r[2])));
  return g.translate(x, y, z);
}
const ball = (r, x, y, z, o) => put(new THREE.IcosahedronGeometry(r, 2), x, y, z, o);
/** A capsule standing on y: a tube with rounded ends, `h` long between the end centres. */
const cap = (r, h, x, y, z, o) => put(merge([new THREE.CylinderGeometry(r, r, h, 12), new THREE.SphereGeometry(r, 12, 6, 0, TAU, 0, Math.PI / 2).translate(0, h / 2, 0), new THREE.SphereGeometry(r, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2).translate(0, -h / 2, 0)]), x, y, z, o);

/** Several shapes as one geometry, keeping their own (smooth) normals. */
function merge(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  parts.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
/** One mesh of one material from several shapes. `small` pieces skip the shadow pass. */
function lump(parent, mat, geos, small = false) {
  const m = new THREE.Mesh(merge(geos), mat);
  m.castShadow = !small; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export const KIDS = {
  boy: {
    skin: '#f3c9a5', hair: '#5a3423', eye: '#4a2c1e',
    top: '#f2e8d8', jacket: '#5f7d4a', pants: '#c9a878', cuff: '#d8bd92', shoe: '#6a8a58', pack: '#8a5a3c', packTrim: '#6e4530',
    hairStyle: 'fluffy', badge: '#e8c25a', pocket: true,
  },
  girl: {
    skin: '#f3c4a2', hair: '#5a3526', eye: '#4a2c1e',
    top: '#f3e9da', jacket: null, pants: '#5f7fa8', cuff: '#8fa6c6', shoe: '#ee9aa4', pack: '#e58d95', packTrim: '#cf747e',
    hairStyle: 'bun', scrunchie: '#f2a0ad', motif: 'cat', wideLegs: true, patch: '#d98a5a',
  },
};
// Winter costumes for the same two: faces, hair and proportions unchanged, dressed for the snow
// (and for dancing on the ice). No backpacks.
KIDS.boyWinter = Object.assign({}, KIDS.boy, { winter: true, coat: '#2c3e63', coatTrim: '#22304d', pants: '#3a3f4a', boot: '#6b4a32', bootTrim: '#e9dfcf', pocket: false, badge: null });
KIDS.girlWinter = Object.assign({}, KIDS.girl, { winter: true, coat: '#c4323a', coatTrim: '#a3262e', pants: '#4a3a44', boot: '#f1ece4', bootTrim: '#ffffff', skirt: '#f6f2ec', scarf: '#fbf8f2', hat: '#fbf8f2', wideLegs: false, patch: null, motif: null });

// sizes, in metres (the figure stands about 1.6 m to the top of its hair)
const HIP = 0.52, THIGH = 0.25, SHIN = 0.27, SHOULDER = 0.93, UPPER = 0.2, FORE = 0.2, HAND = 0.045, NECK = 1.0;
export const KID_DIMS = { hip: HIP, thigh: THIGH, shin: SHIN, shoulder: SHOULDER, arm: UPPER + FORE + HAND, handY: -(FORE + HAND), eye: NECK + 0.27, top: 1.62 };

// ───────────── the face ─────────────
// Expressions are sets of targets the face eases toward: how open each eye is (0 shut .. 1, above 1
// wide), whether a shut eye is a happy arc, brow height and tilt, which mouth shows, and blush.
const FACES = {
  calm: { open: 1, arc: 0, brow: 0, tilt: 0, mouth: 'smile', blush: 0.55 },
  happy: { open: 0, arc: 1, brow: 0.012, tilt: 0, mouth: 'grin', blush: 0.9 },
  love: { open: 0, arc: 1, brow: 0.014, tilt: 0, mouth: 'grin', blush: 1.2 },
  wow: { open: 1.18, arc: 0, brow: 0.03, tilt: 0, mouth: 'oh', blush: 0.6 },
  think: { open: 0.9, arc: 0, brow: 0.014, tilt: -0.22, mouth: 'flat', blush: 0.4, lop: 1 },
  sad: { open: 0.8, arc: 0, brow: -0.004, tilt: -0.42, mouth: 'frown', blush: 0.3 },
  grit: { open: 0.82, arc: 0, brow: -0.014, tilt: 0.36, mouth: 'flat', blush: 0.7 },
  sleepy: { open: 0.12, arc: 0, brow: -0.006, tilt: -0.1, mouth: 'smile', blush: 0.5 },
};
function makeFace(head, C, surfAt) {
  const dark = smooth(C.eye, { roughness: 0.6 }), white = smooth('#ffffff', { roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.25 });
  const hairMat = smooth(C.hair), browMat = tone(C.hair, 0.95), lip = smooth('#b0685c'), inside = smooth('#8a4038'), tongue = smooth('#f0a09a');
  const blushMat = new THREE.MeshStandardMaterial({ color: '#f58f86', transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
  const surf = (x, y) => surfAt(Math.abs(x), y); // the sculpted face's front at (x, y)
  const EY = 0.215, EX = 0.122, Z = surf(EX, EY) + 0.004;
  const glow = smooth('#7d4a30', { roughness: 0.6 });
  const eyes = [-1, 1].map((sd) => {
    // sits on the curve of the face, turned a little outward
    const e = pivot(head, sd * EX, EY, Z); e.rotation.y = sd * 0.36;
    const ballG = pivot(e, 0, 0, 0);
    // a soft dark oval lying almost flat on the face: no hard ring, just a warmer glow low in the eye
    lump(ballG, dark, [ball(0.056, 0, 0, 0, { s: [1, 1.34, 0.24] })], true);
    lump(ballG, glow, [ball(0.038, 0, -0.032, 0.008, { s: [1.05, 0.8, 0.16] })], true);
    lump(ballG, white, [ball(0.02, -0.018, 0.034, 0.012, { s: [1, 1.1, 0.14] }), ball(0.009, 0.02, -0.032, 0.012, { s: [1, 1, 0.14] })], true); // highlights
    // the upper lash line: a thin stroke along the top of the eye
    const lash = lump(e, hairMat, [new THREE.TorusGeometry(0.056, 0.006, 5, 14, Math.PI * 0.8).rotateZ(Math.PI * 0.1).scale(1, 1.34, 1).translate(0, 0.003, 0.006)], true);
    // shut and smiling: an upturned arc
    const arc = lump(e, hairMat, [new THREE.TorusGeometry(0.044, 0.0065, 5, 14, Math.PI * 0.8).rotateZ(Math.PI * 0.1).translate(0, -0.024, 0.006)], true);
    const brow = pivot(head, sd * EX, EY + 0.104, surf(EX, EY + 0.104) + 0.004); brow.rotation.y = sd * 0.36;
    lump(brow, browMat, [cap(0.0115, 0.044, 0, 0, 0.004, { r: [0, 0, Math.PI / 2 + sd * 0.14], s: [1, 1, 0.5] })], true);
    return { e, ball: ballG, lash, arc, brow, sd };
  });
  lump(head, tone(C.skin, 0.94), [ball(0.009, 0, 0.158, surf(0, 0.158) + 0.001, { s: [1.3, 0.8, 0.5] })], true); // nose: barely there
  const mouths = {}, my = 0.112, mz = surf(0, 0.112) + 0.003;
  // a gentle curve: a short piece of a wide circle, `up` for a smile, down for a frown
  const curve = (R, arc, thick, up) => { const g = new THREE.TorusGeometry(R, thick, 5, 12, arc).rotateZ((up ? -Math.PI / 2 : Math.PI / 2) - arc / 2); return g.translate(0, up ? R : -R, 0).scale(1, 1, 0.5); };
  const mk = (name, mat, geos) => { const g = pivot(head, 0, my, mz); geos.forEach(([m, list]) => lump(g, m || mat, list, true)); g.visible = false; mouths[name] = g; };
  mk('smile', lip, [[null, [curve(0.04, 1.35, 0.0055, true)]]]);
  mk('grin', inside, [[null, [new THREE.SphereGeometry(0.03, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1, 0.95, 0.2).translate(0, 0.012, 0)]], [tongue, [ball(0.016, 0, -0.008, 0.003, { s: [1.1, 0.6, 0.25] })]]]);
  mk('oh', inside, [[null, [ball(0.014, 0, 0.002, 0, { s: [0.9, 1.15, 0.25] })]]]);
  mk('flat', lip, [[null, [cap(0.0042, 0.022, 0, 0.004, 0, { r: [0, 0, Math.PI / 2], s: [1, 1, 0.5] })]]]);
  mk('frown', lip, [[null, [curve(0.04, 1.2, 0.0055, false).translate(0, 0.004, 0)]]]);
  const blush = [-1, 1].map((sd) => { const m = new THREE.Mesh(ball(0.052, sd * 0.19, 0.125, surf(0.19, 0.125) - 0.008, { s: [1, 0.58, 0.3], r: [0, sd * 0.8, 0] }), blushMat); m.renderOrder = 2; head.add(m); return m; });
  const st = { name: 'calm', until: 0, base: 'calm', open: 1, arc: 0, brow: 0, tilt: 0, lop: 0, blush: 0.55, mouth: 'smile', blinkT: 2 };
  return {
    eyes, state: st,
    /** The face it wears from now on. */
    set(name) { st.base = FACES[name] ? name : 'calm'; },
    /** A passing expression, for `secs`, then back to the standing one. */
    flash(name, secs = 1.5) { if (FACES[name]) { st.name = name; st.until = secs; } },
    update(dt, t) {
      if (st.until > 0) { st.until -= dt; if (st.until <= 0) st.name = st.base; } else st.name = st.base;
      const f = FACES[st.name];
      st.open = damp(st.open, f.open, 14, dt); st.arc = damp(st.arc, f.arc, 14, dt);
      st.brow = damp(st.brow, f.brow, 10, dt); st.tilt = damp(st.tilt, f.tilt, 10, dt); st.lop = damp(st.lop, f.lop || 0, 10, dt);
      st.blush = damp(st.blush, f.blush, 5, dt);
      st.blinkT -= dt; if (st.blinkT < -0.13) st.blinkT = 2.2 + ((t * 7.31) % 2.6);
      const open = st.blinkT < 0 ? Math.min(st.open, 0.08) : st.open, arcOn = st.arc > 0.5;
      eyes.forEach((q) => {
        q.lash.visible = !arcOn;
        q.ball.visible = !arcOn && open > 0.25; // nearly shut: only the lash line shows, as the closed lid
        q.arc.visible = arcOn;
        q.ball.scale.set(1, Math.max(0.06, open), 1);
        q.lash.position.y = 0.056 * 1.34 * (Math.max(0.06, Math.min(open, 1.2)) - 1) * 0.9;
        q.brow.position.y = EY + 0.104 + st.brow + (q.sd > 0 ? st.lop * 0.02 : 0);
        q.brow.rotation.z = q.sd * st.tilt;
      });
      for (const k in mouths) mouths[k].visible = k === f.mouth;
      blushMat.opacity = 0.36 * st.blush;
      blush.forEach((b) => { b.visible = st.blush > 0.05; });
    },
  };
}

// ───────────── sculpted parts ─────────────
const painted = (extra) => soft(new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.92, metalness: 0 }, extra || {})));
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
function part(parent, layers, box, n, k = 0.02) {
  const m = new THREE.Mesh(sculpt(layers, box, n, k), painted());
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** The head's skin: a soft skull with full cheeks, a small chin and ears. */
const headField = () => blend(0.018, blend(0.06,
  ellipsoid(0, 0.27, 0, 0.292, 0.25, 0.262),
  mirror(ellipsoid(0.14, 0.15, 0.07, 0.135, 0.1, 0.13)),           // full cheeks
  ellipsoid(0, 0.07, 0.06, 0.13, 0.06, 0.11)),                     // chin
  mirror(ellipsoid(0.292, 0.165, -0.015, 0.024, 0.052, 0.04)));     // ears, low on the head

// Hair is drawn the way the reference draws it: big flat locks shaped like leaves (wide in the
// middle, pointed at the tip), layered over one another and radiating from the crown. Each lock is
// its own strip of mesh following a curve over the head, arched across its width, lighter along
// its middle. A smooth cap underneath closes any gaps.
const HC = [0, 0.275, -0.014], HR = [0.325, 0.288, 0.302]; // a size up from the skull: the hair has volume
/** A point on the hair's surface at azimuth az (0 = front, + = the figure's left), elevation el, pushed out by k. */
const onHead = (az, el, k = 1) => { const ce = Math.cos(el); return new THREE.Vector3(HC[0] + Math.sin(az) * ce * HR[0] * k, HC[1] + Math.sin(el) * HR[1] * k, HC[2] + Math.cos(az) * ce * HR[2] * k); };
class Locks {
  constructor(color) { this.p = []; this.c = []; this.i = []; this.k = []; this.n = 0; this.base = new THREE.Color(color); }
  /**
   * One lock through control points `pts` (smoothed), `W` wide at its broadest, arched `thick` high.
   * `centre` is what "outward" is measured from. `shape` is 'leaf' (pointed tip) or 'band' (even width).
   */
  add(pts, W, thick, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts), seg = o.seg || 14, nu = o.strands ? 14 : 6, ridges = o.strands || 0, centre = o.centre || new THREE.Vector3(HC[0], HC[1], HC[2]);
    const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), S = new THREE.Vector3(), V = new THREE.Vector3();
    const tone = o.tone || 1, base = this.p.length / 3, col = new THREE.Color();
    const len = o.still ? 0 : curve.getLength(), phase = (this.n++ * 0.6180339) % 1; // for the sway: see swaying()
    for (let side = 0; side < 2; side++) for (let i = 0; i <= seg; i++) {
      const t = i / seg; curve.getPoint(t, P); curve.getTangent(t, T);
      N.subVectors(P, centre).normalize(); S.crossVectors(T, N).normalize(); N.crossVectors(S, T).normalize();
      const w = W * (o.shape === 'tress' ? Math.min(1, 0.45 + t * 3.2) * (1 - 0.62 * t * t) : o.shape === 'band' ? 1 - 0.45 * t : (t < 0.45 ? 0.5 + 0.5 * Math.sin((t / 0.45) * Math.PI / 2) : Math.pow(Math.max(0, 1 - (t - 0.45) / 0.55), 0.8))) + 0.0015;
      for (let j = 0; j <= nu; j++) {
        const u = (j / nu) * 2 - 1, crest = ridges ? Math.cos(u * Math.PI * ridges) : 0; // +1 on a strand's crest, -1 in the groove between two
        const arch = (1 - u * u) * thick * (0.4 + 0.6 * Math.min(1, w / W)) * (1 + 0.16 * crest * (1 - u * u));
        V.copy(P).addScaledVector(S, u * w / 2).addScaledVector(N, side === 0 ? arch : -arch * 0.3);
        this.p.push(V.x, V.y, V.z);
        this.k.push(o.still ? 0 : t, phase, len);
        // darker at the root and along the edges, a lighter streak down the middle, a soft tip
        const k = tone * (0.74 + 0.3 * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.6)) * (0.86 + 0.2 * (1 - u * u)) * (1 + 0.09 * crest);
        col.copy(this.base).multiplyScalar(side === 0 ? k : k * 0.7);
        this.c.push(col.r, col.g, col.b);
      }
    }
    const row = nu + 1;
    for (let side = 0; side < 2; side++) for (let i = 0; i < seg; i++) for (let j = 0; j < nu; j++) {
      const a = base + side * (seg + 1) * row + i * row + j, b = a + row;
      if (side === 0) this.i.push(a, a + 1, b, b, a + 1, b + 1); else this.i.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  /** A lock lying over the head from elevation e0 down to e1 at azimuth az, sweeping sideways and flicking out at the tip. */
  over(az, e0, e1, W, o = {}) {
    const pts = [], n = 6, sweep = o.sweep || 0, lift = o.lift || 0.02, flick = o.flick || 0, up = o.up || 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, f = Math.max(0, (t - 0.62) / 0.38) ** 2;
      const q = onHead(az + sweep * Math.pow(t, 1.4), e0 + (e1 - e0) * t, 1.015 + (o.layer || 0) + lift * t + flick * f);
      q.y += up * f;
      pts.push(q);
    }
    this.add(pts, W, o.thick || 0.03, o);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aLock', new THREE.Float32BufferAttribute(this.k, 3));
    g.setIndex(this.i); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}
/**
 * Hair that moves: every lock bends from its root, the tip moving most and long locks more than
 * short ones. `u.uSway` is how far the hair is lagging behind the head (in the head's own frame,
 * from a spring: see the kid's `sway`), and a light flutter runs through the tips with the wind.
 */
function swaying(mat, u) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 aLock;\nuniform vec3 uSway;\nuniform float uHairT;\nuniform float uHairWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float hk = aLock.x * aLock.x * (0.45 + aLock.z * 2.4);                  // 0 at the root; more at the tip, more on a long lock
        transformed += uSway * hk;
        float fl = 0.25 + uHairWind;
        transformed.x += sin(uHairT * 2.3 + aLock.y * 6.283) * 0.011 * hk * fl;
        transformed.z += cos(uHairT * 1.7 + aLock.y * 9.1) * 0.008 * hk * fl;
        transformed.y += sin(uHairT * 3.1 + aLock.y * 4.7) * 0.004 * hk * fl;
      }`);
  };
  mat.customProgramCacheKey = () => 'kidhair';
  return mat;
}

/** The smooth cap under the locks: over the scalp, cut along the hairline. */
const capField = (line) => both(ellipsoid(HC[0], HC[1], HC[2], HR[0] * 1.0, HR[1] * 1.0, HR[2] * 1.0), above(line), 0.02);

function boyHair(L, r) {
  const v = () => 0.95 + 0.1 * r(), T = 0.055;
  // the under layer, back and sides: long broad locks from the crown down past the hairline to the nape,
  // each curving out and up into a pointed tip
  for (let i = 0; i < 9; i++) {
    const az = 1.2 + (i / 8) * (TAU - 2.4), back = Math.abs(Math.PI - az) / Math.PI; // 0 at the back
    L.over(az, 1.3, -0.62 + 0.22 * back + 0.08 * r(), 0.31, { sweep: 0.12 + 0.1 * r(), lift: 0.02, flick: 0.13, up: 0.05, thick: T, strands: 3, tone: v() * 0.94 });
  }
  // the wings: locks over the ears that flare outward and upward
  [-1, 1].forEach((sd) => {
    L.over(sd * 1.22, 1.25, -0.22, 0.26, { sweep: sd * 0.1, lift: 0.04, flick: 0.2, up: 0.085, layer: 0.012, thick: T, strands: 3, tone: v() });
    L.over(sd * 0.98, 1.25, -0.02, 0.2, { sweep: sd * 0.05, lift: 0.04, flick: 0.1, up: 0.03, layer: 0.02, thick: 0.045, strands: 2, tone: v() });
  });
  // the fringe: three big locks falling to points between the brows and the eyes, the forehead showing between
  // them, and two shorter ones filling in above; all swept the same way
  [[-0.5, 0.06, 0.29], [0.02, 0.0, 0.3], [0.52, 0.08, 0.28]].forEach(([az, e1, W]) => L.over(az - 0.14, 1.3, e1, W, { sweep: 0.26, lift: 0.045, flick: 0.02, layer: 0.03, thick: T, strands: 3, tone: v() }));
  [[-0.26, 0.3, 0.24], [0.28, 0.32, 0.24]].forEach(([az, e1, W]) => L.over(az - 0.1, 1.34, e1, W, { sweep: 0.2, lift: 0.05, flick: 0.02, layer: 0.045, thick: T, strands: 3, tone: v() * 1.05 }));
  // the top layer: shorter locks all turning one way round the crown, lifted clear of the layer below
  for (let i = 0; i < 7; i++) {
    const az = (i / 7) * TAU + 0.4;
    L.over(az, 1.46, 0.36 + 0.14 * r(), 0.3, { sweep: 0.5, lift: 0.07, flick: 0.1, up: 0.06, layer: 0.06, thick: T, strands: 3, tone: v() * 1.07 });
  }
  // the cowlick: one big tuft rising from the crown and curling over to one side, a smaller one beside it
  const tuft = (az, h, reach, W) => {
    const a = onHead(az, 1.42, 1.04), d = new THREE.Vector3(Math.sin(az + 1.2), 0, Math.cos(az + 1.2));
    L.add([a, a.clone().add(new THREE.Vector3(0, h * 0.75, 0)).addScaledVector(d, reach * 0.2), a.clone().add(new THREE.Vector3(0, h, 0)).addScaledVector(d, reach * 0.6), a.clone().add(new THREE.Vector3(0, h * 0.72, 0)).addScaledVector(d, reach)], W, 0.045, { centre: new THREE.Vector3(HC[0], HC[1] + 0.22, HC[2]), strands: 2, tone: 1.1 });
  };
  tuft(0.2, 0.15, 0.24, 0.2); tuft(-1.6, 0.09, 0.16, 0.15);
  // finer locks lying over the big ones, slightly off their line: the hair reads as many strands, not a few slabs
  for (let i = 0; i < 16; i++) {
    const az = (i / 16) * TAU + r() * 0.3;
    if (Math.cos(az) > 0.2) continue; // the fringe keeps its clean points
    L.over(az, 1.38, -0.4 + 0.3 * r(), 0.1 + 0.04 * r(), { sweep: 0.25 + 0.35 * r(), lift: 0.05, flick: 0.09 + 0.05 * r(), up: 0.05, layer: 0.05 + 0.02 * r(), thick: 0.028, tone: 1.02 + 0.12 * r() });
  }
  // thin slivers splitting off beside the wings: forked tips
  [-1, 1].forEach((sd) => { L.over(sd * 1.38, 1.1, -0.34, 0.09, { sweep: sd * 0.14, lift: 0.05, flick: 0.2, up: 0.11, layer: 0.03, thick: 0.024, tone: 1.06 }); L.over(sd * 1.6, 1.1, -0.5, 0.09, { sweep: sd * 0.1, lift: 0.04, flick: 0.17, up: 0.08, layer: 0.025, thick: 0.024, tone: 1.0 }); });
  // a few flyaways lifting off the top
  [[1.0, 0.08, 0.14], [2.6, 0.07, 0.12], [-2.2, 0.075, 0.13], [-0.6, 0.06, 0.12]].forEach(([az, h, reach]) => {
    const a = onHead(az, 1.05, 1.09), d = new THREE.Vector3(Math.sin(az + 0.9), 0, Math.cos(az + 0.9));
    L.add([a, a.clone().add(new THREE.Vector3(0, h * 0.8, 0)).addScaledVector(d, reach * 0.4), a.clone().add(new THREE.Vector3(0, h, 0)).addScaledVector(d, reach)], 0.06, 0.018, { tone: 1.12 });
  });
}

function girlHair(L, r, bunAt) {
  const v = () => 0.94 + 0.12 * r();
  // swept up and back: broad tresses from the hairline to the bun, overlapping like tiles, each starting at
  // its own height so the hairline is soft, every other one lying over its neighbours
  for (let i = 0; i < 11; i++) {
    const az = 0.75 + (i / 10) * (TAU - 1.5), back = Math.abs(Math.PI - az) / Math.PI, e0 = -0.5 + 0.6 * back + (r() - 0.5) * 0.14, over = i % 2 ? 0.02 : 0;
    const sw = (r() - 0.5) * 0.22;
    const pts = [0, 0.3, 0.62].map((t) => onHead(az + sw * (1 - t), e0 + (1.2 - e0) * t, 1.02 + over + 0.02 * Math.sin(t * 3))).concat([bunAt.clone().add(new THREE.Vector3(0, -0.02, 0))]);
    L.add(pts, 0.36, 0.045, { shape: 'tress', tone: v() * (i % 2 ? 1.05 : 0.95) });
  }
  // the fringe: parted on one side, a big bang sweeping across the forehead, a smaller one the other way
  [[-0.22, 0.95, 0.02, 0.3], [-0.2, 0.6, 0.1, 0.28], [-0.16, 0.25, 0.3, 0.2]].forEach(([a0, sw, e1, W]) => L.over(a0, 1.3, e1, W, { sweep: sw, lift: 0.045, flick: 0.03, layer: 0.03, thick: 0.05, tone: v() }));
  [[-0.36, -0.75, 0.05, 0.26], [-0.34, -0.4, 0.28, 0.2]].forEach(([a0, sw, e1, W]) => L.over(a0, 1.3, e1, W, { sweep: sw, lift: 0.045, flick: 0.03, layer: 0.03, thick: 0.05, tone: v() }));
  // long loose strands in front of the ears, hanging past the chin and turning out at the ends
  [-1, 1].forEach((sd) => {
    [[1.05, 0.085, -0.02, 0.09], [1.3, 0.06, -0.08, 0.06]].forEach(([az, W, endY, out]) => {
      const top = onHead(sd * az, 0.5, 1.03), mid = onHead(sd * az, -0.1, 1.06), low = onHead(sd * az, -0.6, 1.1);
      low.y = Math.min(low.y, 0.09);
      const tip = low.clone().add(new THREE.Vector3(sd * out, endY - low.y, 0.02));
      L.add([top, mid, low, tip], W, 0.026, { tone: v() });
    });
  });
  // a few short wisps at the nape
  [[-0.75, 0.15, 0.14], [-0.3, 0.1, 0.17], [0.1, 0.12, 0.16], [0.5, 0.1, 0.17], [0.85, 0.15, 0.13]].forEach(([d, e0, W]) => L.over(Math.PI + d, e0, -0.72 + 0.12 * r(), W, { sweep: d * 0.15, lift: 0.0, flick: 0.1, up: 0.03, layer: -0.012, thick: 0.035, tone: v() * 0.92 }));
  [-1, 1].forEach((sd) => L.over(sd * 1.75, 0.2, -0.55, 0.12, { sweep: sd * 0.1, lift: 0.0, flick: 0.12, up: 0.04, layer: -0.008, thick: 0.03, tone: v() * 0.92 }));
}
/** The bun: a few fat loops of hair folded over one another like petals, with two leaf-shaped wisps escaping. Built round the origin. */
function bunHair(L, r) {
  const c = new THREE.Vector3(0, 0.175, 0), R = 0.15;
  // fat locks wound round the ball from its base to its top, each a little off the last, so it reads as coiled hair
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU + r() * 0.2, pts = [];
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * 2.9, e = -0.85 + (k / 6) * 2.2;
      pts.push(new THREE.Vector3(c.x + Math.sin(a) * Math.cos(e) * R, c.y + Math.sin(e) * R * 0.92, c.z + Math.cos(a) * Math.cos(e) * R));
    }
    L.add(pts, 0.17, 0.048, { centre: c, shape: 'band', still: true, tone: 0.93 + 0.17 * r() });
  }
  // two wisps: one curling up and over, one flicking out low on the other side
  const wisp = (az, y0, rise, reach, W) => {
    const d = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), s0 = c.clone().addScaledVector(d, R * 0.75).add(new THREE.Vector3(0, y0, 0));
    L.add([s0, s0.clone().addScaledVector(d, reach * 0.45).add(new THREE.Vector3(0, rise * 0.7, 0)), s0.clone().addScaledVector(d, reach * 0.85).add(new THREE.Vector3(0, rise, 0)), s0.clone().addScaledVector(d, reach * 1.1).add(new THREE.Vector3(0, rise * 0.75, 0))], W, 0.03, { centre: c, tone: 1.06 });
  };
  wisp(0.9, 0.05, 0.07, 0.1, 0.1); wisp(4.0, -0.07, 0.02, 0.11, 0.09);
}

/** Build a child from a spec (see KIDS). */
export function makeKid(spec = KIDS.boy) {
  const C = Object.assign({}, KIDS.boy, spec);
  let seed = C.hairStyle === 'bun' ? 71 : 37;
  const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const dims = Object.assign({}, KID_DIMS), outer = C.coat || C.jacket || C.top, wide = C.wideLegs ? 1.3 : 1;

  // legs: baggy trousers with a rolled cuff, a sock, and a chunky sneaker
  const legs = [], knees = [];
  [-1, 1].forEach((sd) => {
    const hip = pivot(body, sd * 0.09, HIP, 0);
    const thigh = [{ f: blend(0.03, capsule([0, 0.02, 0], [0, -THIGH, 0], 0.112 * wide, 0.104 * wide), sphere(0, 0.0, -0.02, 0.11)), color: C.pants }];
    if (C.pocket) thigh.push({ f: rbox(sd * 0.1, -0.14, 0, 0.022, 0.06, 0.062, 0.02), color: shade(C.pants, 0.9) });
    part(hip, thigh, [-0.21, -0.38, -0.21, 0.21, 0.14, 0.21], 28, 0.012);
    const knee = pivot(hip, 0, -THIGH, 0), F = -SHIN;
    if (C.winter) {
      // tights or trousers, then a winter boot: a shaft to mid-shin with a soft cuff, a rounded foot, a dark sole
      part(knee, [
        { f: capsule([0, 0, 0], [0, -0.12, 0.004], 0.1 * wide, 0.096 * wide), color: C.pants },
        { f: blend(0.03, capsule([0, -0.07, 0.004], [0, F + 0.1, 0.01], 0.086, 0.09), ellipsoid(sd * 0.008, F + 0.085, 0.06, 0.095, 0.08, 0.16)), color: C.boot },
        { f: ring(0, -0.06, 0.004, 0.085, 0.03), color: C.bootTrim },                                              // the cuff
        { f: both(ellipsoid(sd * 0.008, F + 0.03, 0.062, 0.103, 0.045, 0.178), above(() => F + 0.002)), color: shade(C.boot, 0.45) }, // sole
      ], [-0.2, F - 0.01, -0.19, 0.2, 0.13, 0.3], 44, 0.012);
    } else {
      part(knee, [
        { f: capsule([0, 0, 0], [0, -0.13, 0.004], 0.104 * wide, 0.112 * wide), color: C.pants },
        { f: ring(0, -0.155, 0.004, 0.085 * wide, 0.036), color: C.cuff },                                      // the rolled cuff
        { f: capsule([0, -0.15, 0], [0, -0.21, 0.005], 0.06, 0.062), color: '#f6f1e6' },                         // sock
        { f: blend(0.03, ellipsoid(sd * 0.01, F + 0.1, 0.055, 0.1, 0.09, 0.175), ellipsoid(sd * 0.01, F + 0.125, -0.04, 0.088, 0.072, 0.088)), color: C.shoe }, // the sneaker's upper
        { f: both(union(ellipsoid(sd * 0.01, F + 0.024, 0.058, 0.108, 0.05, 0.2), ellipsoid(sd * 0.01, F + 0.074, 0.2, 0.088, 0.062, 0.068)), above(() => F + 0.002)), color: '#f6f1e6' }, // sole and toe cap
        { f: union(capsule([-0.04, F + 0.168, 0.105], [0.06, F + 0.168, 0.105], 0.013), capsule([-0.04, F + 0.182, 0.06], [0.06, F + 0.182, 0.06], 0.013), capsule([sd * 0.108, F + 0.08, 0.0], [sd * 0.106, F + 0.1, 0.12], 0.014)), color: '#f6f1e6' }, // laces and side stripe
      ].concat(C.patch && sd > 0 ? [{ f: rbox(0.03, -0.07, 0.1 * wide, 0.026, 0.026, 0.012, 0.008), color: C.patch }] : []),
      [-0.2, F - 0.01, -0.19, 0.2, 0.13, 0.3], 44, 0.012);
    }
    legs.push(hip); knees.push(knee);
  });

  part(body, [{ f: ellipsoid(0, HIP - 0.005, 0, 0.165 * (C.wideLegs ? 1.1 : 1), 0.085, 0.13), color: C.pants }], [-0.22, HIP - 0.12, -0.17, 0.22, HIP + 0.1, 0.17], 22); // pelvis
  // torso: a hoodie, with (for the boy) an open jacket over it; the hood, and the backpack's straps
  const chest = pivot(body, 0, HIP, 0); // bends a little at the waist
  const trunk = both(blend(0.05, rbox(0, 0.17, 0, 0.165, 0.245, 0.135, 0.11), ellipsoid(0, 0.36, -0.005, 0.165, 0.13, 0.125), capsule([-0.15, 0.4, 0], [0.15, 0.4, 0], 0.075)), (x, y) => 0.012 - y, 0.03);
  const T = [];
  if (C.winter) {
    // a coat buttoned to the neck: for her a long one, red, with toggles; for him a navy jacket with a zip and collar
    const coat = grow(trunk, 0.022);
    T.push({ f: coat, color: (x, y, z) => (y < 0.05 ? C.coatTrim : z > 0.12 && Math.abs(x) < 0.012 && !C.skirt ? shade(C.coat, 0.7) : C.coat) });
    T.push({ f: blend(0.03, ring(0, 0.455, 0.0, 0.098, 0.048)), color: C.coatTrim });                                    // collar
    if (C.skirt) T.push({ f: union(...[0.33, 0.24, 0.15].map((y) => ellipsoid(0, y, 0.16, 0.016, 0.022, 0.012))), color: '#f3e9d8' }); // toggles
  } else if (C.jacket) {
    // the jacket: the trunk grown a little, open down the front in a V that widens toward the collar
    const open = (x, y, z) => Math.max(Math.abs(x) - (0.035 + 0.07 * Math.max(0, y) / 0.45), -z);
    const jacket = carve(grow(trunk, 0.02), open, 0.012);
    T.push({ f: grow(trunk, 0.004), color: (x, y) => (y < 0.13 && y > 0.03 ? shade(C.top, 0.94) : C.top) });         // hoodie, its pocket a shade darker
    T.push({ f: jacket, color: (x, y) => (y < 0.035 ? shade(C.jacket, 0.82) : C.jacket) });                            // jacket and its hem
    if (C.badge) T.push({ f: ellipsoid(0.1, 0.3, 0.14, 0.02, 0.032, 0.012), color: C.badge });
  } else {
    const hoodie = grow(trunk, 0.022);
    T.push({ f: hoodie, color: (x, y) => (y < 0.04 ? shade(C.top, 0.9) : C.top) });
    T.push({ f: rbox(0, 0.115, 0.15, 0.09, 0.048, 0.03, 0.03), color: shade(C.top, 0.95) });                          // pouch pocket
    if (C.motif === 'cat') T.push({ f: union(ellipsoid(0, 0.3, 0.158, 0.034, 0.026, 0.012), capsule([-0.022, 0.318, 0.158], [-0.028, 0.34, 0.156], 0.012, 0.004), capsule([0.022, 0.318, 0.158], [0.028, 0.34, 0.156], 0.012, 0.004)), color: '#9a8f8a' });
  }
  if (!C.winter) T.push({ f: blend(0.03, ring(0, 0.455, 0.0, 0.105, 0.05), ellipsoid(0, 0.42, -0.125, 0.145, 0.095, 0.085)), color: C.top });  // hood: a roll round the neck, the hood hanging behind
  if (!C.winter) T.push({ f: union(capsule([-0.035, 0.42, 0.15], [-0.04, 0.31, 0.162], 0.008), capsule([0.035, 0.42, 0.15], [0.04, 0.33, 0.162], 0.008)), color: C.scrunchie || '#f6f1e6' }); // drawstrings
  if (!C.winter) T.push({ f: both(grow(trunk, 0.032), (x, y) => y - 0.05, 0.012), color: shade(outer, C.jacket ? 0.82 : 0.9) });                      // hem band
  T.push({ f: capsule([0, 0.44, 0], [0, 0.5, 0], 0.058), color: C.skin });                                               // neck
  // straps: from the top of the pack, over the shoulder, down the chest and back under the arm
  if (!C.winter) T.push({ f: mirror(union(strand([0.11, 0.4, -0.14], [0.115, 0.5, 0.0], [0.115, 0.36, 0.14], 0.026, 0.026), strand([0.115, 0.36, 0.14], [0.13, 0.2, 0.175], [0.175, 0.1, 0.02], 0.026, 0.026))), color: C.packTrim });
  part(chest, T, [-0.3, -0.07, -0.25, 0.3, 0.55, 0.23], 64, 0.012);

  // the skirt: flared below the coat, swinging on its own pivot; the scarf, its ends hanging down the front
  let skirt = null, scarfEnds = null;
  if (C.skirt) {
    skirt = pivot(body, 0, HIP + 0.02, 0);
    const R = (y) => 0.17 + (-y) * 0.55, shell = (x, y, z) => Math.max(Math.abs(Math.hypot(x, z * 1.12) - R(y)) - 0.016, y, -0.24 - y);
    part(skirt, [{ f: shell, color: (x, y) => (y < -0.21 ? shade(C.skirt, 0.92) : C.skirt) }], [-0.34, -0.27, -0.32, 0.34, 0.02, 0.32], 40, 0.006);
  }
  if (C.scarf) {
    part(chest, [{ f: blend(0.025, ring(0, 0.46, 0.012, 0.1, 0.05), ellipsoid(0.04, 0.44, 0.13, 0.06, 0.05, 0.05)), color: C.scarf }], [-0.2, 0.36, -0.18, 0.2, 0.55, 0.22], 30, 0.008);
    scarfEnds = pivot(chest, 0.05, 0.43, 0.16);
    part(scarfEnds, [{ f: union(strand([0, 0, 0], [0.01, -0.1, 0.04], [0.02, -0.21, 0.035], 0.04, 0.034), strand([0.03, -0.01, -0.01], [0.06, -0.08, 0.03], [0.07, -0.16, 0.03], 0.036, 0.03)), color: (x, y) => (y < -0.17 ? shade(C.scarf, 0.9) : C.scarf) }], [-0.08, -0.27, -0.06, 0.15, 0.06, 0.1], 26, 0.006);
  }
  // arms: shoulder and elbow, a baggy sleeve with a cuff, a mitten hand
  const arms = [], elbows = [], hands = [];
  [-1, 1].forEach((sd) => {
    const sh = pivot(chest, sd * 0.2, SHOULDER - HIP, 0);
    part(sh, [{ f: capsule([0, 0, 0], [0, -UPPER, 0], 0.074, 0.07), color: outer }], [-0.1, -0.3, -0.1, 0.1, 0.1, 0.1], 20);
    const el = pivot(sh, 0, -UPPER, 0);
    part(el, [
      { f: capsule([0, 0, 0], [0, -FORE + 0.045, 0], 0.07, 0.078), color: outer },
      { f: ring(0, -FORE + 0.035, 0, 0.056, 0.03), color: C.winter ? C.coatTrim : C.jacket ? C.top : shade(C.top, 0.9) }, // cuff
      { f: blend(0.025, ellipsoid(0, -FORE - HAND + 0.008, 0, 0.058, 0.066, 0.05), ellipsoid(0, -FORE - HAND - 0.035, 0.014, 0.046, 0.036, 0.04), capsule([-sd * 0.04, -FORE - HAND + 0.03, 0.03], [-sd * 0.05, -FORE - HAND - 0.01, 0.045], 0.024, 0.02)), color: C.skin }, // hand and thumb
    ], [-0.12, -0.36, -0.11, 0.12, 0.1, 0.11], 38, 0.01);
    const hand = pivot(el, 0, -(FORE + HAND), 0);
    arms.push(sh); elbows.push(el); hands.push(hand);
  });

  // backpack: hangs from the shoulders, bobs a beat behind the body (left at home in winter)
  const pack = pivot(chest, 0, 0.27, -0.175);
  pack.visible = !C.winter;
  part(pack, [
    { f: rbox(0, -0.01, -0.05, 0.15, 0.175, 0.075, 0.06), color: C.pack },
    { f: both(grow(rbox(0, -0.01, -0.05, 0.15, 0.175, 0.075, 0.06), 0.012), above(() => 0.045)), color: C.packTrim },   // the flap
    { f: rbox(0, -0.085, -0.125, 0.095, 0.06, 0.022, 0.02), color: C.packTrim },                                        // front pocket
    { f: union(rbox(-0.08, 0.04, -0.13, 0.014, 0.022, 0.012, 0.004), rbox(0.08, 0.04, -0.13, 0.014, 0.022, 0.012, 0.004)), color: '#d8b25a' }, // buckles
  ], [-0.2, -0.22, -0.18, 0.2, 0.22, 0.06], 40, 0.008);
  lump(pack, smooth('#f6f1e6'), [ball(0.026, 0, -0.1, -0.147, { s: [1.15, 0.9, 0.3] }), ball(0.012, -0.034, -0.066, -0.147, { s: [1, 1, 0.4] }), ball(0.012, -0.012, -0.052, -0.147, { s: [1, 1, 0.4] }), ball(0.012, 0.012, -0.052, -0.147, { s: [1, 1, 0.4] }), ball(0.012, 0.034, -0.066, -0.147, { s: [1, 1, 0.4] })], true); // paw print

  // head: the sculpted skull, the face on its surface, and hair that sways after it
  const head = pivot(chest, 0, NECK - HIP, 0); head.scale.setScalar(1.08);
  const skull = headField();
  part(head, [{ f: skull, color: C.skin }], [-0.36, -0.02, -0.29, 0.36, 0.56, 0.3], 44);
  const face = makeFace(head, C, (x, y) => frontOf(skull, x, y) || 0.25);
  const hairU = { uSway: { value: new THREE.Vector3() }, uHairT: { value: 0 }, uHairWind: { value: 0 } };
  const hair = pivot(head, 0, 0, 0), hairMat = () => swaying(painted({ side: THREE.DoubleSide, roughness: 0.8 }), hairU);
  const addLocks = (parent, build) => { const L = new Locks(C.hair); build(L); const m = new THREE.Mesh(L.geometry(), hairMat()); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };
  // the cap under the locks, darker so the gaps between locks read as depth
  const fluffy = C.hairStyle === 'fluffy';
  part(hair, [{ f: capField((x, z) => (fluffy ? 0.31 : 0.3) + (z > 0 ? 0.7 : 0.6) * z - 0.1 * Math.abs(x) * (z > 0 ? 1 : 0)), color: shade(C.hair, 0.72) }], [-0.37, 0.0, -0.36, 0.37, 0.62, 0.36], 36);
  const HAT_LINE = (z) => 0.31 + 0.06 * z / 0.36;                                                // the hat's edge: over the brow at the front, lower at the back
  // a knitted hat: a soft dome over the hair with a ribbed band and a pompom (her bun peeks out at the back)
  if (C.hat) {
    part(hair, [
      { f: both(ellipsoid(0, 0.31, -0.035, 0.395, 0.385, 0.395), above((x, z) => HAT_LINE(z)), 0.025), color: (x, y, z) => (Math.sin(Math.atan2(x, z + 0.02) * 22) > 0.35 ? shade(C.hat, 0.93) : C.hat) }, // knitted ribs
      { f: (x, y, z) => Math.max(Math.abs(Math.hypot(x, z + 0.035) - 0.39) - 0.032, Math.abs(y - HAT_LINE(z) - 0.03) - 0.04), color: shade(C.hat, 0.93) }, // the turned-up band
      { f: sphere(0.0, 0.71, -0.06, 0.08), color: C.hat },                                                     // pompom
    ], [-0.46, 0.2, -0.46, 0.46, 0.82, 0.46], 46, 0.01);
  }
  let bun = null;
  if (fluffy) addLocks(hair, (L) => boyHair(L, r));
  else {
    const bunAt = C.hat ? new THREE.Vector3(-0.02, 0.45, -0.3) : new THREE.Vector3(-0.03, 0.585, -0.14); // (under a hat it sits low at the back)
    addLocks(hair, (L) => girlHair(L, r, bunAt));
    bun = pivot(hair, bunAt.x, bunAt.y, bunAt.z); bun.rotation.set(-0.4, 0, 0.18);
    addLocks(bun, (L) => bunHair(L, r));
    lump(bun, smooth(shade(C.hair, 0.8)), [ball(0.135, 0, 0.175, 0)]);                                                   // fills the middle of the bun
    lump(bun, smooth(C.scrunchie), Array.from({ length: 9 }, (_, i) => ball(0.042, Math.sin((i / 9) * TAU) * 0.095, 0.0, Math.cos((i / 9) * TAU) * 0.095, { s: [1, 0.8, 1] }))); // scrunchie: a ring of soft gathers
  }
  // Hair, bun and backpack follow the head a beat late: a point on a spring chases the head, and how far
  // it trails behind is how far the hair is thrown. Call once a frame, after posing the figure.
  const anchor = new THREE.Vector3(), vel = new THREE.Vector3(), at = new THREE.Vector3(), lag = new THREE.Vector3(), q = new THREE.Quaternion();
  let started = false;
  const bunRest = bun ? bun.rotation.clone() : null;
  function sway(dt, t, wind = 0) {
    head.getWorldPosition(at);
    if (!started || anchor.distanceToSquared(at) > 4) { anchor.copy(at); vel.set(0, 0, 0); started = true; } // (teleports don't whip the hair)
    const steps = Math.max(1, Math.ceil(dt / 0.012)), h = Math.min(dt, 0.05) / steps;
    for (let i = 0; i < steps; i++) { vel.addScaledVector(lag.subVectors(at, anchor), 150 * h).multiplyScalar(Math.max(0, 1 - 11 * h)); anchor.addScaledVector(vel, h); }
    lag.subVectors(anchor, at).applyQuaternion(head.getWorldQuaternion(q).invert());   // into the head's own frame
    if (lag.length() > 0.085) lag.setLength(0.085);
    hairU.uSway.value.copy(lag); hairU.uHairT.value = t; hairU.uHairWind.value = wind;
    if (bun) bun.rotation.set(bunRest.x + lag.z * 4, bunRest.y, bunRest.z - lag.x * 4);
    pack.rotation.x = lag.z * 1.6 - lag.y * 1.2;
    if (skirt) skirt.rotation.set(lag.z * 2.6 - lag.y, 0, -lag.x * 2.6);   // the skirt flares and swings out after a turn
    if (scarfEnds) scarfEnds.rotation.set(lag.z * 5 + lag.y * 2, 0, -lag.x * 5);
    pack.position.y = 0.27 + lag.y * 0.35;
  }
  const own = new Set(); root.traverse((o) => own.add(o)); // the child's own parts (anything added later is carried, see moveAttachments)
  return { root, body, chest, legs, knees, arms, elbows, hands, head, hair, bun, pack, skirt, face, eyes: face.eyes.map((q2) => q2.ball), dims, sway, own, winter: !!C.winter, kid: true };
}

/** Changing clothes: move whatever was added to one child's joints since it was built (a rod, a bouquet, a flower in the hair) onto another's. */
export function moveAttachments(from, to) {
  const joints = (k) => [k.root, k.body, k.chest, k.head, k.hair, ...k.legs, ...k.knees, ...k.arms, ...k.elbows, ...k.hands];
  const a = joints(from), b = joints(to);
  a.forEach((j, i) => { for (const c of [...j.children]) if (!from.own.has(c)) b[i].add(c); });
}
