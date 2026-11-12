// Settings: sound and music, volumes per kind of sound, mouse sensitivity, graphics quality,
// a frame-rate readout, and forgetting the saved meadow.
import { audio, setSoundEnabled, setVolume, onSoundChange } from '../systems/audio.js';
import { camState } from '../systems/input.js';
import { quality, setQuality, LEVELS } from '../systems/quality.js';
import { store, saveSoon, onSave, resetSave } from '../systems/save.js';

const $ = (id) => document.getElementById(id);

export function initSettings() {
  const s = store.settings;
  Object.entries(s.volumes || {}).forEach(([k, v]) => setVolume(k, v));
  camState.sensitivity = s.sensitivity || 1;

  // Sound button: the first press creates the audio context
  const soundBtn = $('sound'), soundLabel = $('soundLabel');
  const syncSound = (on) => { soundBtn.setAttribute('aria-pressed', String(on)); soundLabel.textContent = on ? 'Sound on' : 'Sound off'; };
  soundBtn.addEventListener('click', () => {
    if (!setSoundEnabled(!audio.enabled)) soundLabel.textContent = 'No audio';
  });
  onSoundChange((on) => { syncSound(on); store.sound = on; saveSoon(); });

  // Sound was on last time: switch it back on with the first click or key press anywhere.
  // A click on the Sound or Music button itself is left to that button, so it isn't toggled twice.
  if (store.sound) {
    const resume = (e) => {
      if (e.target && e.target.closest && e.target.closest('#sound, #musicBtn')) return;
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      if (!audio.enabled) setSoundEnabled(true);
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }

  document.querySelectorAll('input[data-volume]').forEach((input) => {
    const name = input.dataset.volume;
    input.value = String(Math.round(audio.volumes[name] * 100));
    input.addEventListener('input', () => { setVolume(name, +input.value / 100); saveSoon(); });
  });
  onSave((st) => { st.settings.volumes = Object.assign({}, audio.volumes); });

  const sens = $('sensitivity');
  sens.value = String(camState.sensitivity);
  sens.addEventListener('input', () => { camState.sensitivity = +sens.value; s.sensitivity = camState.sensitivity; saveSoon(); });

  const qual = $('quality');
  qual.value = s.quality || 'auto';
  qual.addEventListener('change', () => { setQuality(qual.value); s.quality = qual.value; saveSoon(); });
  const qualNow = $('qualityNow');
  setInterval(() => { qualNow.textContent = `${LEVELS[quality.level].label} · ${quality.fps} fps`; }, 1000);

  const confirmBox = $('resetConfirm');
  $('resetBtn').addEventListener('click', () => { confirmBox.hidden = false; });
  $('resetNo').addEventListener('click', () => { confirmBox.hidden = true; });
  $('resetYes').addEventListener('click', resetSave);
}
