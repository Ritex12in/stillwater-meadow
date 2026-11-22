// Dev tool: the children under plain light. ?who=boy|girl  ?view=turn (front, side, back) | faces (each expression, close up)
import * as THREE from 'three';
import { makeKid, KIDS } from '/src/characters/kid.js';
import { poseKid } from '/src/characters/kidpose.js';
import { poseCouple, handGaps, routine, DANCE_LENGTH, BAR } from '/src/characters/couple.js';
import { poseSnow, snowContacts, SNOW_LENGTH, LOOP_R } from '/src/characters/skatedance.js';
const q = new URLSearchParams(location.search), who = (q.get('who') || 'boy') + (q.get('winter') ? 'Winter' : ''), view = q.get('view') || 'turn';
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(+(q.get('pr') || 1)); renderer.setSize(innerWidth, innerHeight); // (?pr=3: three pixels to one, for close looks at detail)
 renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f6ebe2');
scene.add(new THREE.HemisphereLight('#fff6ec', '#a89888', 0.7));
const sun = new THREE.DirectionalLight('#fff1dc', 0.75); sun.position.set(-3, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: '#efe1d4' })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
const kids = [];
if (view === 'body') {
  // close on the body, four ways round, standing or (?move=2.7) mid-stride: where clothes, hands and the pack meet
  const mv = +(q.get('move') || 0), ph = +(q.get('phase') || 1.2);
  [[0, -0.9], [Math.PI / 2, -0.3], [Math.PI, 0.3], [-Math.PI / 2, 0.9]].forEach(([ry, x]) => {
    const k = makeKid(KIDS[who]); k.root.position.x = x * 0.95; k.root.rotation.y = ry; scene.add(k.root); kids.push(k);
    const st = { t: 1, move: mv, phase: ph, sitAmt: 0, petAmt: 0, lie: 0, pickT: 0, ground: 0 };
    for (let i = 0; i < 40; i++) poseKid(k, st, 1 / 30);
  });
  cam.position.set(0, 0.75, 3.0); cam.lookAt(0, 0.62, 0);
} else if (view === 'turn') {
  [[0, -1.05], [Math.PI / 2, 0], [Math.PI, 1.05], [0.6, 2.1]].forEach(([ry, x]) => { const k = makeKid(KIDS[who]); k.root.position.x = x - 0.52; k.root.rotation.y = ry; scene.add(k.root); kids.push(k); });
  cam.position.set(0, 1.0, 5.0); cam.lookAt(0, 0.82, 0);
} else if (view === 'motion') {
  // one kid darting side to side and stopping, so the hair's lag and settle can be seen; ?wind=1 adds wind
  const k = makeKid(KIDS[who]); scene.add(k.root); kids.push(k);
  cam.position.set(0, 1.3, 5.2); cam.lookAt(0, 1.05, 0);
  const wind = +(q.get('wind') || 0);
  let t = 0;
  window.__step = (dt) => {
    t += dt;
    const ph = t % 4;                                   // run right, stop, run left, stop
    const x = ph < 1 ? -0.7 + 1.4 * ph : ph < 2 ? 0.7 : ph < 3 ? 0.7 - 1.4 * (ph - 2) : -0.7;
    k.root.position.x = x; k.root.rotation.y = ph < 2 ? Math.PI / 2 : -Math.PI / 2;
    k.root.position.y = (ph < 1 || (ph >= 2 && ph < 3)) ? Math.abs(Math.sin(t * 9)) * 0.05 : 0;
    k.root.updateMatrixWorld(true);
    k.face.update(dt, t); k.sway(dt, t, wind);
    renderer.render(scene, cam);
  };
  if (!q.get('manual')) { let last = performance.now(); const loop = (now) => { window.__step(Math.min(0.05, (now - last) / 1000)); last = now; requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
} else if (view === 'dance' && q.get('play')) {
  // the whole dance, looping in real time, the camera slowly circling them
  const b = makeKid(KIDS.boy), g = makeKid(KIDS.girl); scene.add(b.root, g.root);
  const sb = {}, sg = {}, frame = { x: 0, z: 0, heading: 0 };
  const label = document.createElement('div'); label.style.cssText = 'position:fixed;left:16px;bottom:14px;font:600 14px system-ui;color:#5a4636'; document.body.appendChild(label);
  const t0 = performance.now(); let last = t0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = ((now - t0) / 1000) % (DANCE_LENGTH + 2);
    const res = poseCouple(b, g, frame, Math.min(t, DANCE_LENGTH), sb, sg, dt);
    b.face.update(dt, t); g.face.update(dt, t); b.sway(dt, t, 0.3); g.sway(dt, t, 0.3);
    const a = now / 9000;
    cam.position.set(Math.sin(a) * 4.6, 1.7, Math.cos(a) * 4.6); cam.lookAt(0, 0.7, 0);
    label.textContent = `bar ${Math.floor(res.R.bar) + 1} of 16 · ${t.toFixed(1)} s`;
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else if (view === 'dance') {
  // the couple dance: ?t=seconds for one moment, or ?strip=1 for a row of moments (one per two bars); the hand gaps go in the title
  const at = q.get('strip') ? [1.3, 3, 5, 7, 8.6, 9.3, 11.5, 14.5].map((b) => b * BAR) : [+(q.get('t') || 5)];
  const gaps = [];
  at.forEach((t, i) => {
    const b = makeKid(KIDS.boy), g = makeKid(KIDS.girl); scene.add(b.root, g.root); kids.push(b, g);
    const sb = {}, sg = {}, x = at.length > 1 ? (i - 3.5) * 2.1 : 0;
    // run up to the moment so the state (pocket, look) has settled
    for (let n = 0; n < 20; n++) poseCouple(b, g, { x, z: 0, heading: Math.PI / 2 }, Math.max(0, t - 0.6 + n * 0.03), sb, sg, 1 / 30);
    const gp = handGaps(b, g), R = routine(t);
    gaps.push(`${t.toFixed(1)}s A${R.holdA > 0.5 ? (gp[0] * 100).toFixed(0) : '-'} B${R.holdB > 0.5 ? (gp[1] * 100).toFixed(0) : '-'}`);
  });
  document.title = 'gaps(cm) ' + gaps.join(' | ');
  if (at.length > 1) { cam.position.set(0, 2.2, 11.5); cam.lookAt(0, 0.7, 0); } else { const c = (q.get('cam') || '0.4,1.4,3.6').split(',').map(Number); cam.position.set(c[0], c[1], c[2]); cam.lookAt(0, 0.8, 0); }
} else if (view === 'snow') {
  // the skating dance, in winter costume on pale ice. ?play=1 loops it with a following camera; otherwise ?t= one moment or
  // ?strip=1 eight moments in a row. Each pair is turned so its line of travel runs into the screen. Contacts (cm) go in the title.
  scene.background.set('#dfe8ef'); ground.material.color.set('#e8f0f5');
  const pair = () => { const b = makeKid(KIDS.boyWinter), g = makeKid(KIDS.girlWinter), grp = new THREE.Group(); grp.add(b.root, g.root); scene.add(grp); kids.push(b, g); return { b, g, grp, sb: {}, sg: {} }; };
  const frame = { x: 0, z: 0, heading: 0 };
  // pose at the true spot, then move the pair so its centre sits at (x, 0) with its travel direction facing -z
  const place = (p, t, dt, x) => {
    p.grp.position.set(0, 0, 0); p.grp.rotation.set(0, 0, 0); p.grp.updateMatrixWorld(true);
    const res = poseSnow(p.b, p.g, frame, t, p.sb, p.sg, dt);
    // turn the pair so the line from him to her runs left to right across the screen
    const bp = p.b.root.position, gp = p.g.root.position, th = Math.PI / 2 - Math.atan2(gp.x - bp.x, gp.z - bp.z);
    const c = new THREE.Vector3().addVectors(bp, gp).multiplyScalar(0.5);
    p.grp.rotation.y = th; c.y = 0; c.applyAxisAngle(new THREE.Vector3(0, 1, 0), th);
    p.grp.position.set(x - c.x, 0, -c.z); p.grp.updateMatrixWorld(true);
    return res;
  };
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}${(v * 100).toFixed(0)}`).join(' ');
  if (q.get('play')) {
    const p = pair(), label = document.createElement('div'); label.style.cssText = 'position:fixed;left:16px;bottom:14px;font:600 14px system-ui;color:#3e4a58'; document.body.appendChild(label);
    const t0 = performance.now(); let last = t0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = ((now - t0) / 1000) % (SNOW_LENGTH + 2);
      place(p, Math.min(t, SNOW_LENGTH), dt, 0);
      p.b.face.update(dt, t); p.g.face.update(dt, t); p.b.sway(dt, t, 0.4); p.g.sway(dt, t, 0.4);
      const a = now / 11000;
      cam.position.set(Math.sin(a) * 5, 1.8, Math.cos(a) * 5); cam.lookAt(0, 0.7, 0);
      label.textContent = `${t.toFixed(1)} s · ${fmt(snowContacts(p.b, p.g, t))}`;
      renderer.render(scene, cam);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    const at = q.get('strip') ? (q.get('times') || '2,8,16,24,32,40,48,56').split(',').map(Number) : [+(q.get('t') || 8)];
    const notes = [];
    at.forEach((t, i) => {
      const p = pair(), x = at.length > 1 ? (i - (at.length - 1) / 2) * 2.05 : 0;
      for (let n = 0; n < 30; n++) place(p, Math.max(0, t - 0.9 + n * 0.03), 1 / 30, x);
      for (let n = 0; n < 40; n++) { p.b.sway(1 / 30, t, 0.3); p.g.sway(1 / 30, t, 0.3); }
      notes.push(`${t}s ${fmt(snowContacts(p.b, p.g, t))}`);
    });
    document.title = notes.join(' | ');
    if (at.length > 1) { cam.position.set(0, 2.6, 14); cam.lookAt(0, 0.7, 0); } else { const c = (q.get('cam') || '0.4,1.4,3.8').split(',').map(Number); cam.position.set(c[0], c[1], c[2]); cam.lookAt(0, 0.8, 0); }
  }
} else if (view === 'poses') {
  // the movement poses, seen three-quarter on: two walk frames, two run frames, idle with hands in pockets, sitting, kneeling to pet
  const states = [
    { move: 2.7, phase: 1.2 }, { move: 2.7, phase: 2.9 }, { move: 5.4, phase: 1.2 }, { move: 5.4, phase: 2.9 },
    { move: 0, phase: 0, idleT: 9 }, { move: 0, phase: 0, sitAmt: 1, seatTop: 0.44 }, { move: 0, phase: 0, petAmt: 1 },
  ];
  states.forEach((st, i) => {
    const k = makeKid(KIDS[who]); k.root.position.x = (i - 3) * 1.0; k.root.rotation.y = 1.0; scene.add(k.root); kids.push(k);
    Object.assign(st, { t: 3, turn: 0 });
    for (let n = 0; n < 60; n++) poseKid(k, st, 1 / 30);
    k.root.updateMatrixWorld(true);
    if (st.sitAmt) { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.44, 0.5), new THREE.MeshLambertMaterial({ color: '#b08a62' })); seat.position.set(k.root.position.x - 0.12, 0.22, -0.12); seat.rotation.y = 1.0; scene.add(seat); }
  });
  cam.position.set(0, 1.5, 8.6); cam.lookAt(0, 0.75, 0);
} else if (view === 'head') {
  [[0, -0.75], [0.75, 0], [Math.PI / 2, 0.75], [Math.PI, 1.5]].forEach(([ry, x]) => { const k = makeKid(KIDS[who]); k.root.position.x = x - 0.38; k.root.rotation.y = ry; scene.add(k.root); kids.push(k); });
  cam.position.set(0, 1.42, 3.6); cam.lookAt(0, 1.3, 0);
} else {
  // heads only, two rows of four
  ['calm', 'happy', 'wow', 'think', 'worried', 'grit', 'sad', 'sleepy'].forEach((name, i) => { const k = makeKid(KIDS[who]); k.face.set(name); k.head.position.set((i % 4 - 1.5) * 0.85, i < 4 ? 0.42 : -0.42, 0); k.head.rotation.y = (i % 2 ? -1 : 1) * 0.2; scene.add(k.head); kids.push(k); });
  ground.visible = false;
  cam.position.set(0, 0.32, 4.2); cam.lookAt(0, 0.32, 0);
}
for (let i = 0; i < 40; i++) kids.forEach((k) => k.face.update(1 / 30, 1 + i / 30));
renderer.render(scene, cam);
window.__ready = true;
