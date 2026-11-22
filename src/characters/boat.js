// Bamboo canopy boat and the skipper who poles you once around the lake.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, clamp, lerp, damp, smooth, angDiff, rnd } from '../core/math.js';
import { lakeT, lakePoint, dockAt, DOCK_A, DOCK_LEN, DOCK_Y, KIT } from '../core/shape.js';
import { std, weatherize, glowTex } from '../core/materials.js';
import { seasonState, hooks } from '../core/state.js';
import { makeKid, KIDS, KID_DIMS } from './kid.js';
import { player, sitDown, standUp } from './player.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { burst } from '../systems/audio.js';
import { spawnRipple } from '../world/effects.js';

export const BOAT_DECK = 0.14;
const MOOR = dockAt(DOCK_LEN + 0.85, 0);        // moored across the end of the jetty
export const BOARD_POINT = dockAt(DOCK_LEN - 0.55, 0);

export const boat = new THREE.Group();
boat.rotation.order = 'YXZ';
export const ferry = { state: 'docked', dist: 0, speed: 0, timer: 0, dockedT: 10, bowT: 0, rideT: 0 };
export const boatSeat = {
  name: 'boat', boat: true, covered: true, x: MOOR.x, z: MOOR.z, baseY: BOAT_DECK, top: 0.48, rot: 0, standOff: 0,
  standTo: BOARD_POINT, slideMinY: DOCK_Y + 0.05,
  locked: () => ferry.state === 'touring',   // no stepping off in the middle of the lake
};
export const sk = { sit: 1, wave: 0, waveT: 0, waved: false, nod: 0, phase: 0, prevSin: 0, look: 0, pole: 0 };
export let skipper = null;

let boatPath = null, BOAT_PATH_LEN = 1;
const lanternMat = new THREE.MeshStandardMaterial({ color: '#f08a4b', emissive: '#ff8a3d', emissiveIntensity: 0, flatShading: true });
const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb070', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
const lanternPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: '#ffa860', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
const lanternLight = new THREE.PointLight('#ffb070', 0, 9, 2);
const skPole = new THREE.Group();
let wakeMat = null;

/** The tour: one calm loop round the lake the jetty stands at, starting and ending at the mooring. */
function layTour() {
  Object.assign(MOOR, dockAt(DOCK_LEN + 0.85, 0));
  Object.assign(BOARD_POINT, dockAt(DOCK_LEN - 0.55, 0));
  boatSeat.slideMinY = DOCK_Y + 0.05;
  const T_MOOR = lakeT(MOOR.x, MOOR.z), pts = [], N = 28;
  for (let i = 0; i < N; i++) {
    // (a lake with no jetty has no boat: it waits, unseen, where the jetty is put away)
    const p = i === 0 ? MOOR : KIT.dock ? lakePoint(DOCK_A + (i / N) * TAU, T_MOOR) : { x: MOOR.x + Math.cos((i / N) * TAU) * 3, z: MOOR.z + Math.sin((i / N) * TAU) * 3 };
    pts.push(new THREE.Vector3(p.x, 0, p.z));
  }
  boatPath = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  BOAT_PATH_LEN = boatPath.getLength();
  boat.visible = KIT.dock;
}

export function buildBoat() {
  layTour();
  // the jetty has moved to another lake: the boat is moored there, its tour laid round that lake
  hooks.anchor.push(() => { layTour(); Object.assign(ferry, { state: 'docked', dist: 0, speed: 0, timer: 0, dockedT: 10, bowT: 0, rideT: 0 }); });
  scene.add(boat);

  const bambooA = weatherize(std('#b9a35e'), 'std'), bambooB = weatherize(std('#a89050'), 'std');
  const weave = weatherize(std('#8f7446', { side: THREE.DoubleSide }), 'std');
  const deckMat = weatherize(std('#7c5f3a'), 'std');
  const dark = std('#3a2e22');
  const add = (mesh, x, y, z, rx) => { mesh.position.set(x, y, z); if (rx) mesh.rotation.x = rx; mesh.castShadow = true; mesh.receiveShadow = true; boat.add(mesh); return mesh; };
  const pole = (r, len, m) => new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 7).rotateX(Math.PI / 2), m);
  const xs = [-0.56, -0.38, -0.19, 0, 0.19, 0.38, 0.56], ys = [0.17, 0.07, 0.01, -0.01, 0.01, 0.07, 0.17];
  xs.forEach((x, i) => add(pole(0.085, 5.0 - Math.abs(x) * 1.6, i % 2 ? bambooA : bambooB), x, ys[i], 0));
  [1, -1].forEach((d) => { for (let i = -1; i <= 1; i++) add(pole(0.075, 1.1, i ? bambooA : bambooB), i * 0.16, 0.24, d * 2.78, -d * 0.42); });
  [-2.1, -1.0, 0.2, 1.4, 2.2].forEach((z) => add(new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.05, 0.06), dark), 0, 0.2, z));
  add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 4.3), deckMat), 0, BOAT_DECK - 0.02, 0);
  [-0.66, 0.66].forEach((x) => add(pole(0.05, 4.4, bambooA), x, 0.3, 0));
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 12, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), weave), 0, 1.15, -0.55);
  [-0.7, 0.7].forEach((x) => [-1.25, 0.15].forEach((z) => add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.02, 5), bambooA), x, BOAT_DECK + 0.51, z)));
  add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.4), deckMat), 0, BOAT_DECK + 0.45, 0.75);
  [-0.42, 0.42].forEach((x) => add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.3), deckMat), x, BOAT_DECK + 0.21, 0.75));
  add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.32), deckMat), 0, BOAT_DECK + 0.37, -1.85);
  [-0.34, 0.34].forEach((x) => add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.26), deckMat), x, BOAT_DECK + 0.17, -1.85));
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3), dark), 0.7, 1.43, 0.15);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 8), lanternMat), 0.7, 1.22, 0.15).castShadow = false;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.04, 8), dark), 0.7, 1.37, 0.15);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.04, 8), dark), 0.7, 1.07, 0.15);
  lanternGlow.position.set(0.7, 1.22, 0.15); lanternGlow.scale.set(1.5, 1.5, 1);
  lanternPool.position.set(0.95, -0.01, 0.15); lanternPool.scale.set(3.4, 1, 3.4);
  lanternLight.position.set(0.7, 1.2, 0.15);
  boat.add(lanternGlow, lanternPool, lanternLight);

  // the skipper, drawn as the children are (characters/kid.js: KIDS.skipper), a little taller, under a straw hat
  skipper = makeKid(KIDS.skipper);
  skipper.root.scale.setScalar(1.1);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.3, 14).translate(0, 0.6, -0.02), weatherize(std('#d9c07e'), 'std'));
  hat.castShadow = true;
  skipper.head.add(hat);
  const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 4.6, 6).translate(0, -1.3, 0), std('#a8924e'));
  pm.castShadow = true;
  skPole.add(pm);
  skPole.position.set(0.1, 0.9, 0.42); // (where his hands are, the arms raised to pole)
  skipper.body.add(skPole);
  skipper.root.position.set(0, BOAT_DECK, -1.85);
  boat.add(skipper.root);

  wakeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAmt: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) } }]),
    transparent: true, depthWrite: false, fog: true,
    vertexShader: `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uAmt; uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float x = vUv.x * 2.0 - 1.0;
        float y = vUv.y;
        float edge = abs(abs(x) - (0.12 + y * 0.85));
        float foam = smoothstep(0.07, 0.0, edge) * (0.55 + 0.45 * sin(y * 40.0 - uTime * 6.0 + x * 8.0));
        float trail = smoothstep(0.25, 0.0, abs(x)) * smoothstep(0.5, 0.0, y) * 0.35;
        gl_FragColor = vec4(uColor, (foam + trail) * pow(1.0 - y, 1.5) * uAmt * 0.55);
        #include <fog_fragment>
      }`,
  });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(6, 10).rotateX(-Math.PI / 2), wakeMat);
  wake.position.set(0, -0.015, -7.4);
  wake.renderOrder = 2;
  boat.add(wake);

  registerAction({
    id: 'board', key: 'KeyE', keyLabel: 'E',
    available: () => activity.free && ferry.state === 'docked' && Math.hypot(BOARD_POINT.x - player.x, BOARD_POINT.z - player.z) < 1.8,
    label: () => (seasonState.ice >= 0.3 ? 'The lake is frozen' : 'Board the boat'),
    disabled: () => seasonState.ice >= 0.3,
    score: () => -Math.hypot(BOARD_POINT.x - player.x, BOARD_POINT.z - player.z) + 0.5,
    run: boardBoat,
  });
  registerAction({
    id: 'step-off', key: 'KeyE', keyLabel: 'E',
    available: () => player.seat === boatSeat && activity.is('sit'),
    label: () => (ferry.state === 'touring' ? 'Riding around the lake' : 'Step off'),
    disabled: () => ferry.state === 'touring',
    score: () => 1000,
    run: standUp,
  });
}

export function boardBoat() {
  if (!sitDown(boatSeat)) return;
  ferry.state = 'boarding';
  ferry.timer = 2.6;
  sk.nod = 0.9; sk.waveT = 0;
}

const bpV = new THREE.Vector3(), btV = new THREE.Vector3(), tmpV = new THREE.Vector3();
export function updateBoat(dt, t, eve, dayLevel) {
  const aboard = player.seat === boatSeat;
  if (ferry.state === 'boarding') {
    if (!aboard) ferry.state = 'docked';
    else { ferry.timer -= dt; if (ferry.timer <= 0 && player.sitAmt > 0.8) { ferry.state = 'touring'; ferry.dist = 0; ferry.rideT = 0; } }
  } else if (ferry.state === 'touring') {
    ferry.rideT += dt; // ease away from the jetty over ~5 s, glide in over the last few metres
    ferry.speed = 0.2 + 1.4 * smooth(0, 5, ferry.rideT) * smooth(0, 7, BOAT_PATH_LEN - ferry.dist);
    ferry.dist += ferry.speed * dt;
    if (ferry.dist >= BOAT_PATH_LEN - 0.03) { ferry.dist = 0; ferry.state = 'docked'; ferry.speed = 0; ferry.dockedT = 0; }
  } else {
    ferry.speed = 0;
    ferry.dockedT += dt;
  }

  const u = (ferry.dist / BOAT_PATH_LEN) % 1;
  boatPath.getPointAt(u, bpV);
  boatPath.getTangentAt(u, btV);
  const yaw = Math.atan2(btV.x, btV.z);
  boat.position.set(bpV.x, 0.04 + Math.sin(t * 1.3) * 0.025, bpV.z);
  boat.rotation.set(Math.sin(t * 0.7) * 0.012 - ferry.speed * 0.01, yaw, Math.sin(t * 0.9) * 0.022);
  boat.updateMatrixWorld();
  tmpV.set(0, 0, 0.85); boat.localToWorld(tmpV);
  boatSeat.x = tmpV.x; boatSeat.z = tmpV.z; boatSeat.rot = yaw; boatSeat.baseY = boat.position.y + BOAT_DECK;

  tmpV.set(0, 0, -1.85); boat.localToWorld(tmpV);
  const dxp = player.x - tmpV.x, dzp = player.z - tmpV.z, dPlayer = Math.hypot(dxp, dzp);
  if (!aboard && dPlayer < 7 && !sk.waved && ferry.state === 'docked') { sk.waved = true; sk.waveT = 2.4; }
  if (dPlayer > 12) sk.waved = false;
  sk.waveT = Math.max(0, sk.waveT - dt);
  sk.wave = damp(sk.wave, sk.waveT > 0 ? 1 : 0, 6, dt);
  sk.nod = Math.max(0, sk.nod - dt);
  sk.sit = damp(sk.sit, ferry.state === 'docked' && !aboard && ferry.dockedT > 2.5 ? 1 : 0, 2.5, dt);
  sk.pole = damp(sk.pole, ferry.state === 'touring' ? 1 : 0, 2, dt);
  sk.phase += dt * (0.6 + ferry.speed * 1.6);
  const sn = Math.sin(sk.phase), push = 0.5 + 0.5 * sn;
  const lookTarget = dPlayer < 10 ? clamp(angDiff(yaw, Math.atan2(dxp, dzp)), -1.1, 1.1) : Math.sin(t * 0.3) * 0.5;
  sk.look = damp(sk.look, aboard ? 0 : lookTarget, 3, dt);
  poseSkipper(push, t, dt);

  if (ferry.state === 'touring' && ferry.speed > 0.3) {
    if (sk.prevSin <= 0 && sn > 0) { // the pole bites the water
      tmpV.set(0, -3.4, 0); skPole.localToWorld(tmpV);
      spawnRipple(tmpV.x, tmpV.z, 1.1);
      burst(tmpV.x, tmpV.z, { freq: rnd(700, 1100), vol: 0.12 });
    }
    ferry.bowT -= dt;
    if (ferry.bowT <= 0) { tmpV.set(0, 0, 2.6); boat.localToWorld(tmpV); spawnRipple(tmpV.x, tmpV.z, 0.7); ferry.bowT = 0.55; }
  }
  sk.prevSin = sn;

  wakeMat.uniforms.uAmt.value = clamp(ferry.speed / 1.3, 0, 1);
  wakeMat.uniforms.uTime.value = t;
  wakeMat.uniforms.uColor.value.setScalar(0.35 + 0.65 * Math.max(dayLevel, 0.15));
  lanternMat.emissiveIntensity = eve * 1.8;
  lanternGlow.material.opacity = eve * 0.8;
  lanternPool.material.opacity = eve * 0.45;
  lanternLight.intensity = eve * 1.4;
}

function poseSkipper(push, t, dt) {
  const S = skipper, s = sk.sit, st = 1 - s, pp = sk.pole * st;
  S.legs[0].rotation.x = lerp(0.2 - pp * push * 0.15, -1.5, s);
  S.legs[1].rotation.x = lerp(-0.25 + pp * push * 0.1, -1.45, s);
  S.knees[0].rotation.x = lerp(0.12 + pp * 0.2, 1.5, s);
  S.knees[1].rotation.x = lerp(0.18, 1.45, s);
  S.body.position.y = lerp(-0.03 * pp * push, 0.40 + 0.07 - KID_DIMS.hip, s);
  S.body.rotation.x = lerp(0.06 + pp * (0.1 + push * 0.22), -0.04, s);
  S.arms[0].rotation.x = lerp(lerp(-0.25, -1.25 + push * 0.55, sk.pole), -0.55, s);
  S.arms[1].rotation.x = lerp(lerp(-0.2, -0.95 + push * 0.55, sk.pole), -0.5, s);
  S.arms[0].rotation.z = lerp(-0.06, 0.38, sk.pole * st);
  S.arms[1].rotation.z = lerp(0.06, -0.3, sk.pole * st);
  if (sk.wave > 0.01) {
    S.arms[1].rotation.x = lerp(S.arms[1].rotation.x, -2.75, sk.wave);
    S.arms[1].rotation.z = lerp(S.arms[1].rotation.z, -0.2 + Math.sin(t * 9) * 0.45, sk.wave);
  }
  skPole.visible = st > 0.5;
  skPole.rotation.x = 0.12 + push * 0.5 * sk.pole;
  S.head.rotation.x = sk.nod > 0 ? Math.sin(((0.9 - sk.nod) / 0.9) * TAU) * 0.35 : 0;
  S.head.rotation.y = sk.look;
  S.face.update(dt, t); // (blinking; his face stays kindly)
  S.sway(dt, t, 0);      // his hair after the head
}
