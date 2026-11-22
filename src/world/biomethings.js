// The biomes' own things, drawn from fixed slots like the rest of the wilds (world/wilds.js decides
// which grow in each square near you): cacti in the desert; crystals and glowing mushrooms in the
// enchanted wood; still pools with lotus in the swamp. Made in code (world/makers.js). The
// crystals, the mushroom caps and the lotus take their own colour, and light up at night.
import * as THREE from 'three';
import { std, weatherize, bothSides, slotSet, neonAtNight } from '../core/materials.js';
import { world } from '../core/state.js';
import { cactus, crystalCluster, glowMushroom, poolDisc, lotus } from './makers.js';

/** How many of each can be drawn at once. */
const SLOTS = { cacti: 160, crystals: 220, mushrooms: 320, pools: 120, lotus: 260 };
const V = 4; // variants of each

export function buildBiomeThings() {
  const cactusMat = weatherize(std('#ffffff', { vertexColors: true, flatShading: true }), 'std');
  const glowMat = neonAtNight(std('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.1 }), 1.2);
  const stemMat = std('#e8e2d4', { vertexColors: true, flatShading: true });
  const capMat = neonAtNight(bothSides(new THREE.MeshLambertMaterial({ vertexColors: true })), 1.1);
  const shrooms = Array.from({ length: V }, (_, i) => glowMushroom(i));
  const sets = {
    cacti: slotSet(Array.from({ length: V }, (_, i) => cactus(i)), cactusMat, SLOTS.cacti, { cast: true, colored: true }),
    crystals: slotSet(Array.from({ length: V }, (_, i) => crystalCluster(i)), glowMat, SLOTS.crystals, { cast: true, colored: true }),
    stems: slotSet(shrooms.map((m) => m.stem), stemMat, SLOTS.mushrooms),
    caps: slotSet(shrooms.map((m) => m.cap), capMat, SLOTS.mushrooms, { colored: true }),
    // dark still water, glossy, mirroring the sky a little
    pools: slotSet([poolDisc(0), poolDisc(1)], new THREE.MeshStandardMaterial({ color: '#5f8c88', roughness: 0.06, metalness: 0.1, emissive: '#1d3a3a', emissiveIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }), SLOTS.pools),
    lotus: slotSet([lotus(0), lotus(1)], neonAtNight(bothSides(new THREE.MeshLambertMaterial({ vertexColors: true })), 1.3), SLOTS.lotus, { colored: true }),
  };
  const kind = (it) => it.v % V;
  /** Draw these, and no others. Returns how many found no slot (it should be none). */
  world.setBiomeThings = (list) => {
    sets.cacti.setItems(list.cacti, kind);
    sets.crystals.setItems(list.crystals, kind);
    sets.stems.setItems(list.mushrooms, kind);
    sets.caps.setItems(list.mushrooms, kind);
    sets.pools.setItems(list.pools || [], (it) => it.v % 2);
    sets.lotus.setItems(list.lotus || [], (it) => it.v % 2);
    return sets.cacti.dropped + sets.crystals.dropped + sets.stems.dropped + sets.caps.dropped + sets.pools.dropped + sets.lotus.dropped;
  };
}
