// What the player is doing right now. Exactly one activity is current; entering a new one
// remembers the previous so it can be resumed (e.g. naming a pet while petting, fishing from the
// moored boat while seated). Each activity says which others may start on top of it, which is
// what stops lying down and petting, or photo mode and stargazing, from fighting each other.

const RULES = {
  // activity: { from: activities it can start from, locks: whether walking is blocked }
  sit:    { from: ['free'] },
  pet:    { from: ['free'] },
  fish:   { from: ['free', 'sit'] },
  lie:    { from: ['free'], locks: true },
  dialog: { from: ['free', 'pet', 'sit', 'fish'], locks: true },
  photo:  { from: ['free', 'sit', 'pet', 'fish', 'lie'], locks: true },
};

const listeners = new Set();
export const activity = {
  current: 'free',
  stack: [],
  is(name) { return this.current === name; },
  get free() { return this.current === 'free'; },
  canEnter(name) { return !!RULES[name] && RULES[name].from.includes(this.current); },
  /** Start an activity on top of the current one. Returns false if it isn't allowed now. */
  enter(name) {
    if (this.current === name) return true;
    if (!this.canEnter(name)) return false;
    this.stack.push(this.current);
    this.current = name;
    listeners.forEach((fn) => fn(name, 'enter'));
    return true;
  },
  /** End an activity. Ending one that isn't on top also ends everything started on top of it. */
  leave(name) {
    if (this.current !== name && !this.stack.includes(name)) return;
    while (this.current !== name) this.current = this.stack.pop() || 'free';
    this.current = this.stack.pop() || 'free';
    listeners.forEach((fn) => fn(name, 'leave'));
  },
  /** True while any activity in the stack blocks walking. */
  locksMovement() { return !!(RULES[this.current] && RULES[this.current].locks); },
  onChange(fn) { listeners.add(fn); },
};
