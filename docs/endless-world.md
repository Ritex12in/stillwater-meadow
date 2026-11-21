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
  not one bench or skipper shared by all. The owner found the first generated lakes too alike, so
  lakes vary in outline (round, long, deeply scalloped), size, beach, path and water colour by
  the country they lie in; reeds, lilies and wildlife per lake come with 4b. Trails, rivers and waterfalls, and islands are wanted
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
| 4a | **Places from the seed, lakes first.** A grid of places, each chosen from the land and climate round it. Lakes of varied size and shape, each in its own valley: water, reeds, lilies, ducks, jumping fish, fishing; frozen all year in snow country; seen from afar. The save holds seed and position; a list to jump to places. The home valley still stands. | Height is continuous between neighbouring lakes; a lake is the same every visit; water is drawn from a fixed pool (`tests/lakes.spec.js`). | done |
| 4b-1 | **Landmarks that follow you.** Settled lakes (each outranking its eight neighbours, so at least half a kilometre apart) have a kit worked out from the seed and checked against the land: a jetty with the boat and skipper where the shore allows, a campfire with logs, a bench with lawn chairs and path lamps; each turned its own way. One of each object, moved to the nearest settled lake when the old one is well behind. Each place keeps its own state (bench bouquet, boat bouquet, fire). | Home is bit-for-bit unchanged; there and back leaves seats, obstacles and scene objects as they were; a bouquet stays at its own bench across a reload (`tests/places.spec.js`). | done |
| 4b-2 | **Lake life at every lake.** Reeds and lily pads per lake, worked out from the lake and its country and drawn from fixed slots for the three nearest; the ducks, the heron, the frogs and the mist are at the lake you are at (not ducks on ice). | Each lake's are the same every visit; none undrawn; a tour of lakes leaves the scene as it was (`tests/lakes.spec.js`). | done |
| 4c | **The valley goes.** (next) Start beside a generated lake with the full set. The shrine is rebuilt in blossom groves (its geometry is baked to the ground it stands on, so it is rebuilt, not moved). The fixed valley and its hand-placed plants, fences and pebbles are removed; flowers can be picked anywhere; tests rewritten round a fixed seed and places found by query. | One full run of the suite. | |
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

## How the landmarks work (milestone 4b-1)

- **Made once, then placed.** `world/props.js` (jetty, bench, chairs, lamps), `features/campfire.js`,
  `characters/boat.js` and the bench bouquet in `features/flowers.js` build their objects once and
  put them where the landmark spots are; each registers a function in `hooks.anchor`
  (`core/state.js`) to place them again. Seats and obstacles are objects kept by their owner and
  updated in place, never re-pushed.
- **The spots move.** `anchorTo(lake)` in `core/shape.js` re-points the single-lake names (`LAKE`,
  `lakeR`, `lakePoint`, `DOCK_A`, `DOCK_Y` are `export let`) and writes new numbers into the same
  `{x, z}` objects (`SPAWN`, `dockStart`, `dockDir`, `FIRE_SPOT`, `BENCH_SPOT`, `chairSpots`).
  `landmarksOf(lake)` works them out, turned by the lake's `turn`.
- **Settled lakes.** `settledCell`: a lake is settled if its rank (a hash) beats every lake in the
  eight squares round it; the home lake outranks all. `kitOf(lake)` (lazy, kept on the lake)
  decides `{ dock, fire, bench }` and tries ten turns for one where `jettyFits`: root on dry land,
  deck over water, the boat's whole tour afloat. No jetty on frozen lakes.
- **What a lake lacks is parked.** Its spots are put at `PARK` (400 km off), so `onDock`, seats,
  obstacles, actions and lamp light all answer "not here" with no special cases. `KIT` says what
  the anchor lake has; the boat is hidden and circles its parked mooring.
- **Plants keep clear by a pure rule.** `clearingAt`: no wild tree or boulder within 1.95 radii of
  a settled lake, whether or not the landmarks are there, so a square always regrows the same.
- **The chooser** (`systems/anchor.js`, called from `tick`): moves the landmarks when you are
  idle, the old lake is 280 m behind and another settled lake is 60 m nearer; at once on arriving
  by the Places list and at load. It swaps per-place state: `store.places[id]` holds a place's
  bouquets and fire while the landmarks are elsewhere; `store.benchBouquet`/`boatBouquet` are
  always the current place's, named by `store.anchor` (so old saves and features work unchanged).
- A lake's bowl is wider, in radii, for small lakes (`lake.bowl`), or they lie in a pit.
- Still home-only until 4c: the fences, pebbles, the snowman, the animals' homes, the shrine,
  pickable flowers, pine cones, deer.

## How lake life works (milestone 4b-2)

- `world/lakelife.js`: `lifeOf(lake)` gives a lake's reeds, reed heads, lily pads and lilies from
  its own seed, its size and its `clime` (thick beds and many lilies in lush country, few reeds on
  the heath, straw-coloured stalks and no lilies round a frozen lake), keeping reeds off the jetty
  if it has one. Kept on the lake (`lake.life`). The home lake's are the ones
  `buildReedsAndPads` has always laid out from the layout stream (it still takes the same draws).
- They are drawn by four `slotSet`s made in `world/vegetation.js`; `updateLakeLife` refills them
  for the three lakes nearest the camera when that set changes. `world.padMesh`/`bloomMesh` are
  two of those sets, so the seasons and the evening glow reach every lake's lilies.
- "The lake you are at" (`lifeLake`): changes when you are within 150 m of another lake and the
  old one is 240 m behind (or at once on arriving by the Places list and at load). `hooks.lake`
  then tells the ducks (`features/ducks.js`: put on that lake's water, unless it is frozen), the
  heron and the frogs (`features/wildlife.js`) and the mist (`systems/weather.js`).

## How the lakes work (milestone 4a)

- `core/shape.js`, "Lakes from the seed": the land is ruled into `LAKE_CELL` (420 m) squares;
  `lakeOfCell` gives each one lake or none from the seed, kept to the middle 60% of its square and
  scaled so its shore never reaches further than 47 m (`rmax`). That guarantees two things the
  rest relies on: bowls (out to 1.7 x the shore) never overlap, and a lake's influence
  (`reach2`, 7.5 x `rmax`) never passes the next square, so the eight squares round a spot are
  all that need looking at (`lakesAround`, cached per square).
- `height` multiplies every nearby lake's valley factor into the land and cuts only the nearest
  bowl, so there is no seam where "the nearest lake" changes (checked at 506 such points).
- A lake's character comes from the climate at its spot: `beach` (breadth of sand; the ground and
  the grass map read it), `ring` (a path round it or not), `tint` (cast of the water), `frozen`
  (snow country: ice all year; `onIce` honours it). `E`/`TH` stretch the outline.
- `world/water.js` lends four sheets of water to the nearest lakes (`updateWater`); each sheet has
  its own outline, tint and ice uniforms and shares the rest. Lakes further off are painted as
  water on the coarse ground tiles (third component of the tiles' `clime` attribute).
- The save holds `where` (seed, x, z); `?at=x,z` starts anywhere. The World popover lists the
  lakes about (`initPlaces`), and `window.__meadow` has `lakes()`, `visitLake(id)`, `travelTo`.
- HOME is the lake of the square the valley stands in, and the single-lake names still mean it.

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
