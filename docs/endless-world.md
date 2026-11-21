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
- **Seasons, weather and the wild (2026-11-22):** seasons and weather must differ place by place
  and change. The owner chose: a faster game year (8 real days, so each season lasts 2 real days;
  day and night still follow the real clock); regions warmer than home (green in winter); weather
  shared by everyone in the same world at the same moment; and, for now, no manmade things away
  from home ("it's weird to see a lamp post out of nowhere near lakes in a snow desert"): the home
  lake keeps its jetty, boat and skipper, fire, bench, chairs, lamps and path; every other lake is
  wild; the shrines in blossom groves stay.
- **Worlds and carrying (2026-11-22):** seeds as in Minecraft: any text is a seed, the same text
  the same world, a new player gets a random one. The backpack is a real inventory of slots
  (flowers, later tools and other things); bouquets are tied from flowers in it.
- **Testing:** run only new or affected tests after a change; full runs when asked, at 4c, and
  before merging to `main`.
- **Planning round (2026-11-21, second):**
  - **Goals:** journals to complete (fish, flowers and places, a page per kind of country) and
    postcards (an album filled by finding kinds of place, taken with photo mode).
  - **Main story:** the owner wants one main story, and a long one (a dozen chapters or more,
    reaching far into the world). Its premise and how it is told are to be decided later; three
    directions were offered (relighting dark lanterns from lake to lake; the girl's postcards
    home; waking a shrine grove in each kind of country) and none chosen. Whatever it is, its
    places must be found by rule from the seed, since every player's world differs.
  - **Seed:** a new player gets a random world, saved with their game; the seed is shown and can
    be shared or entered. (Today the seed comes only from `?seed=` in the address, default 1.)
  - **Release:** the endless world replaces the old valley on the live site only after the new
    characters are in (milestone 6). Until then `main` stays as it is.

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
| 4c | **The valley goes.** Start beside a lake generated from the seed, with the full set of landmarks. The hand-placed valley, its plants, fences and pebbles are removed. Flowers to pick grow everywhere. Shrine sites are fixed by the seed (one back from the home lake, others in blossom groves); the ground under each is levelled, and the one shrine stands at the site nearest you. Tests go by places found by query. | One full run of the suite. | done (full run 2026-11-22: 42 of 43 passed; the one failure, the untamed cat, was the test assuming the old valley's shore, fixed) |
| 4d | **More to discover, and a backpack.** Build order: (1) backpack, compass and named places, and the random saved seed (done); (2) flowers picked anywhere with a flower journal, fish by country; (3) skating and ice fishing; (4) places to find; (5) places you make; then the places journal and the postcard album. Glowing stone circles on hilltops; a giant old tree ringed with glowing mushrooms; summit cairns with a bench and a view; hot springs in snow country to sit in; pitching your own camp; lanterns lit as trail markers; skating and ice fishing on frozen lakes; fish and rare flowers by kind of country, with a flower journal; a compass and named places. A backpack holds what you carry (rod, creel, flowers, cones, lanterns, tent). | Each place is pure in seed and position and drawn from fixed slots. | |
| N | **Seasons and weather by place** (planned 2026-11-22, before 4d step 2; see "Plan: seasons and weather by place"). (1) Away from home, lakes are wild. (2) A game year of 8 real days, and each place's temperature through it; warmer regions. (3) Snow, ice, leaves, blossom and flowers from that local temperature. (4) Weather as a pattern moving across the land with the wind, the same for everyone in a world. (5) The World panel says what it is like where you stand; distant storms later. | Pure in seed, position and time; nothing rebuilt as the days pass. | |
| 5 | **Travelling.** Companions keep up over long distances; finding places again (builds on the compass). | |
| 6 | **New characters and animals.** Starts with one imported model walking, shown to the owner before any action is rewired. New animals by kind of country (deer, foxes, owls) wait for this. | |
| 7 | **Performance on real devices.** A view-distance setting; tuning on a real GPU and a phone. | |
| 8 | **Water and ways** (planned, not started; each needs new terrain work), cheapest first: an **ocean** (the land formula gains a continent shape; land below the one water level becomes sea, with beaches); **trails** between neighbouring settled lakes, flattened into the ground, with signposts; **islands** in big lakes (needs the boat to steer or to have a second stop); **rivers and waterfalls** (hardest: a river is carved along a route from lake to lake or sea, and the carving must agree across tiles). | |
| 9 | **The main story** (planned; premise and telling to be decided with the owner). Long: a dozen chapters or more. Its places are found by rule from the seed. | |

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

(All of the list below up to "Far from the origin" was dealt with by the end of milestone 4c;
it is kept as a record of what the change touched.)

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

## Character and animal models (checked 2026-11-21, for milestone 6)

- Quaternius (the author of the nature models, all CC0) publishes the **Universal Animation
  Library**: animations on one shared humanoid rig, in glTF among other formats. Library 1 has
  120+ (walking in eight directions, jog, sprint, crawl, swim, sitting). Library 2 (January 2026)
  has 130+ more, including fishing and farming; its free "standard" version is about 70% of the
  set, and whether fishing is in the free part was not confirmed. Character bodies come from his
  separate CC0 character packs on that rig.
  https://quaternius.com/packs/universalanimationlibrary.html ,
  https://quaternius.com/packs/universalanimationlibrary2.html
- KayKit's Adventurers characters (CC0, glTF, 75 animations) are an alternative; no sit or
  fishing animation was confirmed in them. https://kaylousberg.itch.io/kaykit-adventurers
- No pack found covers the waltz, the skating dance, holding hands or petting: those are rebuilt
  by blending pack animations with hand adjustments, or simplified.
- Animals: a CC0 Quaternius set has an animated wolf, dog, cat and eagle
  (https://opengameart.org/content/animated-animales-low-poly). No CC0 deer or fox was confirmed
  (the ones found are paid).
- The owner will probably have to download the packs (itch.io or quaternius.com). First step is
  unchanged: one imported character walking in the world, shown before anything is rewired.

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
- Still at the home lake only: the pine cones and the deer. The animals' homes, the girl's and
  the snowman's spot are given from the jetty, so they turn with the lake's arrangement.

## How worlds, the backpack and the compass work (milestone 4d, step 1)

- **Which world.** `systems/save.js` picks the seed as the save loads: the address's `?seed=`,
  else the world last played (`store.seed`), else world 1 for a save from before worlds had
  numbers, else (someone new) one at random from 2 to 4294967295. As in Minecraft a seed can be any text
  (up to 64 characters): a whole number is that seed, other text is turned into one (FNV-1a), the
  same text always the same world; the text is what is shown and shared (`store.seedText`), the
  number is what the land is made from (`store.seed`, the key of `store.worlds`). The land is made
  with 32-bit arithmetic, so every seed up to 4294967295 is a world of its own. `core/shape.js`
  reads it from there.
  A shared link switches your world: nothing is lost, because what belongs to a place is kept per
  world: `where`, `places`, `anchor`, `benchBouquet` and `boatBouquet` are put away in
  `store.worlds[seed]` when you leave a world and brought out when you come back. What you carry,
  your pets, bonds and journal go with you. "Start over" forgets everything and begins in a new
  world. The World panel shows the world's seed, copies a link to it, goes to a world by any seed
  typed in, or to a new one at random.
- **Tests and tools** play world 1 unless they ask for another (`tests/helpers.js` adds `seed=1`;
  `tools/fingerprint.mjs` too). `tools/seeds.mjs random 30` checks thirty worlds a new player
  could get; 42 worlds so far (1 to 12 and 30 at random) all start well. If none of the home
  lake's sixteen ways fits a jetty, `kitOf` tries 64 ways between them (never needed so far).
- **Backpack** is an inventory (`systems/pack.js`, owner's decision 2026-11-22): 24 slots, the
  one record of what you carry (`store.pack`, goes with you from world to world). An item is
  `{ uid, type, key, n, list }`; things of one type and key stack (flowers by kind up to 32, each
  keeping its colour; fish by species, each keeping its length, still 8 fish at most; pine cones
  up to 16); the rod and bouquets take a slot each. Features add their kinds with `itemKind()`
  (name, stack size, picture from `ui/icons.js`, whether it can be held). The grid (`ui/backpack.js`,
  I or the menu) shows each slot; choosing one says what it is and offers what can be done with it
  (`packActions`); slots can be dragged to swap. Save version 3 moved the rod, the creel's fish and
  the cones in; a bouquet held in the hand in an older save becomes a held bouquet.
- **Flowers and bouquets** (owner's decision): picked flowers go into the backpack. A bouquet is
  tied there: put flowers aside one at a time, or "Tie a mixed bouquet" (up to 12, one of each kind
  in turn); the new bouquet is held, and drawn in the figure's hand. G by the skipper, your friend
  or the bench gives the held bouquet (or the first one in the backpack). With flowers but no
  bouquet there, a prompt says to tie one first. A full backpack shows "Backpack is full" and
  picks nothing.
- **Compass** (`ui/compass.js`): north is -z, as the sky has it (the sun rises at azimuth 65°,
  +x a little toward -z, and is due south, +z, at noon). The strip shows the half of the horizon
  you face, from the camera. Up to four named places are marked, chosen twice a second: the home
  lake, the nearest shrine, the nearest settled lakes; where two lie the same way the farther
  shows only its dot. Shrine sites have names by rule from where they are (the home one is named
  after the home lake). Coming to a lake, or within 40 m of a shrine, shows its name.

## Plan: seasons and weather by place (decided 2026-11-22, not started)

**What is wrong today.** One season for the whole world, from the calendar or picked: in winter every
lake freezes, snow covers everything and flowers go everywhere; walking never changes the season.
One weather state follows you everywhere, changing on a timer by a table of what follows what, the
same on the heath as in lush woods; it snows only because the season says winter.

**1. Wild lakes away from home.** Only the home lake is settled: its jetty, boat and skipper, fire,
bench, chairs, lamps and worn path stay (the rod trade, the boat tour and the campfire need them).
Every other lake has no path, clearing or landmarks. The code that moves the landmarks from lake to
lake and keeps each place's own things is switched off, not deleted (settlements may come back
with a story). The Places list and the compass still name lakes. Tests about landmarks at other
lakes are retired or rewritten.

**2. The year and local temperature.** The time of year is a smooth phase, the same for every player
at the same real moment: the real time (UTC) divided by 8 days. Picking a season in the World
panel sets the phase (for photos and tests). Each place has a yearly mean temperature (from its
climate and height: the felt height already in use) and a seasonal swing (larger inland and in
cold country, smaller near water). Its temperature on a day is the mean plus the swing times a
yearly curve. **Warmer regions**: the climate's cold field gains a warm side, far from home: warm
and wet is evergreen lush country, green all year; warm and dry is Mediterranean, golden in
summer drought and green in winter rain (the opposite of the cold country's rhythm).

**3. Season effects from local temperature.** Snow cover where it is below freezing and moist; lake
ice only after some weeks of cold (the temperature a while back), so ice lags the first frost and
lingers into spring, each lake its own; leaves turn as it falls through about 10 degrees and drop
below about 3, earlier up high and in the cold; blossom as spring warms through about 8 degrees,
later up high (about 4 days per 100 ft is the rule of thumb); flowers where it is warm enough and
not in summer drought; grass browns in the cold and golds in drought. The ground and grass carry
each spot's mean and swing, and the shader works out the day's look from a phase uniform, so
nothing is rebuilt as the days pass; trees are recoloured now and then from their own local
phase; each nearby lake's water sheet gets its own ice. Skating, ice fishing and the ice dance go
by the lake's own ice. The home lake must still freeze in midwinter (the skipper's pine cones,
the skating dance).

**4. Weather moving over the land.** A field, a function of position and real time (UTC) and the
seed, so all players in a world share it: broad cloud noise drifting with a prevailing wind from
the west and slowly changing as it goes; rain where it is cloudy enough, more readily in wet
country and on slopes facing the wind (less in their rain shadow); snow instead of rain where the
local temperature is near freezing (so summer peaks get snow showers); storms mostly on warm wet
afternoons; fog of a morning in low ground and over lakes, where cold air pools. You feel the field
where you stand, blended as you move: you can walk out of the rain, or watch a storm come in.
Picking weather in the World panel overrides it where you stand; Auto is the land's own.

**5. Then.** The World panel says what it is like where you stand ("Here: early spring, light
rain"); dark skies and rain curtains in the direction of a far storm come after.

## Plan: more biomes (asked 2026-11-22, not decided yet)

The owner shared a mood board of twelve biomes to add, saved as
[reference/biomes-moodboard.png](reference/biomes-moodboard.png): Verdant Plains, Enchanted Forest,
Cherry Blossom Valley, Snowy Highlands, Crystal Caverns, Golden Desert, Volcanic Wasteland,
Floating Islands, Coastal Isles, Mystic Swamp, Windy Cliffs, Aurora Tundra. It is a reference for
the look and the variety wanted, not art to copy.

Proposed approach (Minecraft-style): biomes chosen from a few broad fields that also shape the
land: temperature and moisture (have), distance from the sea (sea, coast, inland), ruggedness
(plains, hills, cliffs, mountains), and a rare "wonder" field for the fantasy ones; blended at
their edges. Proposed order, after seasons and weather (the warm regions are needed): (1) northern
lights and tundra details, Verdant Plains tuning, petals drifting in blossom valleys; (2) Golden
Desert, Mystic Swamp, Enchanted Forest; (3) Windy Cliffs with rivers and waterfalls; (4) Coastal
Isles with the ocean; (5) Volcanic Wasteland; (6) crystal grottos and floating islands as rare
wonders. The ground is a height map, so caves and overhangs need separate pieces (crystal
grottos instead of caverns; floating islands as their own meshes).

Open questions put to the owner: whether the fantasy biomes (floating islands, crystal caverns,
glowing forests, lava) come in as rare wonders or not at all, given the "follow natural laws"
direction; whether the buildings in the pictures (castles, ruins, pagodas, huts, windmill, ships)
stay out for now, as decided for manmade things, or ruins only are allowed; and the order.

## How nature shapes the land (after milestone 4d, step 1)

The owner asked for terrain, climate and plants that follow natural laws, and left the choice of
rules to us ("pick whatever is good for our world"). Four, each a pure rule of (seed, x, z), from
research into how it is done (a report on the methods was written for the owner; the chosen ideas
were the cheapest with the most to show, plus Minecraft-style biomes the owner asked for):

- **Worn mountains** (`land()` in core/shape.js, `EROSION`): the mountains' fine relief shrinks by
  1 / (1 + EROSION * slope^2), the slope being that of the broad mountain shape beneath it (from
  `fbmD`, noise with its slope, which gives the very same values as `fbm`). Steep flanks come out
  smooth, ridges and flats keep their detail. Only the mountains change.
- **One temperature: treeline, alpine meadow, rock, snow.** `feltHeight` is the height a spot feels:
  its height, + `TREE_COLD` m times the country's cold (`coldBase`), + `ASPECT` m per unit of
  north-facing rise (north is -z). Trees thin, shrink and turn to pines over the 16 m below
  `TREELINE` (64 m felt) and stop there; grass runs on; bare rock from 6 to 34 m above it; snow by
  `coldAt(x, z, h + ASPECT * north)`, so north faces hold snow far longer than south faces.
- **Country from temperature and moisture** (as Minecraft and the Whittaker biome chart do):
  `moistAt` is the rain, raised near a lake in dry country (never past middling); `snowCold`
  lowers snow where it is dry, for snow needs moisture: cold and dry is tundra (tawny ground and
  sparse grass, open pine woodland), cold and wet keeps deep snow and thick pines. Lakes still
  freeze by temperature alone. Blossom groves keep to mild country by temperature.
- **Scree**: `slopeLook` gives `scree` where a slope of about 22 to 40 degrees has a cliff 9 to
  15 m above it; the ground there is grey gravel, grass is thin, and up to 40 small stones a
  square (too small to block) are added after the boulders from the same stream.
- **Same at every scale:** aspect and scree are measured over fixed distances (8 m; coarse tiles
  reuse their own neighbours, about as far apart), so snow and scree do not jump as tiles refine.
- **Cost:** building a mountain ground tile takes about 1.9 times what it did (about 5.5 ms against
  3); tiles are built a little each frame, so this slows streaming in the mountains, not frames.
- A test (`nature: trees give out...`) checks the treeline, north faces, tundra and water.

## How the shrine works (milestone 4c)

- **Sites** come from the land (`core/shape.js`, "Shrines"). `homeShrineSite()` is the most
  level place back from the home lake, facing the water: about 100 m from the lake's middle in
  gentle country, and as far as it takes where the home lake lies among steep hills (seeds 3 and
  7: 485 m and 328 m). The rest of the land is ruled into 640 m squares; a square has a site if
  one of 14 tries in its middle half is a blossom grove (`groveAt` at least 0.6) on low, snowless
  ground that rises or falls less than 5 m round it, clear of every lake. About one square in
  ten: over seeds 1 to 12, three to twelve sites within 3 km of home (usually six to eight), the
  nearest grove site about a kilometre or two away. No two sites are nearer than 320 m. A grove site faces the lowest ground about, so its path climbs to it.
- **Level ground.** `height()` is `rawHeight()` (the land as the seed gives it) with the ground
  under each site made flat for 25 m and eased back into the land by 46 m. Sites are chosen from
  `rawHeight` only, and never where the levelled ground would touch a lake's own (its bowl, shore
  and path): there `height` and `rawHeight` are the same, which a test checks.
- **Clear ground.** `clearingAt` keeps trees, boulders, small plants and flowers off every site
  (24 m); `onShrineGround` keeps grass off the hall and the stone path of every site. Both go by
  the land's sites, not by where the shrine stands.
- **One shrine** (`world/shrine.js`): built once on flat ground at the origin, then set down
  whole (`setDown`): the group's place and facing, its blockers (the same objects, moved), its
  lantern light, its falling petals. `shrineNear(x, z)` puts it at the nearest site within 900 m:
  at once at load and on arriving by the Places list; while walking, only when the place it
  stands is more than 145 m away (it is not drawn beyond 115 m, so it is never seen to move).
- The shrine keeps no state of its own. Naming shrine places and listing them comes with the
  places journal (4d).

## How the flowers you pick work (milestone 4c)

- `growPicks(ix, iz)` in `world/wilds.js` gives the flowers of one 57.6 m square, from the seed
  and the square's place alone (its own random stream, so nothing else moves). Three sorts: a few
  in patches in any open country (70 tries a square; fewer in woods and on the heath); a meadow
  of them within 2.4 radii of a lake (1100 tries for a square that reaches one; a wild lake's
  meadow is thinner than a settled one's); and **drifts** of one kind beside a lake's path and on
  its bank (`driftsOf(lake)`, about 40 for a lake the size of home, kept on the lake). None under
  snow, on sand, on a path or in a clearing.
- Every flower has a name it keeps: `ix:iz:try` for the scattered ones, `lake:dN:m` for a drift's.
  A rejected try still takes its draws, so names never shift.
- Only the squares closest to you (the same tier as bushes and ferns) hold their flowers.
  `features/flowers.js` keeps that list, leaves out the ones the season has taken (`keep` against
  the season's share) and the picked ones, and hands the rest to `world.drawPicks`, which fills
  fixed slots (`buildFlowers` in `world/vegetation.js`; 1000 of a kind, the worst measured is
  about 700 round the biggest lakes).
- A picked flower is remembered by name with the time it was picked, until it has grown back
  (four minutes), so it stays picked while you are away. This is not saved across a reload.
- `picksNear(x, z, r)` (on the test handle as `wilds.picksNear`) answers by rule, whether or not
  the squares are loaded; `tools/seeds.mjs` uses it to check each world starts with flowers.
- Kinds are still the same seven everywhere; kinds by country come with the flower journal (4d).

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
