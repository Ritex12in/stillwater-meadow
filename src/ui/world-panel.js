// The World popover: how it is where you stand (the time of the year, the belt, the weather), and this world's
// seed. (Its pickers for the time, the weather and the season, and its lists that took you anywhere, were
// debugging tools: they are commands now, ui/console.js and features/commands.js.)
import { wx } from '../systems/weather.js';
import { seasonState } from '../core/state.js';
import { phaseName } from '../core/year.js';
import { worldSeed, worldSeedText, seedOf, randomSeed, goToWorld, worldAddress } from '../systems/save.js';

const $ = (id) => document.getElementById(id);

/** This world's seed, a link to share it, and the way to another (by any seed you type, or a new one at random). */
function initSeed() {
  const no = $('seedNo'), note = $('seedNote'), form = $('seedForm'), input = $('seedInput');
  if (!no) return;
  no.textContent = worldSeedText;
  const say = (t) => { note.textContent = t; note.hidden = !t; };
  $('seedCopy').addEventListener('click', async () => {
    const link = location.origin + worldAddress(worldSeedText).replace(/#.*$/, '');
    try { await navigator.clipboard.writeText(link); say('Link copied: ' + link); } catch (e) { say(link); }
  });
  $('seedNew').addEventListener('click', () => { let s; do { s = randomSeed(); } while (s === worldSeed); goToWorld(String(s)); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = seedOf(input.value);
    if (!s) { say('Type a seed: any word, phrase or number.'); return; }
    if (s.seed === worldSeed) { say('You are in that world.'); return; }
    goToWorld(s.text);
  });
}

/** What it is like where you stand: the time of the year, and the season and weather here. */
export function hereText() {
  const st = seasonState, p = typeof st.phaseHere === 'number' ? st.phaseHere : 0.5; // (the year where you stand: by latitude)
  const into = ((((p + 0.125) % 1) + 1) % 1) * 4 % 1, part = into < 0.34 ? 'Early' : into < 0.67 ? 'Mid' : 'Late';
  const tropic = st.beltHere === 'tropical', polar = st.beltHere === 'polar', local = phaseName(p);
  const bits = [polar ? 'Polar ice' : tropic ? st.nameHere : `${part} ${local.toLowerCase()}`, `${st.beltHere} belt`];
  const sky = { rain: 'rain', storm: 'a thunderstorm', fog: 'fog', snow: 'snowing' }[wx.type];
  if (sky) bits.push(sky);
  if (st.winterHere && local !== 'Winter' && !polar) bits.push('snow lies here');
  else if (!st.winterHere && local === 'Winter' && !tropic) bits.push('mild here');
  else if (st.leavesHere === 'autumn' && local !== 'Autumn') bits.push('the leaves have turned here');
  return 'Here: ' + bits.join(' · ');
}

export function initWorldPanel() {
  initSeed();
  const here = $('hereNow'), panel = $('worldPanel');
  if (here) { const say = () => { if (!panel.hidden) here.textContent = hereText(); }; setInterval(say, 2000); new MutationObserver(say).observe(panel, { attributes: true, attributeFilter: ['hidden'] }); }
}
