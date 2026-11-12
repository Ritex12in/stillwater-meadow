// What the browser and the URL tell us at startup.
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarsePointer = matchMedia('(pointer: coarse)').matches;
export const query = new URLSearchParams(location.search);
export const debug = query.has('debug');
