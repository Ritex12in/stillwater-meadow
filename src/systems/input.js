// Keyboard movement, mouse look (pointer lock or drag), touch joystick and zoom.
import { clamp } from '../core/math.js';
import { canvas } from '../core/render.js';
import { coarsePointer } from '../core/env.js';

const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' };

/** Held movement keys ('f', 'b', 'l', 'r', 'run') plus the touch joystick. */
export const keys = new Set();
export const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
keys.joyMag = () => Math.hypot(joy.x, joy.y);

export const camState = { yaw: 0, pitch: 0.32, dist: 6.2, minDist: 2.8, maxDist: 16, sensitivity: 1 }; // (framed for a child-sized figure)

const typing = (e) => e.target && ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA');
window.addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); if (e.code.startsWith('Arrow')) e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
window.addEventListener('blur', () => keys.clear());

const listeners = new Set();
/** Called on any input, so the interface can wake up from auto-hide. */
export const onActivity = (fn) => listeners.add(fn);
const poke = () => listeners.forEach((fn) => fn());
['keydown', 'pointerdown', 'pointermove', 'wheel'].forEach((ev) => window.addEventListener(ev, poke, { passive: true }));

export function initPointer() {
  const joyEl = document.getElementById('joy'), knobEl = document.getElementById('knob');
  const lockTip = document.getElementById('lockTip');
  const look = { id: null, lx: 0, ly: 0 };
  const pinch = { id: null, x: 0, y: 0, span: 0, dist: 0 }; // a second finger on the view: zoom
  let canLock = !coarsePointer && typeof canvas.requestPointerLock === 'function';
  let locked = false;
  const syncLockUi = () => {
    lockTip.hidden = locked || !canLock;
    canvas.classList.toggle('locked', locked);
    canvas.classList.toggle('drag-mode', !canLock);
  };
  const requestLock = () => {
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (err) { /* refused; the next click tries again */ }
  };
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) keys.clear();
    syncLockUi();
  });
  document.addEventListener('pointerlockerror', () => { if (!locked) { canLock = false; syncLockUi(); } });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    camState.yaw -= e.movementX * 0.0024 * camState.sensitivity;
    camState.pitch = clamp(camState.pitch + e.movementY * 0.002 * camState.sensitivity, -0.2, 1.25);
  });
  syncLockUi();

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && canLock) { if (!locked) requestLock(); return; }
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45 && joy.id === null) {
      joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joy.x = joy.y = 0;
      joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
      knobEl.style.transform = 'translate(0px, 0px)';
      joyEl.hidden = false;
    } else if (look.id === null) {
      look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY;
      canvas.classList.add('dragging');
    } else if (e.pointerType === 'touch' && pinch.id === null) {
      pinch.id = e.pointerId; pinch.x = e.clientX; pinch.y = e.clientY;
      pinch.span = Math.max(20, Math.hypot(e.clientX - look.lx, e.clientY - look.ly)); pinch.dist = camState.dist;
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
      const len = Math.hypot(dx, dy), max = 46;
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      joy.x = dx / max; joy.y = -dy / max;
    } else if (pinch.id !== null && (e.pointerId === pinch.id || e.pointerId === look.id)) {
      // two fingers: spread them to come closer, pinch to pull back (and the view doesn't turn meanwhile)
      if (e.pointerId === pinch.id) { pinch.x = e.clientX; pinch.y = e.clientY; } else { look.lx = e.clientX; look.ly = e.clientY; }
      camState.dist = clamp(pinch.dist * pinch.span / Math.max(20, Math.hypot(pinch.x - look.lx, pinch.y - look.ly)), camState.minDist, camState.maxDist);
    } else if (e.pointerId === look.id) {
      const sens = (e.pointerType === 'touch' ? 0.007 : 0.005) * camState.sensitivity;
      camState.yaw -= (e.clientX - look.lx) * sens;
      camState.pitch = clamp(camState.pitch + (e.clientY - look.ly) * sens * 0.8, -0.2, 1.25);
      look.lx = e.clientX; look.ly = e.clientY;
    }
  });
  const endPointer = (e) => {
    if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; joyEl.hidden = true; }
    if (e.pointerId === look.id) { look.id = null; pinch.id = null; canvas.classList.remove('dragging'); }
    if (e.pointerId === pinch.id) pinch.id = null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  // touch screens also get a small + / − control
  const zoomEl = document.getElementById('zoom');
  if (zoomEl && coarsePointer) {
    zoomEl.hidden = false;
    const by = (k) => () => { camState.dist = clamp(camState.dist * k, camState.minDist, camState.maxDist); };
    document.getElementById('zoomIn').addEventListener('click', by(0.8));
    document.getElementById('zoomOut').addEventListener('click', by(1.25));
  }
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camState.dist = clamp(camState.dist * (1 + e.deltaY * 0.001), camState.minDist, camState.maxDist);
  }, { passive: false });
}

/** Movement input in camera space: { ix, iz, mag, running }. */
export function moveInput() {
  let ix = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + joy.x;
  let iz = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0) + joy.y;
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const mag = Math.min(1, len);
  return { ix, iz, mag, running: keys.has('run') || (joy.id !== null && mag > 0.92) };
}

/** Direction the camera faces on the ground. */
export const camForward = () => ({ x: -Math.sin(camState.yaw), z: -Math.cos(camState.yaw) });
