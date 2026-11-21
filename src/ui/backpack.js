// The backpack (I, or the menu): a grid of the slots in systems/pack.js, each with a picture of
// what is in it and how many. Click a thing to see what it is (and, for what can be held, to hold
// it or put it away). Drag one slot onto another to swap them.
import { togglePanel, onPanel } from './hud.js';
import { bindKey } from '../systems/actions.js';
import { packSlots, onPack, kindOf, held, hold, swap, SLOTS } from '../systems/pack.js';

const $ = (id) => document.getElementById(id);
const nameOf = (it) => { const k = kindOf(it.type); return typeof k.name === 'function' ? k.name(it) : k.name; };
const iconOf = (it) => { const k = kindOf(it.type); return typeof k.icon === 'function' ? k.icon(it) : k.icon || ''; };
const detailOf = (it) => { const k = kindOf(it.type); return k.detail ? k.detail(it) : ''; };
/** Extra buttons for the chosen item: [{ label, run }] (features add them, e.g. tying flowers into a bouquet). */
const actionsFor = [];
export const packActions = (fn) => actionsFor.push(fn);

/** For tests: what the grid shows. */
export const backpackView = () => packSlots().map((it) => (it ? { type: it.type, key: it.key, n: it.n, name: nameOf(it), held: !!held() && held().uid === it.uid } : null));

export function initBackpack() {
  const grid = $('packGrid'), sum = $('packSummary'), info = $('packInfo');
  if (!grid) return;
  const cells = Array.from({ length: SLOTS }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot'; b.dataset.slot = String(i); b.draggable = true;
    b.addEventListener('click', () => { chosen = packSlots()[i] ? packSlots()[i].uid : null; render(); });
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); });
    b.addEventListener('dragover', (e) => e.preventDefault());
    b.addEventListener('drop', (e) => { e.preventDefault(); swap(+e.dataTransfer.getData('text/plain'), i); });
    grid.appendChild(b);
    return b;
  });
  let open = false, chosen = null;
  const render = () => {
    if (!open) return;
    const s = packSlots(), h = held();
    let used = 0;
    s.forEach((it, i) => {
      const b = cells[i];
      if (it) used++;
      const key = it ? `${it.uid}:${it.n}:${it.list ? it.list.length : 0}:${h && h.uid === it.uid}:${chosen === it.uid}` : 'empty';
      if (b.dataset.key === key) return;
      b.dataset.key = key;
      b.classList.toggle('full', !!it);
      b.classList.toggle('held', !!(it && h && h.uid === it.uid));
      b.classList.toggle('chosen', !!(it && chosen === it.uid));
      b.title = it ? nameOf(it) : 'Empty';
      b.setAttribute('aria-label', it ? `${nameOf(it)}${it.n > 1 ? ', ' + it.n : ''}` : 'Empty slot');
      b.innerHTML = it ? iconOf(it) + (it.n > 1 ? `<span class="n">${it.n}</span>` : '') : '';
    });
    sum.textContent = `${used} of ${SLOTS}`;
    // what the chosen thing is, and what can be done with it
    const it = chosen ? s.find((q) => q && q.uid === chosen) : null;
    if (!it) { chosen = null; info.replaceChildren(Object.assign(document.createElement('p'), { className: 'note', textContent: used ? 'Choose something to see what it is.' : 'Nothing yet. Flowers you pick, fish you keep and what people give you go in here.' })); return; }
    const title = document.createElement('b'); title.textContent = nameOf(it) + (it.n > 1 ? ` × ${it.n}` : '');
    const text = document.createElement('span'); text.textContent = detailOf(it);
    const row = document.createElement('div'); row.className = 'row';
    const buttons = [];
    if (kindOf(it.type).holdable) buttons.push(h && h.uid === it.uid ? { label: 'Put away', run: () => hold(null) } : { label: 'Hold', run: () => hold(it.uid) });
    for (const fn of actionsFor) buttons.push(...(fn(it) || []));
    for (const a of buttons) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn' + (a.primary ? ' primary' : ''); b.textContent = a.label; b.disabled = !!a.disabled;
      b.addEventListener('click', () => { a.run(); render(); });
      row.appendChild(b);
    }
    info.replaceChildren(title, text, row);
  };
  onPack(() => { for (const c of cells) c.dataset.key = ''; render(); });
  onPanel('backpack', (o) => {
    open = o;
    if (o) { if (document.pointerLockElement) document.exitPointerLock(); for (const c of cells) c.dataset.key = ''; render(); } // (the cursor is freed to use the grid)
  });
  bindKey('KeyI', () => togglePanel('backpack'));
}
