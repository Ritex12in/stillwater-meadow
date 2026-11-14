// Emotes: things the boy can do any time, just for fun. Keys 1 to 4 (or the smiling button on a
// touch screen, which plays them in turn): wave, cheer, sit on the ground, dance. Walking off ends
// one. Others can read `emoteState` to answer in kind (the girl waves back and dances along).
import { damp } from '../core/math.js';
import { hooks } from '../core/state.js';
import { timeU } from '../core/materials.js';
import { player, hero } from '../characters/player.js';
import { gesture, poseExtras } from '../characters/kidpose.js';
import { activity } from '../systems/activity.js';
import { registerAction, moving } from '../systems/actions.js';
import { coarsePointer } from '../core/env.js';
import { toast } from '../ui/hud.js';

export const EMOTES = ['wave', 'cheer', 'sit', 'dance'];
const LASTS = { wave: 2.4, cheer: 2.6, sit: Infinity, dance: 9 };
/** What he is doing now: { name, left (seconds), amt (0..1 eased), at (when it began) }. */
export const emoteState = { name: null, shown: null, left: 0, amt: 0, ground: 0, at: -99 };

let toldSit = false; // the hint is given once a visit
/** Start an emote by name or number (0-3). Returns false when he can't just now. */
export function playEmote(which) {
  const name = typeof which === 'number' ? EMOTES[which] : which;
  if (!name || !activity.free || player.petAmt > 0.1) return false;
  if (name === 'sit' && emoteState.name === 'sit') { emoteState.name = null; return true; } // again to get up
  emoteState.name = name; emoteState.left = LASTS[name]; emoteState.at = timeU.value;
  if (name !== 'sit') emoteState.shown = name;
  else if (!toldSit) { toldSit = true; toast(coarsePointer ? 'Sitting on the grass. Tap Get up, or just walk off.' : 'Sitting on the grass. Press 3 again, or just walk off, to get up.', 4.5); }
  return true;
}

export function initEmotes() {
  let turn = 0;
  // touch screens get one button that plays them in turn (keys 1-4 are bound beside the photo filters)
  if (coarsePointer) registerAction({ id: 'emote', key: 'Digit0', keyLabel: '', score: () => -90, available: () => activity.free && !moving() && player.move < 0.3, label: () => 'Wave, cheer, sit or dance', run: () => { playEmote(turn++ % EMOTES.length); } });
  // while he is sitting on the grass, the way up is on screen (like standing up from a bench)
  registerAction({ id: 'emote-up', key: 'KeyE', keyLabel: 'E', score: () => 900, available: () => emoteState.name === 'sit', label: () => 'Get up', run: () => { emoteState.name = null; } });
  hooks.pose.push((dt) => {
    const e = emoteState;
    if (e.name) {
      e.left -= dt;
      if (e.left <= 0 || !activity.free || (moving() && (e.name !== 'wave'))) e.name = null;
    }
    const act = e.name && e.name !== 'sit';
    e.amt = damp(e.amt, act ? 1 : 0, act ? 9 : 6, dt);
    e.ground = damp(e.ground, e.name === 'sit' ? 1 : 0, 6, dt);
    if (e.ground > 0.001) poseExtras(hero, { ground: e.ground });
    gesture(hero, e.shown, e.amt, timeU.value);
    if (e.amt > 0.5) hero.face.flash(e.shown === 'wave' ? 'happy' : 'love', 0.3);
  });
}
