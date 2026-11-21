// The World popover: time of day (live or picked), weather, season, and the places about you, in one place.
import { timeCtl, setManual, goLive, formatHour, onTimeModeChange } from '../systems/time.js';
import { wx, setWeather, goAutoWeather, onWeatherChange } from '../systems/weather.js';
import { worldSeed, worldSeedText, seedOf, randomSeed, goToWorld, worldAddress } from '../systems/save.js';

const $ = (id) => document.getElementById(id);

/**
 * The list of places near you: `list()` gives them nearest first ({ id, name, far, frozen, kit }),
 * `go(id)` takes you to one. Redrawn whenever the popover is opened, and now and then while it is.
 */
export function initPlaces({ list, go }) {
  const box = $('places'), panel = $('worldPanel');
  if (!box || !panel) return;
  const rows = [];
  const draw = () => {
    const places = list();
    places.forEach((p, i) => {
      let b = rows[i];
      if (!b) {
        b = rows[i] = document.createElement('button');
        b.type = 'button';
        b.addEventListener('click', () => { go(b.dataset.place); draw(); });
        box.appendChild(b);
      }
      const built = p.kit ? [p.kit.dock && 'jetty', p.kit.fire && 'fire', p.kit.bench && 'bench'].filter(Boolean).join(', ') : '';
      const text = `${p.name} · ${p.far < 10 ? 'here' : p.far < 1000 ? p.far + ' m' : (p.far / 1000).toFixed(1) + ' km'}${p.frozen ? ' · frozen' : ''}${built ? ' · ' + built : ''}`;
      if (b.textContent !== text) b.textContent = text;
      b.dataset.place = p.id;
      b.title = 'Go to ' + p.name;
      b.hidden = false;
    });
    for (let i = places.length; i < rows.length; i++) rows[i].hidden = true;
  };
  new MutationObserver(() => { if (!panel.hidden) draw(); }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  setInterval(() => { if (!panel.hidden) draw(); }, 4000);
}

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

export function initWorldPanel() {
  initSeed();
  const slider = $('timeSlider'), out = $('timeOut'), live = $('liveBtn');
  slider.addEventListener('input', () => setManual(+slider.value / 60));
  live.addEventListener('click', goLive);
  const syncTime = () => {
    live.setAttribute('aria-pressed', String(timeCtl.live));
    slider.value = String(Math.round(timeCtl.target * 60) % 1440);
    out.textContent = formatHour(timeCtl.target);
  };
  onTimeModeChange(syncTime);
  syncTime();
  setInterval(() => { if (timeCtl.live) syncTime(); }, 15000);

  const wxButtons = Array.from(document.querySelectorAll('#weather button'));
  const syncWeather = () => wxButtons.forEach((b) => {
    const v = b.dataset.wx;
    b.setAttribute('aria-pressed', String(v === 'auto' ? wx.auto : !wx.auto && wx.type === v));
    b.classList.toggle('current', wx.auto && v === wx.type);
  });
  wxButtons.forEach((b) => b.addEventListener('click', () => { if (b.dataset.wx === 'auto') goAutoWeather(); else setWeather(b.dataset.wx, true); }));
  onWeatherChange(syncWeather);
  syncWeather();
}
