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
  wild; the shrines in blossom groves stay. (Amended the same day: buildings that match their
  biome are welcome, see "Plan: a fantasy world of biomes"; out-of-place things stay out.)
- **Calls made overnight 2026-11-22 (ours, the owner asked us to decide, as other games do):**
  - Settled lakes are switched off rather than deleted (`?settlements=1` keeps their tests).
  - The home lake still freezes in midwinter (about 4 in 10 of the year), so the skipper's pine
    cones and the skating dance still come; the skipper asks for cones whenever fewer than about a
    third of the flowers are out where you are.
  - Weather spells: banks 6 km across, wind 3 m/s, so rain comes in spells of minutes to an hour or
    two (like the gentle weather cycles of cosy games), not days. Fog goes by the time of day where
    you play (your clock), since day and night do.
  - Tests are held at summer unless they ask for a season (the year turns every 8 days).
  - Biomes and buildings: buildings are rare enough to be finds (one castle in about 7 km2); the
    start (450 m round home) is always ordinary country; the floating islands and grottos sit in
    the enchanted wonder pockets, the volcano in the other kind.
  - Characters: the CC0 KayKit Adventurers pack was tried overnight behind `?hero=kaykit`; the owner
    turned it down the next morning; the VRoid characters replaced it, and were later removed too (see "Characters" below).
  - The backpack starts with a tent and 8 lanterns (places you make need them).
  - The sea: never within 2 km of home, so every start is inland by a lake; about 5% of world 1
    within 6 km is sea, the nearest coast some 2 km from home. You cannot wade or swim (the shore
    stops you, as at the lakes); no fishing at sea yet.
  - Rivers and waterfalls were left out that night (they came later, at the owner's asking: see
    "Rivers and waterfalls" below). Islands in lakes were left out too (the lakes are small, and the boat only tours the home lake).
  - Animals: no CC0 rigged deer or fox could be fetched without a browser, so, as told ("whatever is
    best available"), the fox is made in code like the deer and owl; rigged ones can replace them later.
- **Worlds and carrying (2026-11-22):** seeds as in Minecraft: any text is a seed, the same text
  the same world, a new player gets a random one. The backpack is a real inventory of slots
  (flowers, later tools and other things); bouquets are tied from flowers in it.
- **No winter clothes (2026-11-22):** the owner had the winter costumes removed: the children wear
  their usual clothes all year. (The skating dance now asks for cold country, not winter clothes.)
- **Testing:** run only new or affected tests after a change; full runs when asked, at 4c, and
  before merging to `main`.
  Last full run: 2026-11-22, after the sculpted children were redrawn and VRoid removed: 60 passed, 0 failed.
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
| 4d | **More to discover, and a backpack.** Build order: (1) backpack, compass and named places, and the random saved seed (done); (2) flowers picked anywhere with a flower journal, fish by country; (3) skating and ice fishing; (4) places to find; (5) places you make; then the places journal and the postcard album. Glowing stone circles on hilltops; a giant old tree ringed with glowing mushrooms; summit cairns with a bench and a view; hot springs in snow country to sit in; pitching your own camp; lanterns lit as trail markers; skating and ice fishing on frozen lakes; fish and rare flowers by kind of country, with a flower journal; a compass and named places. A backpack holds what you carry (rod, creel, flowers, cones, lanterns, tent). | Each place is pure in seed and position and drawn from fixed slots. | done overnight 2026-11-22 (see "How the biomes, buildings and places work"): flower journal, fish by country, skating, places found with a journal and postcards, camp and lanterns; the giant old tree is the enchanted wood's giants ringed with glowing mushrooms |
| N | **Seasons and weather by place** (2026-11-22; see "Plan: seasons and weather by place"). (1) Away from home, lakes are wild. (2) A game year of 8 real days, and each place's temperature through it; warmer regions. (3) Snow, ice, leaves, blossom and flowers from that local temperature. (4) Weather as a pattern moving across the land with the wind, the same for everyone in a world. (5) The World panel says what it is like where you stand; distant storms later. | Pure in seed, position and time; nothing rebuilt as the days pass. | done (see "How seasons and weather work") |
| 5 | **Travelling.** Companions keep up over long distances; finding places again (builds on the compass). | | done: companions come with you when you travel; the journal's places found have a Go button |
| 6 | **New characters and animals.** Starts with one imported model walking, shown to the owner before any action is rewired. New animals by kind of country (deer, foxes, owls) wait for this. | | started: the characters are the sculpted children, redrawn after the owner's character sheets (KayKit and then the VRoid characters were tried and removed by the owner).  Animals: a fox by country added and the deer travel with you, made in code (no CC0 rigged deer or fox could be fetched without a browser) |
| 7 | **Performance on real devices.** A view-distance setting; tuning on a real GPU and a phone. | | view distance setting done (near, medium, far); tuning on the owner's GPU and a phone needs the owner |
| 8 | **Water and ways** (planned, not started; each needs new terrain work), cheapest first: an **ocean** (the land formula gains a continent shape; land below the one water level becomes sea, with beaches); **trails** between neighbouring settled lakes, flattened into the ground, with signposts; **islands** in big lakes (needs the boat to steer or to have a second stop); **rivers and waterfalls** (hardest: a river is carved along a route from lake to lake or sea, and the carving must agree across tiles). | | ocean done (coast, islands, beaches, palms, beach huts, ships); trails with signposts done; rivers and waterfalls done (see "Rivers and waterfalls"); islands in lakes not done |
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

## Plan: seasons and weather by place (decided 2026-11-22, built the same night)

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

## Plan: a fantasy world of biomes (decided 2026-11-22; most built overnight, see the next section)

The owner shared a mood board of twelve biomes, saved as
[reference/biomes-moodboard.png](reference/biomes-moodboard.png) (a guide to the look and variety,
not art to copy): Verdant Plains, Enchanted Forest, Cherry Blossom Valley, Snowy Highlands,
Crystal Caverns, Golden Desert, Volcanic Wasteland, Floating Islands, Coastal Isles, Mystic Swamp,
Windy Cliffs, Aurora Tundra. Owner's decisions:
- **A fantasy world.** All twelve come in, fantasy ones included. Natural laws still shape the
  ordinary land (climate, treeline, snow, erosion); the fantasy is layered on top, by rule.
- **Buildings that match their place are welcome:** a castle on a highland crag, ruined arches on
  the plains and in the desert, pagodas in the blossom valley, huts on stilts in the swamp, a
  windmill on the windy cliffs, beach huts and ships on the coast, a sky city on floating islands.
  What stays out is the out-of-place: lamps, benches and jetties at wild lakes (decided earlier).
- **Made in code, not downloaded:** models are built in three.js from code, as the shrine, the
  great cherry (world/proctrees.js), the flowers (world/detail.js) and the children already are,
  using the techniques studied in Lumen Isles (the webgl2-world-kit skill: cut-out leaves in the
  shader, glow, waterfalls, a cloud sea, particles, bloom), adapted to three.js r128.
- **Order:** ours to choose (below).

**How biomes are chosen (as Minecraft does).** A few broad fields of (seed, x, z) that also shape the
land, so landform and biome always agree: temperature (with the warm side from the seasons plan),
moisture, continentalness (sea, coast, inland; with the ocean), ruggedness (plains, hills, cliffs,
mountains), and a rare "wonder" field for the fantasy places. A table of biomes, each a region of
those fields, blended at the edges. Each biome is one entry in a registry: its ground colours and
textures, its plants (kinds, density, spacing), its rocks, its small things, its structures (by
site), its ambience (particles, fog, sky tint, glow at night, sounds) and its weather leanings.
Existing country (meadow, heath, lush woods, groves, snow, taiga, tundra) becomes entries in it.

**How things are made.** A kit of generators, each seeded so every copy differs a little: trees by
kind (giant old trees, willows, palms, wind-bent pines), cacti, crystals, glowing mushrooms and
lotus, rocks, arches and mesas; and building parts (walls, towers, roofs of several styles,
arches, stairs, stilts, sails, windmill sails) assembled into structures. Built once per variant,
merged, drawn from fixed slots like the plants (or set down whole like the shrine); far ones as
cards or simplified shapes. Glow uses the existing night-glow and bloom. Structures stand at sites
fixed by the seed, on ground levelled for them (the shrine's method), kept clear of plants.

**Order** (foundations first, then quick wins, then new kinds of land, the hardest last):
1. **Foundations:** the biome fields and registry (existing country moved into it), the warm side
   of temperature, and the generator kit with its first pieces.
2. **Seasons and weather by place** (planned above), now reading the biome fields.
3. **Glow and sky:** Aurora Tundra (northern lights over cold country, ice shards on frozen lakes),
   Enchanted Forest (rare old-growth: giant trees, hanging moss, glowing mushrooms and small
   crystals, fireflies), Cherry Blossom Valley (petals drifting across the valley, pagodas).
4. **New climates:** Golden Desert (wind-shaped dunes, cacti, sandstone mesas and arches, ruins,
   heat shimmer), Mystic Swamp (shallow pools, willows, mist, glowing lotus, huts on stilts),
   Verdant Plains (open grassland, lone trees, a castle on a hill, ruined arches).
5. **New land shapes:** rivers and waterfalls; Windy Cliffs (stepped plateaus and sheer drops, a sea
   of cloud below as in Lumen Isles, wind-bent trees, a windmill); Snowy Highlands (cliffs, frozen
   waterfalls, an ice castle).
6. **The sea:** Coastal Isles (ocean, beaches, clear shallows, palms, sea arches, beach huts, ships).
7. **Fire:** Volcanic Wasteland (a volcano cone with a crater, dark basalt, glowing lava channels
   you cannot walk into, ash and smoke, a ruined aqueduct).
8. **Wonders:** Floating Islands (rock islands with waterfalls pouring off, a sky city; a way up to
   be designed: wind currents, a glider, or stepping stones) and Crystal Caverns (the ground is a
   height map, so no real caves: open crystal grottos, and cave mouths leading into a separate
   interior).

**Risks.** Code-made buildings must reach the mood board's charm in the game's low-poly style: show
the owner each new kind of piece early. Draw cost: biome edges, glow and far structures need
budgets checked on the owner's machine. The scope is many milestones; each lands playable.

## How the biomes, buildings and places work (built 2026-11-22, overnight)

- **Biomes** (`core/biome.js`, functions in `core/shape.js`): `biomesAt(x, z, h)` gives desert,
  swamp, enchanted and volcanic weights from the broad fields (temperature with its warm side,
  moisture, ruggedness `rangeAt`, the rare `wonderAt` field: two kinds of pocket, a and b), none
  within about 450 m of home. The ground carries them in a `look` vertex attribute and shows rippled
  sand, dark peat, blue-green moss with glowing specks at night, black rock with lava cracks (no
  snow lies on it). The grass keeps off sand and thins in the swamp. The wilds: no woods in the
  desert, giants (a new family grown in code, 1.7 times the size) in the enchanted wood, willows (also
  new) in the swamp; `growBiome` per near square gives cacti, crystals, glowing mushrooms, still
  pools and lotus (`world/biomethings.js`, made in `world/makers.js`). Fish by country
  (`features/fishing.js countryOf`): the old fish lean to their country, and five new ones live only
  in theirs (Arctic char, desert pupfish, bowfin, moonlit glowfin, ember carp). In world 1 within 6 km:
  desert about 6% of the land, swamp 3%, volcanic 2%, enchanted 1%.
- **Sky**: the northern lights over cold country on clear nights (`world/sky.js auroraSky`);
  petals drift in blossom groves; fireflies in the enchanted wood in any season.
- **Building sites** (`SITE_KINDS` in `core/shape.js`): one or none to a square of each kind's
  size, each kind by its own rule, on ground levelled for it (`height()`), clear of lakes, shrines
  and the start, and kept clear of plants (`clearingAt`): pagodas (blossom groves), castles (mild
  hilltops), ruins (plains; sandstone in the desert), stilt huts (swamp), windmills (open rises),
  stone circles (hilltops, runes glow at night), summit cairns (with a bench), hot springs (snow
  country, steaming, to sit in), ice castles (snowy heights), crystal grottos (a basin sunk 6 m, in a
  wonder), floating islands (a wonder in the hills: an updraft lifts you onto the main island, its
  edge stops you, glide back down from its middle), and the volcano (a 160 m cone with a crater and
  a lava lake, raised in a volcanic wonder, smoking). World 1 within 5 km: 17 ruins, 14 springs, 12
  cairns, 10 windmills, 9 castles, 9 pagodas, 8 ice castles, 4 grottos, 3 stilt huts, 3 floating
  islands, 2 stone circles, 2 volcanoes. Buildings are made in code (`world/buildings.js`), a few
  variants each, copies sharing their geometry, set down at the nearest sites (`world/landmarks.js`),
  with blockers round their footprints and seats where there are seats.
- **Places found** (`features/places.js`): coming within reach of a lake, a shrine, a building or
  your camp finds it (per world, `store.found`); the journal lists them with a Go button (that is how
  you find places again: milestone 5); a photo near one also makes a postcard for the album (the last
  30, in the journal). When you travel, your friend (walking with you) and following dogs come too.
- **Places you make** (`features/camp.js`): the backpack starts with a tent and 8 lanterns. Pitch the
  tent from the backpack (one camp a world, on the compass and in the journal); set lanterns down to
  mark a trail (they glow at night) and pick them up again (E).
- **Skating**: on ice you gather speed and glide on (`characters/player.js`). Ice fishing was there.
- **Trails** (`trailAt`, `trailEndsNear` in `core/shape.js`; milestone 8): each place (the home lake,
  the shrines, the buildings) is joined to its nearest neighbour within 1.4 km by a worn path that
  wanders a little and keeps off lakes; bare earth on the ground, no trees or grass on it; a
  signpost where a trail leaves a place names the place at its other end and how far
  (`world/signposts.js`). Islands in big lakes were left out (the boat only tours the home lake).
- **Verdant plains** (`plainsAt`): broad, mild country, neither wet nor dry, out of the hills; the
  land there lies flatter and the woods thin to lone trees. About 7% of world 1's land.
- **Windy cliffs** (`cliffsAt`): in mild foothills the hills rise higher and step into plateaus about
  16 m apart with steep risers (`terrace` in `land()`), kept below the snow; standing high in that
  country you see a sea of cloud drifting in the valleys below (`world/cloudsea.js`, one soft
  layer at 26 m following the camera). Windmills take to the cliffs. About 4% of world 1's land.
- **Flower journal**: each kind picked, how many, and the country where first found.
- **View distance** (Settings): near (about 0.7 km of land), medium (1.4 km), far (2.3 km).
- **Characters** (decided 2026-11-22): the owner turned KayKit down, then had VRoid's seven sample
  avatars tried, and finally removed them ("Remove Vroid"). You and your friend are the sculpted
  children (`characters/kid.js`), reshaped after two character sheets the owner supplied: an oval head
  on a neck, big eyes with a two-tone iris and lids, a face that stretches when smiling, tapered brows;
  baggy trousers with rolled cuffs, chunky sneakers, a hood, a backpack. Hair is a few big, separate
  flame-shaped pieces with dark edges (a width t^a (1-t)^b with a belly, its width shifted to one side
  of a spine that curves once, tightening to the tip), turning one way round a whorl on the crown;
  every loose piece is a weight on its own spring, lagging, hanging, and kept out of the head, the
  shoulders and the hood. Cloth, hair strands and the iris have detail drawn by the shader and faded
  by its size on screen (an idea from the film crimson-loong; its code was not used). No settings
  choice of character.
- **Pets** (2026-11-22, the owner: "redesign pets after the sheets"): the dogs and cats are sculpted as
  the children are, in their chibi style (`makeDog` and `makeCat` in `characters/rigs.js`): a big round
  head, a small plump body, short legs with white paws. The first dog is the sheet's puppy (cream with
  ginger ears and a patch over one eye, tongue out, a red bandana with a white paw print), the first cat
  the sheet's calico (white with orange patches, pink inside its ears, a dark collar with a gold bell);
  the others are the same shapes in other coats. Same rigs (head, four legs, tail, eyes), so all their
  behaviour is unchanged. `tools/studio/pets.html` shows them beside the boy.
- **Rivers and waterfalls** (2026-11-22, the owner: "add rivers and waterfalls"; `core/shape.js`
  "Rivers", `world/rivers.js`). The land is ruled into 800 m squares; about 85% hold a spring, on the
  highest of a few spots in the square that is at least 10 m up. From it the water is traced down the
  land's slope in 6 m steps, carrying on a little the way it was going; caught in a hollow, it is
  routed out over the hollow's lowest rim, as water would fill it and spill (a flood outward over
  10 m squares, within 300 m). A river is kept only if it reaches a lake or the sea within 2 km, and
  only if it keeps clear of the home neighbourhood (450 m), the shrines' and buildings' ground, the
  volcano and the settled lakes. Its water level never rises, stays 0.15 m below the land along its
  middle and below both banks, and may cut through rises of up to 9 m. Where it runs steeply it goes
  down in steps: a lip, a fall of up to 3.2 m, a pool cut into the slope below. Each river comes from
  its own square alone, so it is the same whichever way you come (the world's fingerprint near home
  is unchanged); the rivers that could reach a spot are worked out the first time the ground there is
  asked for (about 50 ms for a new 800 m region, 1 ms for a neighbouring one) and kept.
  The ground: the land is cut down to the river's bed (0.35 m under the water in its middle) with
  banks rising gently from the water's edge (steeper by the falls), pebbly sand on the banks, no
  trees, grass or flowers in the water or on the bank. You and the animals can wade across (it comes
  to the boy's knees); falls are too steep to climb, as cliffs are.
  The water: a ribbon along each river within 1 km, on its water level, drifting downstream, taking
  the sky as the lakes do, with lace along the banks; on a fall, white streaks pouring down over the
  darker water, its edges thinning to spray, foam in the pool below and soft clouds of mist at its
  foot. Further off, the coarse ground shows the river as water. In cold country a river freezes in
  winter as its lakes do (our call: frozen, not gone).
  Seed 1 has about 70 rivers within 6 km of home, most 200 to 900 m long, 30 of them with falls; the
  nearest is about 480 m from home, a mountain stream stepping down into a lake. Not done: rivers
  between lakes (every lake lies at the same level, so water cannot run from one to another), fishing
  in rivers, bridges where trails cross them.
- **The skipper** (2026-11-22, the owner: "redesign the skipper"): drawn as the children are
  (`KIDS.skipper` in `characters/kid.js`, a little taller): an old boatman in a green knitted coat, a
  mustard scarf, dark trousers and boots, short grey hair under his straw hat, a white moustache and
  chin beard, smaller eyes and a round nose. Sculpted at 60% of the children's detail (he is mostly seen
  far off on the boat): about 53,000 triangles. `tools/studio/kid.html?view=skipper` shows him.
- **The sea** (`seaAt`, `SEA_DEPTH` in `core/shape.js`): a continent field, broad as the climate's,
  sinks the land under one sea at the lakes' level (0); lowland goes under first and hills stand out
  as islands and headlands. Sand where land meets sea (`beachAt`, shown through the desert's look),
  palms on it (`world/makers.js palm`), nothing else growing there; huts on stilts on mild beaches
  and ships at anchor offshore (`SITE_KINDS` beachhut and ship, `world/buildings.js ship`). The
  water is the lakes' shader on one wide sheet that follows you when the sea is near (`world/water.js`),
  drawn only where a mask of the sea field says there is sea, so lake bowls keep their own water.
  Travelling to a spot at sea (a ship found) lands you on the nearest shore, facing it.
- **Kinds of country** (`ui/countries.js`, the World popover): every biome (16 kinds: the mood
  board's twelve and the ordinary country) with the distance to the nearest stretch of it, searched
  outward from you to 6 km (about 30 ms), and a Go button that takes you there (the wonders: to just
  off the site, the volcano to the foot of its cone).
- **Wind-bent trees**: on the windy cliffs the trees lean, all one way, more where it is windier.
- **A fox by country** (`features/wildlife.js`): red in mild country, white in the snow, a big-eared
  fennec in the desert, none in the volcanic country; at the lake you are at, trotting, sitting,
  slipping away when you come close. The deer now come to the lake you are at too (none in the
  desert). Both made in code, like the owl and heron.
- **Left for later** from the mood board: rivers and waterfalls (frozen ones too), hanging moss, dunes, mesas and
  sea arches, a sky city on the floating islands, cave interiors. See the milestone table.

## How seasons and weather work (built 2026-11-22)

- **The year** (`core/year.js`): a phase, 0 midwinter, 0.5 midsummer, the same for every player at
  the same real moment (UTC), one year every 8 real days. A picked season holds the phase at its
  middle (`?season=` too; tests are held at summer unless they ask, `tests/helpers.js`).
- **Chill** (`coldAt`): each place's cold in summer, from its country (`coldBase`, now with a warm
  side to -`WARMTH`), its height and the way it faces. Today's chill is
  `chillNow(c, s) = c + s * swing(c)`, `s` the season value (0 midsummer to `WINTER_CHILL` 0.75
  midwinter), `swing` smaller in warm country. Snow (`snowFrom`), lake ice (`iceFrom`, from the
  season `ICE_LAG` back), flowers (`flowersOut`: late in spring, early in autumn) and leaves
  (`leavesAt`) all follow it. The same formula is in GLSL (`SEASON_GLSL`, uniform `seasonU`) for
  the ground and grass, so nothing is rebuilt as the days pass.
- **Who reads what:** the ground and grass, spot by spot (the ground's seasonal snow is its drifted
  snow, through `SNOW_AMOUNT`; its permanent snowfields are as before; far lakes painted in the
  ground freeze too; warm country golds in its summer drought); trees each by their own `chill`
  (recoloured when their state changes, checked every 5 s); flowers to pick each by their square's
  chill; lily pads per lake; each lake's water sheet `lakeIce(lake)`; the home lake's ice waits for
  the boat (`seasonState.ice`). Where you stand (`features/seasons.js readHere`, twice a second):
  `winterHere` (with separate in and out chills), the snow on trees, rocks and things
  (`coverFloor`), the share of flowers out (`flowerFrac`), the leaves, insects, falling leaves or
  petals, the grass tint, clothes, music; the snowman by the home lake's own winter.
- **Weather** (`systems/weatherfield.js`): `weatherAt(x, z, ms, hour)`, pure. Banks of cloud 6 km
  across drift on a 3 m/s wind from the west (turned by the seed), reshaping over 90 minutes; rain
  where thick, more in wet country (`moistAt`) and on windward slopes; snow where today's chill is
  high; storms in warm air of an afternoon; fog of a morning in low ground by water, on some days.
  At home in summer: rain about a tenth of the time, in spells of about 10 minutes (up to 1.5
  hours), clear spells of about 1.5 hours, fog on about one morning in three. Auto weather samples
  it where you stand once a second and eases toward it; a picked weather overrides it.
- **The World panel** says how it is where you stand ("Here: mid autumn · rain · snow lies here").
- **Wild lakes:** `SETTLEMENTS` (`?settlements=1`) turns the settled lakes back on; off in the game.

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
