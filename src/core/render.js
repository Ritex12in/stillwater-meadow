// Renderer, scene and camera. Created once at import; everything else adds to `scene`.
import * as THREE from 'three';

export const canvas = document.getElementById('world');

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // the quality system decides when shadows refresh
  return renderer;
}

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe5f2, 50, 220);
export const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.layers.enable(1); // layer 1: small plants (kept apart so a second view of the scene can leave them out)
