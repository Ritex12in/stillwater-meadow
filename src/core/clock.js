// Game time shared by everything that animates. `elapsed` only advances while the page is visible.
// For debugging (the `tick` and `speed` commands, features/commands.js; none of it is saved): `rate` is how
// fast the game runs against real time, `frozen` stops it (the view still draws and looks about), `steps`
// is how many sixtieths of a second it is still to be stepped on while frozen, and `walk` multiplies how
// fast you walk and run.
export const clock = { elapsed: 0, frame: 0, rate: 1, frozen: false, steps: 0, walk: 1 };
