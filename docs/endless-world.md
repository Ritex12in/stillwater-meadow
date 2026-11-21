# Endless world: plan and progress

Stillwater Meadow is being turned from one hand-built valley into an endless, generated world,
with new characters. This file is the working plan: what was decided, the milestones, the rules
the generator must follow, and what in today's code still assumes a single valley.

Work happens on the `endless-world` branch, one commit per milestone. `main` publishes the live
site (GitHub Pages) and stays untouched until the owner asks for a merge.

## Decisions (made by the owner)

- **World:** fully generated from a seed, endless in every direction, no fixed home. Generated the
  way Minecraft is, but it keeps this game's smooth low-poly look (no blocks).
- **Places:** the things that live at the lake today (jetty, boat and skipper, shrine grove,
  campfire, bench, lamp path) become landmarks scattered through the world. Fishing, ducks and
  winter ice work at any lake. Pets and the girl travel with the player. The player starts beside
  a generated lake that is guaranteed a jetty.
- **Characters:** the code-sculpted children are replaced by imported rigged, animated models
  (free, CC0). The animals (cats, dogs, ducks) and the skipper are redesigned too.
- **Saves:** existing players keep their journal, pets and rod. (Today's save holds no position,
  so nothing is lost there.)
- **Milestone 4 choices (2026-11-21):** all four groups of extra places (glowing and ancient,
  high places, hot springs, places you make) and all four activities (frozen-lake play, fish by
  country, a flower journal, compass and named places). **Each place remembers its own state**:
  not one bench or skipper shared by all. Trails, rivers and waterfalls, and islands are wanted
  but not in milestone 4; the owner also asked to plan for an **ocean** and a **backpack**. The
  backpack is planned into 4d (things you place come out of it); the ocean, rivers, islands and
  trails are milestone 8.
- **Testing:** run only new or affected tests after a change; full runs when asked, at 4c, and
  before merging to `main`.

## Milestones

Each one leaves the game playable and tested.

| # | Milestone | Done when | State |
|---|---|---|---|
| 1 | **Prepare the code.** Lakes and the places beside them become data that code asks for by position, instead of constants. | The world is bit-for-bit the same (`tools/fingerprint.mjs`) and every test passes. | done |
| 2a | **Endless ground.** Land from a world seed (`?seed=`), drawn in tiles round the camera at five sizes; the painted mountain ring replaced by real far terrain; grass, clouds and birds follow the player; the walk limit removed (steep slopes block instead). The valley's own trees and flowers still stand where they did. | Tile buffers stop growing over repeated 2 km trips (`tests/world.spec.js`); same seed, same land. Smoothness still needs a look on a real GPU. | done |
| 2b | **Trees everywhere.** Each 57.6 m square beyond the valley grows its own trees from the seed; real models near the player, cards further off; the camera, walkers, animals and seasons treat them like the valley's. | A square regrows identically; no tree is dropped for want of a slot; repeated 2 km trips leave the scene's object count unchanged (`tests/world.spec.js`). | done |
| 2c | **Small plants and rocks beyond the valley.** Boulders (with the tree models), and in the squares closest to the player bushes, ferns, mushrooms and drifts of daisies, lupins and tulips. The valley's own build-once plants stay until milestone 4 retires the valley. Picking flowers out there waits for milestone 4 too. | A square regrows identically; nothing dropped (`tests/world.spec.js`). | done |
| 3 | **Kinds of country.** A climate (cold, rain) read from the seed: snowfields and pines in the cold, golden heath with a few birches where it is dry, thick dark-green woods where it is wet, mild meadow between, and rare blossom groves. The ground, grass, trees, boulders and flowers all follow it, and far tiles show it from a distance. | Each kind exists within 2.6 km and grows its own trees; the valley stays mild (`tests/world.spec.js`). | done |
| 4a | **Places from the seed, lakes first.** A grid of places, each chosen from the land and climate round it. Lakes of varied size and shape, each in its own valley: water, reeds, lilies, ducks, jumping fish, fishing; frozen all year in snow country; seen from afar. The save holds seed and position; a list to jump to places. The home valley still stands. | Height is continuous between neighbouring lakes; a lake is the same every visit; water is drawn from a fixed pool. | next |
| 4b | **Landmarks that follow you.** Jetty with boat and skipper, campfire with logs, bench and lamp path at some lakes; the shrine in blossom groves. One of each object, moved to the nearest place of its kind while out of sight. Each place remembers its own state (its own bouquet, fire, trade). | Moving between two lakes re-anchors everything with nothing left behind; each place's state survives leaving and returning. | |
| 4c | **The valley goes.** Start beside a generated lake with the full set. The fixed valley and its hand-placed plants are removed; flowers can be picked anywhere; tests rewritten round a fixed seed and places found by query. | One full run of the suite. | |
| 4d | **More to discover, and a backpack.** Glowing stone circles on hilltops; a giant old tree ringed with glowing mushrooms; summit cairns with a bench and a view; hot springs in snow country to sit in; pitching your own camp; lanterns lit as trail markers; skating and ice fishing on frozen lakes; fish and rare flowers by kind of country, with a flower journal; a compass and named places. A backpack holds what you carry (rod, creel, flowers, cones, lanterns, tent). | Each place is pure in seed and position and drawn from fixed slots. | |
| 5 | **Travelling.** Companions keep up over long distances; finding places again (builds on the compass). | |
| 6 | **New characters and animals.** Starts with one imported model walking, shown to the owner before any action is rewired. New animals by kind of country (deer, foxes, owls) wait for this. | |
| 7 | **Performance on real devices.** A view-distance setting; tuning on a real GPU and a phone. | |
| 8 | **Water and ways** (planned, not started; each needs new terrain work): an ocean with coasts and beaches; rivers running between lakes and to the sea, with waterfalls; islands in big lakes reached by boat; worn trails between places with signposts. | |

## Rules for milestone 4

- **A site grid, not just lakes.** One pure query (`sitesNear`, `nearestSite(kind)`) over a
  jittered grid; a site's kind is chosen from the terrain and climate at its spot. New kinds of
  place are then data, not new machinery.
- **Height stays continuous.** "Nearest lake" switches abruptly and a lake's basin reaches 7.5
  radii: space lakes so the switch falls outside both basins, or blend the basins of all nearby
  lakes. Check by sampling height along lines between neighbouring lakes.
- **`lakeAt` stays cheap.** It runs for every tile vertex and tree candidate: cache lakes per
  grid cell and exit early.
- **Plants keep off sites.** `growSquare` and `growSmall` ask for nearby sites, so nothing grows
  through a jetty or a fire.
- **Anchors move only when safe**: out of sight, nothing in progress. After a move, rebuild what
  caches positions (the grass map knows where the jetty and bench are; obstacles; shadows).
- **Water from a small fixed pool** of meshes, one material each with shared uniform objects.
  Ground below the water line is tinted on far tiles so distant lakes are not brown holes.
- **Per-place state** lives in the save under the place's id (grid cell and kind); the single
  bench, fire, boat and skipper load the state of the place they are standing at.
- **One water level** (0) everywhere, so an ocean (milestone 8) can share it.

## Rules for the generator

- **Pure functions.** Ground height, biome and where lakes and landmarks are must depend only on
  (seed, position): never on the order things were built in, and never on where the player has
  been. The shared layout random stream (`rng`/`rand` in `core/math.js`) cannot be used for
  anything placed per tile; each tile gets its own seeded stream.
- **Sites on a jittered grid.** Lakes sit one per coarse grid cell (or none), found by looking at
  the neighbouring cells of a position. `lakeAt(x, z)` in `core/shape.js` is the one place that
  changes.
- **Landmarks are singletons that move.** There stays one jetty, one boat, one shrine and one
  campfire object; each belongs to the nearest site of its kind and is moved when the player
  comes within reach of another. Sites of one kind are spaced wider than the view distance.
  `landmarksOf(lake)` already works these places out for any lake.
- **Water per lake.** One water mesh per nearby lake, its outline passed as uniforms
  (`lakeShape`, `lakePhase` in `world/water.js`).
- **Walking by slope.** `walkable` caps height at 18 m and distance at `WORLD_LIMIT`; both go.
- **No hitches.** Tiles are generated inside a per-frame time budget (or in a worker), or the
  Auto quality setting will mistake them for a slow device.
- **Far from the origin.** Teleport 20 km out and look for jitter in the grass and water before
  deciding whether the world must be re-centred on the player.

## What still assumes one valley

Found while preparing milestone 1; each line is work for the milestone named.

**Centred on the origin (milestones 2c and 4)**
- `world/vegetation.js`: the valley's trees (within 155 m of the origin, denser further out), its
  rocks and its flower drifts.
- `world/kitplants.js`, `world/wildflowers.js`, `world/shrine.js`: placement loops bounded by
  distance from the origin.
- `world/wilds.js` leaves a hole of 155 m round the origin for the valley's own trees
  (`WILD.valley`); milestone 4 closes it.

**Built once (milestones 2c and 4)**
- Everything planted in `main.js` "Build the world" except the trees runs once, in an order that
  fixes every position, from the shared layout stream.
- `instancedChunks`/`instancedVariants` in `core/materials.js` add meshes that are never removed.
  Streamed things must use fixed slots that are refilled, as `lodSet` (with `capacity`) and the
  tree cards now do: nothing is allocated or disposed while you walk.

**Far from the origin (milestone 5)**
- Shader hashes are wrapped (`mod`) in the ground and grass so they stay random far out; the wind
  hash in `addWind` (`core/materials.js`) is not yet.
- Ground textures are sampled by world position: about 20 km out their coordinates lose precision.
  If that shows, re-centre the world on the player.

**One lake (milestone 4)**
- `world/water.js`: one disc of radius 48 at the home lake.
- Built round the home lake: the path, lamps and fences (`world/props.js`, `world/kitprops.js`),
  reeds and lily pads, mist sprites (`systems/weather.js`), the heron's spots
  (`features/wildlife.js`), the animals' homes (`characters/animals.js`), the boat's circuit
  (`characters/boat.js`), the girl's home (`features/friend.js`), the skating spots
  (`features/icedance.js`).
- The single-lake names in `core/shape.js` (`LAKE`, `lakeR`, `lakePoint`, `SPAWN`, `dockStart`,
  `dockDir`, `DOCK_Y`, `FIRE_SPOT`, `BENCH_SPOT`, `chairSpots`, `onDock`, `nearReserved`).

**Tests (milestones 2 to 4)**
- The specs teleport to valley spots through `window.__meadow.geo`. They need a fixed `?seed=`
  and spots found by query ("the nearest jetty").

## What the children do today (the list a new model must cover, milestone 6)

Walk, run, idle, sit (bench, chairs, logs, boat), lie down to stargaze, fish (charge, cast, reel,
strike), pet an animal, throw bread and fish, carry a bouquet, hold hands and walk together, a
16-bar waltz with joined hands, a skating dance on ice, four emotes (wave, cheer, sit, dance),
changing facial expressions, winter clothes, hair and a backpack that lag behind the body.
An imported model only has the animations its pack ships, so some of these will be simplified
or dropped once a pack is chosen.

## How the ground works (milestone 2a)

- `core/shape.js` `height(x, z)` is the land: meadow, rolling hills and mountain ranges from noise
  shifted by the seed, held back in a basin round each lake, with the lake's bowl and path cut in.
  `heightAt` reads the drawn tiles where they are loaded and falls back to the formula, so game
  logic is right whether or not that ground is on screen (the tests tick without drawing frames).
- `world/terrain.js` keeps a quadtree of tiles round the camera: 48 x 48 cells each, 57.6 m wide
  at the finest (1.2 m cells) and doubling four times to 921.6 m. `updateGround` picks what shows;
  `pumpGround(ms)` makes queued tiles nearest first within a time budget; `settleGround` makes
  everything now (at load). Buffers are pooled. `window.__meadow.ground` exposes these to tests.
- The ground has its own haze (`groundU.haze`): it never fades out completely, so far mountains
  show as pale shapes; fog, rain and snow push it back to full.
- `world/grassfield.js` keeps a 144 x 144 map of height and "grass grows here" round the camera
  and shifts it as the camera moves.

## How the climate works (milestone 3)

- `core/shape.js`: `coldAt(x, z, h)` (a broad noise field, plus altitude) and `rainAt(x, z)`
  (another), with `snowOf`, `dryOf`, `lushOf` turning them into 0..1 amounts, and `groveAt` for
  blossom groves. `mild()` keeps the valley round the origin neutral; it goes with the valley in
  milestone 4.
- Ground: each tile vertex carries `clime` (cold, dry). The ground shader tints dry ground gold
  and lays snow where cold passes a threshold, with a ragged edge from its own noise. Lush country
  darkens the vertex tint. Snow on the peaks is the same mechanism (cold rises with height).
- Grass: the camera-centred map's two spare channels hold cold and dry; tufts vanish under snow
  and grow taller and golden on the heath.
- Trees, boulders, small plants (`world/wilds.js`): density from woods-noise scaled by climate;
  pines by cold; birches and open-crowned trees on the heath; blossom trees and tulip carpets in
  groves; no small plants or flowers under snow.
- `window.__meadow.climate(x, z)` returns `{ snow, dry, lush, grove }` for tests.
- Not done: weather per region (snowfall in the cold), snow on tree crowns in snowfields, and
  climate-specific sounds.

## How the trees work (milestone 2b)

- `world/wilds.js` cuts the land into the ground's 57.6 m squares. `growSquare(ix, iz)` is pure:
  the square's seed gives candidate spots, kept where there is a wood (broad noise patches), not
  on rock or cliffs (`rockAmt`, the same test the grass and ground texture use), with more pines
  higher up. Squares within `WILD.load` of the camera are kept, two new ones a frame.
- Every tree in a kept square has a card (`world/farforest.js`: one mesh of 6,000 slots, refilled).
  Cards grow in with distance in the vertex shader (`CARD_IN`), so nothing pops.
- Squares near the camera also hand their trees to the real tree sets: `setWildTrees` in
  `world/vegetation.js` appends them to `treeSpots` (after the valley's, which stay first) and
  refills the `lodSet`s through `world.roundTop.setItems`. Models stop at `MODEL_FAR`.
- Seasons: each round tree carries its own palette (`pal`) and current colour (`shown`). The
  valley's are drawn from the runtime stream as before; wild trees hash their position.
- Boulders and small plants (milestone 2c) are drawn by `slotSet`s (`core/materials.js`): one
  InstancedMesh per shape with a fixed number of slots, sharing the valley's geometry and
  materials. Each builder hands the wilds a refill function (`world.setWildRocks`,
  `world.setWildUndergrowth`, `world.setWildFlowers`). Boulders come with the "near" squares;
  small plants only with the "close" ones (`WILD.closeIn`), grown lazily by `growSmall`.
- `window.__meadow.wilds` (`stats`, `settle`, `square`, `rocks`, `small`) and `objects()` are there for tests.

## Tools

- `node tools/fingerprint.mjs out.json` (dev server running): writes a numeric fingerprint of the
  generated world (ground heights, lake shape, walkable area, every instanced plant's position).
  `node tools/fingerprint.mjs a.json b.json --compare` says whether two are identical. Use it to
  prove a refactor moved nothing, and that one seed always gives the same world.
- `MEADOW_RUNNER=1 MEADOW_WORKERS=1 node tests/run.mjs` (Git Bash): the test suite, one test at a
  time. The software renderer used by headless Chrome is slow, so two at once time out on load.
