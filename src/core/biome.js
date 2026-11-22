// Biomes: the kinds of land beyond the ordinary country (meadow, heath, lush woods, blossom groves,
// snowfields, taiga, tundra, which core/shape.js's climate already makes). As in Minecraft, each is a
// region of a few broad fields of (seed, x, z) that also shape the land, so the land and what grows
// on it always agree:
//   temperature  coldBase: cold at one end, warm at the other, home in the middle
//   moisture     rainAt / moistAt
//   ruggedness   rangeAt: plains, hills, mountains
//   wonder       wonderAt: a rare field of its own, for the places more than natural (the owner
//                wants a fantasy world): an enchanted wood here, a volcano there
// A biome's weight at a spot (0..1) is how much the spot belongs to it; they blend at their edges.
// Everything that draws a biome (the ground, plants, rocks, buildings, the sky) asks here. The
// functions live in core/shape.js (the land's height uses them for the buildings' levelled ground).
//   desert     hot and dry: sand in ripples, cacti, sandstone ruins
//   swamp      warm or mild, very wet, low and flat: dark peat, willows, huts on stilts
//   enchanted  an old wood of wonder: giant trees, blue-green moss, glowing mushrooms and crystals
//   volcanic   a wonder in the mountains: black rock with lava in its cracks
export { biomesAt, biomeAt, wonderAt, siteAt, sitesNear } from './shape.js';
