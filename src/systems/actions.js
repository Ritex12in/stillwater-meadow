// One place for everything you can do with a key or a tap.
//
// Contextual actions (sit, pet, fish…) register here with a key, a label and an `available()`
// test. Each frame the best available action per key is chosen by `score()`, those choices become
// the on-screen prompts, and pressing the key runs the chosen one. Hotkeys that always do the
// same thing (H, J, P…) register with `bindKey`.
import { keys } from './input.js';

const actions = [];
const hotkeys = new Map();
let blocked = () => false;     // set by modal UI (dialogs, photo mode)

/**
 * @param {{ id: string, key: string, keyLabel: string, label: () => string, available: () => any,
 *           score?: () => number, run: () => void, urgent?: () => boolean, disabled?: () => boolean,
 *           modal?: boolean }} a
 */
export function registerAction(a) { actions.push(Object.assign({ score: () => 0 }, a)); }

/** Fixed hotkey. `opts.modal` lets it work while a modal (photo mode) is open. */
export function bindKey(code, fn, opts = {}) { hotkeys.set(code, { fn, modal: !!opts.modal }); }

export function setActionBlocker(fn) { blocked = fn; }

let chosen = [];
/** Recompute the best action per key. Returns them ordered for display (most relevant first). */
export function evaluateActions() {
  const best = new Map();
  for (const a of actions) {
    if (blocked() && !a.modal) continue;
    let ok;
    try { ok = a.available(); } catch (e) { ok = false; }
    if (!ok) continue;
    const s = a.score();
    const cur = best.get(a.key);
    if (!cur || s > cur.s) best.set(a.key, { a, s });
  }
  chosen = [...best.values()].sort((p, q) => (q.a.urgent && q.a.urgent() ? 1e6 : 0) + q.s - ((p.a.urgent && p.a.urgent() ? 1e6 : 0) + p.s)).map((x) => x.a);
  return chosen;
}

export function runAction(a) {
  if (!a || (a.disabled && a.disabled())) return;
  a.run();
}

const typing = (e) => e.target && ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA');
window.addEventListener('keydown', (e) => {
  if (e.repeat || typing(e)) return;
  // Enter and Space on a focused button already click it; don't run a second action as well.
  if ((e.code === 'Enter' || e.code === 'Space') && document.activeElement && document.activeElement.tagName === 'BUTTON') return;
  const hk = hotkeys.get(e.code);
  // a hotkey can return false to let the key fall through to contextual actions
  if (hk && (!blocked() || hk.modal) && hk.fn(e) !== false) { e.preventDefault(); return; }
  if (blocked()) return;
  const a = chosen.find((x) => x.key === e.code);
  if (a) { e.preventDefault(); runAction(a); }
});

/** True while the player is pressing movement keys or the joystick. */
export const moving = () => keys.has('f') || keys.has('b') || keys.has('l') || keys.has('r') || keys.joyMag() > 0.2;
