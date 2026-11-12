// The World popover: time of day (live or picked), weather, and season, in one place.
import { timeCtl, setManual, goLive, formatHour, onTimeModeChange } from '../systems/time.js';
import { wx, setWeather, goAutoWeather, onWeatherChange } from '../systems/weather.js';

const $ = (id) => document.getElementById(id);

export function initWorldPanel() {
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
