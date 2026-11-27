// Dev tool: the downloaded pines beside the pines grown from code (src/world/procpines.js), under
// the same light and the same green, five of each. Open /tools/studio/pines.html
//   ?kind=Pine (the kit's Pine_1..5 against the code's Pine) | ?kind=SlimPine (the kit's PineTree_1..5 against SlimPine)
//   ?close=1  one of each, near
import * as THREE from 'three';
import { loadKit, fit } from '/src/core/assets.js';
import { procPines } from '/src/world/procpines.js';
const q = new URLSearchParams(location.search), kind = q.get('kind') || 'Pine', close = q.has('close'), tint = q.get('leaf') || '#41703f';
const kit = await loadKit(), gen = procPines();
const K = kind === 'Pine' ? { model: 'Pine_', leaves: 'leaves_pine', bark: 'bark', h: 6.4 } : { model: 'PineTree_', leaves: 'slimpine_leaves', bark: 'slimpine_bark', h: 7.6 };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#a9c3d6');
scene.add(new THREE.HemisphereLight('#d6e6f5', '#5d6b3a', 0.8));
const sun = new THREE.DirectionalLight('#fff1d6', 0.95); sun.position.set(-18, 30, 22); sun.castShadow = true; Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 }); sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: '#6d8a45' })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const tris = { kit: 0, code: 0 };
const put = (parts, x, z, leafTex, barkTex, label) => {
  for (const [name, g] of Object.entries(parts)) {
    const leaf = /lea|needle/i.test(name);
    tris[label] += (g.index ? g.index.count : g.attributes.position.count) / 3;
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: leaf ? leafTex : barkTex, vertexColors: true, color: leaf ? tint : '#ffffff', alphaTest: leaf ? 0.45 : 0, side: leaf ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  }
};
const copy = (parts) => Object.fromEntries(Object.entries(parts).map(([k, g]) => [k, g.clone()]));
const list = close ? [2] : [1, 2, 3, 4, 5], gap = close ? 0 : 6.2;
list.forEach((i, n) => {
  const x = (n - (list.length - 1) / 2) * gap;
  put(fit(copy(kit.models[K.model + i]), K.h, 0.15), close ? -3.2 : x, close ? 0 : -5.5, kit.tex[K.leaves], kit.tex[K.bark], 'kit');
  put(fit(copy(gen.models[kind + '_' + i]), K.h, 0.15), close ? 3.2 : x, close ? 0 : 5.5, gen.tex.codepine_leaves, gen.tex.codepine_bark, 'code');
});
const cam = new THREE.PerspectiveCamera(close ? 30 : 38, innerWidth / innerHeight, 0.1, 400);
if (close) { cam.position.set(0, 4.2, 19); cam.lookAt(0, 3.6, 0); } else { cam.position.set(0, 13, 33); cam.lookAt(0, 3.2, 0); }
renderer.render(scene, cam);
window.__info = { kind, kitTriangles: Math.round(tris.kit / list.length), codeTriangles: Math.round(tris.code / list.length) };
window.__ready = true;
