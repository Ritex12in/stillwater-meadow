import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const q = new URLSearchParams(location.search), file = q.get('m'), view = q.get('view') || 'body';
const W = 600, H = 800;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.outputEncoding = THREE.sRGBEncoding; document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#dfe7ea');
scene.add(new THREE.HemisphereLight('#ffffff', '#8899aa', 0.9));
const sun = new THREE.DirectionalLight('#ffffff', 0.9); sun.position.set(1, 2, 3); scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);
new GLTFLoader().load('/assets/characters/vroid/' + file, (g) => {
  const m = g.scene; scene.add(m);
  m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((x) => { if (x.map) x.map.encoding = THREE.sRGBEncoding; }); if (q.get('plain')) o.material = ms.map((x) => new THREE.MeshStandardMaterial({ map: x.map || null, color: x.map ? '#ffffff' : (x.color || '#ffffff'), side: THREE.DoubleSide, alphaTest: 0.4, transparent: false, roughness: 0.8 })).length === 1 ? new THREE.MeshStandardMaterial({ map: ms[0].map || null, side: THREE.DoubleSide, alphaTest: 0.4, roughness: 0.8 }) : ms.map((x) => new THREE.MeshStandardMaterial({ map: x.map || null, side: THREE.DoubleSide, alphaTest: 0.4, roughness: 0.8 })); } });
  window.meshes = []; m.traverse((o) => { if (o.isMesh) window.meshes.push([o.name, o.visible, o.geometry.attributes.position.count]); });
  // VRM 0.x faces -z, 1.0 faces +z: face the camera either way
  const isV0 = !!(g.parser.json.extensions && g.parser.json.extensions.VRM);
  if (isV0) m.rotation.y = Math.PI;
  const box = new THREE.Box3().setFromObject(m), h = box.max.y - box.min.y;
  if (view === 'face') { const y = box.max.y - h * 0.09; cam.position.set(0, y, 0.75); cam.lookAt(0, y, 0); }
  else { const y = box.min.y + h * 0.5; cam.position.set(0.9, y + 0.1, 4.1); cam.lookAt(0, y, 0); }
  r.render(scene, cam);
  window.done = { h: +h.toFixed(2), v: isV0 ? '0.x' : '1.0' };
}, undefined, (e) => { window.done = { err: String(e) }; });
