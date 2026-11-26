// What the browser and the URL tell us at startup.
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarsePointer = matchMedia('(pointer: coarse)').matches;
export const query = new URLSearchParams(location.search);
export const debug = query.has('debug');
/** Going anywhere at once from the lists (the World popover's places and countries, the journal's Go): for testing and filming. In play you travel between waystones. */
export const freeTravel = debug || query.has('freetravel');
