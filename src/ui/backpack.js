// The backpack: everything you carry, in one place (I, or the menu). Each feature that gives you
// something to carry says so with `carry()` and how to describe it; the backpack only shows what
// they report, so new things (lanterns, a tent) are added where they are made.
import { togglePanel, onPanel } from './hud.js';
import { bindKey } from '../systems/actions.js';

const $ = (id) => document.getElementById(id);
const things = [];
/**
 * Something you may be carrying. `view()` says what it is just now: `{ name, detail, color }`, or
 * null when you have none of it. `order` puts it in its place in the list (lower first).
 */
export function carry(id, view, order = 50) {
  const at = things.findIndex((t) => t.id === id);
  if (at >= 0) things.splice(at, 1);
  things.push({ id, view, order });
  things.sort((a, b) => a.order - b.order);
}
/** For tests: what the backpack holds just now. */
export const backpackView = () => things.map((t) => ({ id: t.id, ...(t.view() || {}) })).filter((t) => t.name);

export function initBackpack() {
  const list = $('packList'), sum = $('packSummary');
  if (!list) return;
  const render = () => {
    const held = backpackView();
    sum.textContent = held.length ? `${held.length} ${held.length === 1 ? 'thing' : 'things'}` : '';
    if (!held.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nothing yet. Flowers you pick, fish you keep and what people give you go in here.';
      list.replaceChildren(li);
      return;
    }
    list.replaceChildren(...held.map((t) => {
      const li = document.createElement('li');
      li.className = 'got';
      li.dataset.thing = t.id;
      const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = t.color || 'transparent';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = t.name;
      const st = document.createElement('span'); st.className = 'st'; st.textContent = t.detail || '';
      li.append(sw, nm, st);
      return li;
    }));
  };
  let open = false;
  onPanel('backpack', (o) => { open = o; if (o) render(); });
  setInterval(() => { if (open) render(); }, 1000); // (what you carry can change while it is open)
  bindKey('KeyI', () => togglePanel('backpack'));
}
