// Dev tool: the pets under plain light, beside the boy for size. ?view=row (every dog and cat, standing and sitting) | close (the sheet's two, close up)
import * as THREE from 'three';
import { makeDog, makeCat } from '/src/characters/rigs.js';
import { makeKid, KIDS } from '/src/characters/kid.js';
const q = new URLSearchParams(location.search), view = q.get('view') || 'row';
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(+(q.get('pr') || 1)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f6ebe2');
scene.add(new THREE.HemisphereLight('#fff6ec', '#a89888', 0.7));
const sun = new THREE.DirectionalLight('#fff1dc', 0.75); sun.position.set(-3, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: '#efe1d4' })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 100);
const DOGS = [{ coat: '#f6eee2', patch: '#d98a4a' }, { coat: '#f3efe8', patch: '#3a3330', bandana: '#3f8f86', scale: 0.9 }, { coat: '#e2b46a', patch: '#b9853f', paw: '#f6ead6', bandana: '#4a6fb0', scale: 0.8 }];
const CATS = [{ fur: '#fbf6ee', patch: '#e58c3f', eye: '#8a6a2a' }, { fur: '#8f9298', belly: '#e9e7e2', eye: '#d9c14a', collar: '#3f6fa0' }, { fur: '#2d2a29', belly: '#f1ede6', eye: '#d6c23a', collar: '#c4473a' }, { fur: '#e8a35a', belly: '#fbf2e4', patch: '#c9783a', eye: '#6f9a3a' }];
const place = (r, x, z, ry, sit) => {
  r.root.scale.setScalar(r.scale); r.root.position.set(x, 0, z); r.root.rotation.y = ry; scene.add(r.root);
  if (sit) { r.legs[0].rotation.x = 0.45; r.legs[1].rotation.x = 0.45; r.legs[2].rotation.x = -1.25; r.legs[3].rotation.x = -1.25; r.rig.rotation.x = -0.45; r.rig.position.y = -r.sitDrop; r.head.rotation.x = 0.25; }
};
if (view === 'close') {
  place(makeDog(DOGS[0]), -0.42, 0, 0.5, q.get('sit')); place(makeCat(CATS[0]), 0.4, 0, -0.5, q.get('sit'));
  cam.position.set(0, 0.55, 2.3); cam.lookAt(0, 0.3, 0);
} else {
  const k = makeKid(KIDS.boy); k.root.position.x = -2.2; k.root.rotation.y = 0.4; scene.add(k.root);
  DOGS.forEach((c, i) => place(makeDog(c), -1.4 + i * 0.7, i % 2 ? 0.3 : 0, 0.7, i === 1));
  CATS.forEach((c, i) => place(makeCat(c), 0.75 + i * 0.5, i % 2 ? 0.3 : 0, 0.7, i === 2));
  cam.position.set(0, 1.1, 5.2); cam.lookAt(-0.2, 0.45, 0);
}
renderer.render(scene, cam);
window.__ready = true;
