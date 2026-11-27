// The command line: debugging by typed commands (the owner: the World panel's pickers for time,
// weather and season, and its lists that took you anywhere, were never player features). The `/` key
// opens it; Enter runs what you typed, Up and Down bring back what you ran before, Escape closes it.
// It is not prompted for or listed in the controls: it is a tool, not part of play. The commands
// themselves are in features/commands.js; `help` lists them.
import { bindKey } from '../systems/actions.js';

const commands = new Map();
/** Add a command: `run(args, raw)` gets the words after its name and returns what to say (a string, or lines). */
export function registerCommand(name, help, run) { commands.set(name, { name, help, run }); }
/** The commands there are: [{ name, help }]. */
export const commandList = () => [...commands.values()].map((c) => ({ name: c.name, help: c.help }));

/** Run a line as typed (the leading `/` may be left off). Returns what it said. */
export function runCommand(line) {
  const text = String(line || '').trim().replace(/^\//, '').trim();
  if (!text) return '';
  const words = text.split(/\s+/), c = commands.get(words[0].toLowerCase());
  if (!c) return `No such command: ${words[0]}. Type help.`;
  try { const out = c.run(words.slice(1), text.slice(words[0].length).trim()); return Array.isArray(out) ? out.join('\n') : String(out === undefined ? 'Done.' : out); } catch (e) { return 'Failed: ' + (e && e.message ? e.message : e); }
}

const $ = (id) => document.getElementById(id);
let open = false;
const history = [];
/** Is the command line open? */
export const consoleOpen = () => open;

export function initConsole() {
  const box = $('cmd'), input = $('cmdInput'), out = $('cmdOut'), form = $('cmdForm');
  if (!box) return;
  let at = 0;
  const say = (text, mine) => {
    for (const line of String(text).split('\n')) { const p = document.createElement('p'); p.textContent = line; if (mine) p.className = 'mine'; out.appendChild(p); }
    while (out.children.length > 60) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
  };
  const show = (on) => {
    open = on; box.hidden = !on;
    if (on) { if (document.pointerLockElement) document.exitPointerLock(); input.value = ''; at = history.length; setTimeout(() => input.focus(), 0); } else input.blur();
  };
  bindKey('Slash', () => { show(true); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const line = input.value.trim();
    if (!line) { show(false); return; }
    history.push(line); at = history.length;
    say('/' + line.replace(/^\//, ''), true);
    const res = runCommand(line);
    if (res) say(res);
    input.value = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); show(false); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (at > 0) input.value = history[--at]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); input.value = at < history.length - 1 ? history[++at] : ((at = history.length), ''); }
  });
}
