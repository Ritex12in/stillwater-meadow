// The on-screen interface: toasts, action prompts, the clock label, panels and menus, and the
// quiet mode that fades the interface away while you just look around.
import { coarsePointer } from '../core/env.js';
import { runAction } from '../systems/actions.js';
import { onActivity } from '../systems/input.js';

const $ = (id) => document.getElementById(id);

// ── Toasts ─────────────────────────────────────────────────────
let toastEl = null, toastT = 0;
export function toast(msg, secs = 3.2) {
  toastEl = toastEl || $('toast');
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastT = secs;
}

// ── Non-fatal problems: report once, keep the meadow running ──
const reported = new Set();
export function reportProblem(where, err) {
  console.error(`[meadow] ${where}:`, err);
  if (reported.has(where)) return;
  reported.add(where);
  toast(`Part of the meadow stopped working (${where}). Everything else carries on.`, 6);
}

/** Fatal problems (no WebGL): a dismissible notice. */
export function showFatal(msg) {
  const box = $('error');
  box.querySelector('p').textContent = msg;
  box.hidden = false;
}

// ── Prompts ────────────────────────────────────────────────────
let primaryEl, moreEl, extraEl, lastKey = '', moreOpen = false, shown = [];
function chip(a) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'action' + (a.urgent && a.urgent() ? ' urgent' : '');
  b.disabled = !!(a.disabled && a.disabled());
  b.innerHTML = (coarsePointer || b.disabled ? '' : `<kbd>${a.keyLabel}</kbd> `) + escapeHtml(a.label());
  b.addEventListener('click', () => runAction(a));
  return b;
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Show the best action prominently; the rest sit behind a "more" chip. */
export function renderPrompts(list) {
  const key = list.map((a) => a.id + '|' + a.label() + '|' + (a.urgent && a.urgent() ? 1 : 0) + '|' + (a.disabled && a.disabled() ? 1 : 0)).join('§') + '|' + moreOpen;
  if (key === lastKey) return;
  lastKey = key;
  shown = list;
  primaryEl = primaryEl || $('promptPrimary');
  moreEl = moreEl || $('promptMore');
  extraEl = extraEl || $('promptExtra');
  primaryEl.replaceChildren(...(list[0] ? [chip(list[0])] : []));
  const rest = list.slice(1);
  moreEl.hidden = rest.length === 0;
  moreEl.textContent = moreOpen ? 'Less' : `+${rest.length} more`;
  moreEl.setAttribute('aria-expanded', String(moreOpen));
  extraEl.replaceChildren(...(moreOpen ? rest.map(chip) : []));
  if (!rest.length && moreOpen) moreOpen = false;
}

// ── Panels and popovers ────────────────────────────────────────
const panels = new Map();
export function togglePanel(id, force) {
  const el = $(id);
  const open = typeof force === 'boolean' ? force : el.hidden;
  if (open) panels.forEach((_, other) => { if (other !== id && $(other).dataset.exclusive) $(other).hidden = true; });
  el.hidden = !open;
  panels.get(id)?.(open);
  syncMenuButtons();
  wake();
  return open;
}
export const onPanel = (id, fn) => { const prev = panels.get(id); panels.set(id, prev ? (open) => { prev(open); fn(open); } : fn); };
function syncMenuButtons() {
  document.querySelectorAll('[data-panel]').forEach((b) => b.setAttribute('aria-expanded', String(!$(b.dataset.panel).hidden)));
}
export const anyPanelOpen = () => [...panels.keys()].some((id) => !$(id).hidden);

// ── Quiet mode: fade the interface after a few idle seconds ────
let idle = 0;
const wake = () => { idle = 0; document.body.classList.remove('quiet'); };

export function initHud() {
  $('promptMore').addEventListener('click', () => { moreOpen = !moreOpen; lastKey = ''; renderPrompts(shown); });
  document.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => togglePanel(b.dataset.panel)));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => togglePanel(b.dataset.close, false)));
  $('errorClose').addEventListener('click', () => { $('error').hidden = true; });
  ['controls', 'journal', 'worldPanel', 'settingsPanel', 'menuPanel'].forEach((id) => { if (!panels.has(id)) panels.set(id, () => {}); });
  onActivity(wake);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') panels.forEach((_, id) => { if (!$(id).hidden && id !== 'nameDialog') togglePanel(id, false); });
  });
  const hint = $('hint');
  hint.innerHTML = coarsePointer
    ? '<b>Drag the left side</b> to walk · <b>drag the right side</b> to look · open <b>☰</b> for everything else'
    : '<b>W A S D</b> to walk · <b>move the mouse</b> to look · <b>E</b> sit or use · <b>F</b> pet · <b>H</b> shows every control';
  setTimeout(() => hint.classList.add('gone'), 16000);
}

export function updateHud(dt) {
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show'); }
  idle += dt;
  if (idle > 7 && !anyPanelOpen()) document.body.classList.add('quiet');
}

let clockEl = null, lastClock = '';
export function setClockLabel(text) {
  if (text === lastClock) return;
  lastClock = text;
  clockEl = clockEl || $('clock');
  clockEl.textContent = text;
}
