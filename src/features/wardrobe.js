// Winter clothes: while it is winter both children wear their winter costumes (his navy jacket and boots;
// her red coat, white knitted hat, skirt and scarf). The winter children are built the first time
// winter comes, one a frame so the game doesn't stall, then swapped in; anything held or worn
// (a rod, a bouquet, the flower in her hair) moves across. Spring brings the summer clothes back.
import { hooks, seasonState } from '../core/state.js';
import { activity } from '../systems/activity.js';
import { makeKid, KIDS } from '../characters/kid.js';
import { hero, setHeroRig } from '../characters/player.js';
import { friend, setFriendRig } from './friend.js';

const rigs = { boy: { summer: null, winter: null }, girl: { summer: null, winter: null } };
let wearing = 'summer';

/** Which clothes they have on now ('summer' or 'winter'). */
export const wardrobeNow = () => wearing;

function wear(set) {
  setHeroRig(rigs.boy[set]);
  if (friend) setFriendRig(rigs.girl[set]);
  wearing = set;
}
/** Build what is still missing for the winter set; with `all` everything at once, else one child. */
function build(all) {
  if (!rigs.girl.winter) { rigs.girl.winter = makeKid(KIDS.girlWinter); if (!all) return; }
  if (!rigs.boy.winter) rigs.boy.winter = makeKid(KIDS.boyWinter);
}
const ready = () => rigs.boy.winter && rigs.girl.winter;

export function initWardrobe() {
  rigs.boy.summer = hero;
  rigs.girl.summer = friend && friend.k;
  // already winter as the meadow opens: dress for it straight away (behind the loading screen)
  if (seasonState.winterHere) { build(true); wear('winter'); }
  hooks.frame.push(() => {
    const want = seasonState.winterHere ? 'winter' : 'summer'; // (dressed for the cold where you are)
    if (want === wearing || activity.within('dance')) return; // (never mid-dance)
    if (want === 'winter' && !ready()) { build(false); return; }
    wear(want);
  });
}
