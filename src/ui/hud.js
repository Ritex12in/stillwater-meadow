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
// One picture per kind of action, for the touch pad (24 x 24, drawn in the button's colour).
const ICON = {
  sit: '<path d="M7 4v9h9M7 13v7M16 13v7M5 13h13"/>',
  boat: '<path d="M3 15h18l-3 5H6zM12 4v9M12 5l6 6h-6"/>',
  fire: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3-3z"/>',
  paw: '<circle cx="7" cy="9" r="1.9"/><circle cx="12" cy="7" r="1.9"/><circle cx="17" cy="9" r="1.9"/><path d="M12 12c3 0 5 2.6 5 4.8 0 1.7-1.6 2.4-2.8 2-0.9-0.3-1.4-0.6-2.2-0.6s-1.3 0.3-2.2 0.6c-1.2 0.4-2.8-0.3-2.8-2C7 14.6 9 12 12 12z"/>',
  fish: '<path d="M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2z"/><circle cx="8" cy="11" r="0.8"/>',
  rod: '<path d="M4 20L18 4M18 4c2 3 2 7 0 10M18 14v3a2 2 0 0 1-4 0"/>',
  bread: '<path d="M4 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4c0 1.3-0.8 2-2 2.4V19H6v-5.6C4.800 13 4 12.300 4 11z"/><path d="M9 11v2M12 10v3M15 11v2"/>',
  flower: '<circle cx="12" cy="9" r="2"/><path d="M12 3v4M12 11v10M7.800 6.500l2.700 1.700M16.200 6.500l-2.700 1.700M8 12.500l2.500-2M16 12.500l-2.500-2M12 17c-2-2-4-2-5-1M12 15c2-2 4-2 5-1"/>',
  cone: '<path d="M12 3l5 8H7zM12 9l6 9H6zM12 18v3"/>',
  star: '<path d="M12 3l2.600 5.600 6.100 0.700-4.500 4.200 1.200 6-5.400-3-5.400 3 1.200-6L3.300 9.300l6.100-0.700z"/>',
  stick: '<path d="M4 19L19 5M14 6l4 1M8 12l1 4"/>',
  talk: '<path d="M4 6h16v10H10l-5 4v-4H4z"/><path d="M8 10h8M8 13h5"/>',
  pair: '<circle cx="8" cy="6" r="2.300"/><circle cx="16" cy="6" r="2.300"/><path d="M5 20v-7a3 3 0 0 1 6 0M13 13a3 3 0 0 1 6 0v7M11 14h2"/>',
  smile: '<circle cx="12" cy="12" r="8.500"/><path d="M8.500 14c1 1.600 2.200 2.300 3.500 2.300s2.500-0.700 3.500-2.300M9 9.500v0.500M15 9.500v0.500"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',
  hand: '<path d="M8 12V6a1.500 1.500 0 0 1 3 0v5V4.500a1.500 1.500 0 0 1 3 0V11V6a1.500 1.500 0 0 1 3 0v8c0 4-2.500 7-6 7s-5-2-6.500-5L3 13a1.500 1.500 0 0 1 2.600-1.500L8 14"/>',
};
const iconFor = (id) => ICON[
  id === 'fetch' ? 'stick' : id === 'friend-talk' ? 'talk' : id === 'friend-walk' ? 'pair' : id === 'emote' ? 'smile' : /^dance/.test(id) ? 'note' : /^(sit|stand|emote-up)$/.test(id) ? 'sit' : /board|step-off/.test(id) ? 'boat' : /campfire/.test(id) ? 'fire' : /^pet/.test(id) ? 'paw' : /^feed/.test(id) ? 'fish'
    : /^fish/.test(id) ? 'rod' : /bread/.test(id) ? 'bread' : /cone/.test(id) ? 'cone' : /pick|give|bench/.test(id) ? 'flower' : /lie|get-up/.test(id) ? 'star' : 'hand'];
/** Touch screens: every action as a round icon button down the right edge, the best one biggest and lowest. */
function renderPad(list) {
  const pad = $('pad');
  pad.hidden = list.length === 0;
  pad.replaceChildren(...list.map((a, i) => {
    const b = document.createElement('button'), off = !!(a.disabled && a.disabled());
    b.type = 'button';
    b.className = 'pad-btn glass' + (i === 0 ? ' first' : '') + (a.urgent && a.urgent() ? ' urgent' : '');
    if (off) { b.classList.add('off'); b.setAttribute('aria-disabled', 'true'); }
    b.title = a.label(); b.setAttribute('aria-label', a.label());
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round">${iconFor(a.id)}</svg>`;
    // an icon alone can't say why something isn't possible yet: tapping a greyed one tells you
    b.addEventListener('click', () => { if (off) toast(a.label(), 3); else runAction(a); b.blur(); });
    return b;
  }));
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Show the best action prominently; the rest sit behind a "more" chip. */
export function renderPrompts(list) {
  const key = list.map((a) => a.id + '|' + a.label() + '|' + (a.urgent && a.urgent() ? 1 : 0) + '|' + (a.disabled && a.disabled() ? 1 : 0)).join('§') + '|' + moreOpen;
  if (key === lastKey) return;
  lastKey = key;
  shown = list;
  if (coarsePointer) { renderPad(list); return; }
  list = list.filter((x) => !(x.quiet && x.quiet())); // (a key everyone knows, Space to jump, is not prompted for; on a touch screen it is a button)
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
  document.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', (e) => { togglePanel(b.dataset.panel); if (e.detail > 0) b.blur(); })); // (clicked with the mouse, it lets go of the keyboard: Space is to jump, not to press it again)
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
