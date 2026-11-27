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
    "Rivers and waterfalls" below). Islands in lakes were left out too (they came later: see "Islands") (the lakes are small, and the boat only tours the home lake).
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
  Full run 2026-11-23, after rivers, islands, bridges, stones, the new pets and skipper, the sheet extras and the
  performance work: 61 passed, 3 failed, all three since fixed and passing by name: the shrine test assumed no lake
  shore differs from the raw land (rivers now cut their mouths into shores: it skips river mouths); the rod-for-a-
  bouquet test assumed every one of its twelve flower picks took (now it checks each and tries the next flower; it
  had failed about one run in five, the skipper rightly refusing a bouquet short of twelve stems); the seasons test
  timed out once clicking the World button (passed on its own).
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
| 7 | **Performance on real devices.** A view-distance setting; tuning on a real GPU and a phone. | | view distance setting done; tuned on the owner's own computer, 2026-11-23 (see "Performance"); a real phone not tried |
| 8 | **Water and ways** (planned, not started; each needs new terrain work), cheapest first: an **ocean** (the land formula gains a continent shape; land below the one water level becomes sea, with beaches); **trails** between neighbouring settled lakes, flattened into the ground, with signposts; **islands** in big lakes (needs the boat to steer or to have a second stop); **rivers and waterfalls** (hardest: a river is carved along a route from lake to lake or sea, and the carving must agree across tiles). | | ocean done (coast, islands, beaches, palms, beach huts, ships); trails with signposts done; rivers and waterfalls done (see "Rivers and waterfalls"); islands in lakes done (see "Islands") |
| M | **A map** (asked for by the owner, 2026-11-26): a screen opened with M showing the land you have explored, filling in as you walk, with the places you have found marked. | Explored land is kept per world; nothing unfound is marked (`tests/map.spec.js`). | done (see "How the map works"); its look is for the owner to judge |
| T | **Teleport points** (asked for by the owner, 2026-11-27; the owner took our picks): waystones, standing stones you wake and then travel to from the map; the lists that took you anywhere at once are gone from play. | Stones are fixed by the seed and change nothing of the land; a woken stone stays woken per world (`tests/map.spec.js`). | done (see "How travelling works"); the stone's look is for the owner to judge |
| L | **Seasons by latitude** (planned 2026-11-27, not started; see "Plan: seasons by latitude"). The endless world in lands 12 km north to south, each pole, equator, pole; the kind of year a place has follows its latitude, and the two halves of a land are half a year apart. | Pictures agreed by the owner before the build; every kind of country still findable; one full run of the suite; speed checked on the owner's computer. | built 2026-11-28 (see "How seasons by latitude work"); speed on the owner's computer not yet checked |
| W | **A world worth looking at** (planned 2026-11-28; see "Plan: a world with places in it"). Oceans, continents and islands; regions each with a heart, a composed place like Stillwater Meadow; each biome's own look after the owner's six pictures; rivers that grow and real waterfalls. | Pictures agreed by the owner before each change to the land; all the changes to the land shipped as one. | begun: the waterfall's look; continents and islands in the land (no crossing yet) |
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
- **From the character sheets, the rest** (2026-11-23): standing still a while, the children put their
  hands in their pockets as the sheets draw them: the boy's sink into his trouser pockets at his hips,
  the girl's into her hoodie's front pouch (its depth made to take them; her arm angles were solved for
  her hands to land inside it). And little marks pop up beside the head with each expression, as the
  sheets draw them (`characters/marks.js`): yellow dashes for joy, hearts for love, sparkles for
  wonder, "?" when thinking, red strokes when worried, a dark scrawl when cross, a tear-drop when sad,
  "z"s when sleepy; each bobs and fades in about 2.4 s, not again within 1.2 s, two made up front per
  head so the scene holds the same whatever faces are pulled.
- **Performance** (2026-11-23, milestone 7, on the owner's own computer: Intel Iris Xe integrated graphics,
  a 1080p screen; `tools/bench.mjs` measures fps, slow frames and draw calls per place and preset, uncapped,
  with a CPU profile (PROFILE=1) or as a slow phone (PHONE=1)). Found, by A/B in one page:
  - the frame is bound by the graphics chip: an empty scene is fast, a quarter of the pixels gives about
    a third more fps, and every draw call costs a fixed amount however small. Auto (which lowers the
    render resolution when frames are slow) holds about 47 fps at home at 1080p.
  - the presets' resolution was only a cap on device pixels per CSS pixel, so on an ordinary screen (one
    per one) Low drew every pixel High did and ran slower than Auto. Now Low draws 65% of the screen's
    pixels and Medium 85% (and their caps stay): Low at home 31 -> 43 fps, in the woods 35 -> 48.
  - fewer draw calls: the jetty, bench, lawn chairs and the boat's frame merged by material (a jetty of 27
    planks and posts is 4 draws, a chair of 17 pieces 1), the path lamps two instanced meshes, a pet's eye
    one mesh: about 720 draws a frame at home on High down to about 560. That alone did not move the
    frame rate measurably on this computer; it lightens the load elsewhere.
  - tried and taken out: a patch to three.js r128's instanced-mesh setup (it re-specifies every vertex
    attribute of every instanced draw, about 1,500 calls a frame here): the calls went, the frame rate
    did not change in an A/B, so it was not worth patching a library for.
  - as a slow phone (390x844 at 3x, CPU slowed 4x, but this computer's graphics): Low 40-47 fps, Medium
    34-40; running across new ground has hitches of about 110 ms. A real phone's graphics are untried.
  Left: the plants and trees are some 150 instanced draws of 2-10 copies each (a kit of many models),
  the largest share of the draws; fewer, bigger batches would need the vegetation reworked.
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
  foot (one draw per river; lit as the foam is, so grey at night). From the 4.8 m ground squares out
  the ground is too coarse to hold the cut bed, so it lies just under the river's water there (and
  beyond 1 km, where no water is drawn, shows it as water). A river freezes in winter when its
  middle's place would freeze a lake (our call: frozen, not gone), and then you walk on its ice. A
  spring on a brink does not pour off it into the air: a river begins below a drop taller than 6 m.
  Checked: seeds 1, 7 and the text seed "meadow" give 72, 41 and 68 rivers within 6 km of home (30, 6
  and 12 with falls; worked out in about 0.3 s each), none crossing a building's or shrine's ground;
  by day, at night and in winter; beside a cascade the frame rate is the same with the rivers shown
  or hidden. On seed 1 the nearest river is about 480 m from home, a mountain stream stepping down
  into a lake. Rivers meet in 3 places within 6 km of home; at one their levels differ by 1.6 m,
  leaving a small step. Not done: rivers between lakes (every lake lies at the same level, so water
  cannot run from one to another). (Bridges came later: see "Ways across water".)
  Fishing in rivers (2026-11-23, the owner chose it next): from a river's bank you cast a shorter line
  across it (up to 5 m), the float riding the river's own water, onto a calm stretch well inside its
  banks, not a fall and not frozen (by a frozen lake you may still fish a river that runs). A river is
  never deep, so the biggest, deep-water fish are not in it; trout and minnows love running water and
  the big still-water fish (carp, catfish, pike, koi) keep mostly to the lakes, and what is in it still
  follows its country, as at the lakes. The catch says "in the river".
- **Islands** (2026-11-22, the owner: "add islands in lakes"; `core/shape.js` "Islands"). About 70% of
  the wild lakes 20 m or more across have one (never home nor a settled lake, which the boat tours): a
  low mound 1.4 to 3.6 m high and a fifth to a third of the lake's radius across, its shore wobbling,
  set off the lake's middle (which stays a metre deep or more), with open water all round it (looked
  at all the way round; moved in toward the middle, or left out, if it would come near the shore). Sand round its edge and grass on top; one to three trees on it
  (pines in the cold); a few beds of reeds round it; foam where the water laps it. Ducks, lily pads and
  a cast line keep off it. You reach one only over the ice when its lake freezes (no swimming, and the
  boat tours only the home lake). Fixed by the seed from the lake's own square, from its own draws, so
  the lake itself, its other reeds and its lilies are as they were. Seed 1 has 9 within 3 km of home
  (of 61 lakes). Stepping stones lead out to each (see "Ways across water").
- **Ways across water** (2026-11-22, the owner: "add bridges and stepping stones"; `core/shape.js`
  "Ways across water", `world/crossings.js`). A wooden footbridge wherever a trail crosses a river (not
  over a fall): planks across, beams under them, posts and a rail each side, its ends resting on the
  banks and arching over the water. A line of flat stones from the shore nearest each island out to it,
  just above the water, close enough to walk without a gap. You walk on both as on the jetty (on a
  frozen lake the stones stand above the ice). Worked out from the river, the trails and the island
  alone, the same whichever way you come; drawn within 700 m. Seed 1 has 7 bridges within 6 km of home
  (spans of 6 to 10 m; most about a metre over the water, one 5 m up over a deep cut) and stones to
  all 9 islands within 3 km (5 to 19 m long).
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

## How the map works (2026-11-26)

The owner asked for a map and chose: a map screen you open (not a corner minimap), showing only
where you have been. Calls that are ours (the owner may overturn them): **M** opens it, as in most
games, so the music moved to **U**; land within 190 m of you counts as explored; the map's colours
are the country's in summer whatever the season; rivers are drawn, trails and bridges are not
(yet). (Travel from the map goes by waystones since 2026-11-27: see "How travelling works".)

- `systems/explored.js` keeps where you have been: the world in cells of 32 m, one bit a cell,
  gathered into regions of 32 x 32 cells (1,024 m square). `reveal(x, z)` marks the cells within
  190 m; the map's frame hook calls it when you have moved 16 m. The save holds it per world
  (`store.explored`, one of `WORLD_KEYS`): one short string a region (172 characters), so about
  200 characters per square kilometre walked.
- `ui/map.js` draws it. The picture is never saved: it is worked out from the seed like the land.
  Each region has a 256 x 256 picture (4 m a pixel) painted one cell at a time, only for explored
  cells and the cells within two of them, 6 ms a frame while the map is open, nearest the middle
  of the view first (about 0.2 ms a cell; 190 m round you is about 110 cells). A painted cell is
  never painted again.
- What hides unexplored land is a mask, laid over the pictures each time the map is drawn: a
  34 x 34 image per region (a dot a cell, plus a ring of the neighbours' cells), a cell showing in
  full when six or more of the nine cells about it are explored; the browser's smoothing as it is
  scaled up gives the soft, rounded edge. So walking on only adds cells and rebuilds small masks.
- A pixel's colour (`colour()`): water where the land (`rawHeight`) is below 0 (a lake by `lakeAt`,
  ice in frozen country; otherwise the sea, darker with depth); else the country's colour from the
  same fields the ground uses (`rainAt`, `coldBase`/`coldAt`, `snowOf`, `groveAt`, `biomesAt`), rock
  above the treeline and on steep slopes, sand by lakes and the sea, a river within a few metres
  (`riverNear`). Lit from the north-west by the slope, paler with height, and darkened a little
  where a 20 m contour crosses. `rawHeight` is used, not `height`, so buildings' levelled ground
  and the volcano's cone do not show in the relief.
- Over it: the places in `store.found` (a lake's name under its water; a mark and a name for the
  rest; your camp where it stands now), you as an arrow pointing the way the camera looks, north
  (up: north is -z) and a scale. Names that would overlap are left out, nearest the middle first.
- Drag to move, wheel or two fingers or the + and - buttons to zoom (0.03 to 1.4 screen pixels a
  metre), the target button to centre on you again (the map follows you until you drag it). A click
  on a place chooses it; "Go there" shows for home, your camp and woken waystones.
- `window.__meadow.map`: `open`, `cells`, `pending`, `marks`, `chosen`, `settle()` (paint all that
  is in view now), `colourAt(x, z)` (the colour drawn at a spot), `explored(x, z)`.

## How travelling works (waystones, 2026-11-27)

The owner asked for teleport points and said "go with your picks". The picks (ours: the owner may
overturn any): the points are **waystones**, a new standing stone found in every kind of country,
plus the home lake and your camp; you travel **from anywhere**, by the map; the old free jumps are
**gone from play** (the journal's and the map's Go for any found place, the World popover's Places
nearby and Kinds of country), kept only with `?freetravel=1` or `?debug` for tests and filming;
stones stand about **1.5 km** apart.

- **Sites:** `SITE_KINDS.waystone` in `core/shape.js`: one to a 1,500 m square (in its middle
  half, so never two close), on dry ground that rises or falls less than 5 m within 34 m, off the
  sea, over 2.2 lake-radii from any lake, off every river, 70 m clear of other buildings, and (as
  all sites) 600 m clear of home. No levelled ground (`flat: 0`), so the land, the rivers and the
  trails are exactly as they were; only trees keep 12 m off a stone. Because a stone's place
  depends on the rivers, `siteAt()` skips kinds without levelled ground when a river is traced.
  In world 1: 23 stones within 5 km of home, the nearest 1.1 km off, about 1.25 km between
  neighbours.
- **The stone:** `waystone()` in `world/buildings.js`, three variants: a leaning slab on a ring of
  small stones, a rune on each broad face. Two sets of runes: dark (glowing a little at night like
  the stone circles') and bright (`wayOn`), the bright ones and a glow shown only when the stone is
  awake (`world/landmarks.js` `lightWaystone`). Set down from a pool like the other buildings.
- **Waking and travelling:** `features/waypoints.js`. Within 4.5 m, E wakes a stone ("Wake the
  waystone"): it goes into `store.waypoints` (per world: `{ id, name, x, z }`), its runes light,
  a chime. At a woken stone E opens the map. `travelPoints()` gives where you may go: home (you
  arrive at the start spot), your camp, each woken stone (you arrive 2.6 m south of it, facing
  it). `travelToPoint()` fades the view out (0.38 s; not with reduced motion), moves you with
  `travelTo` (companions come), closes the map, chimes and fades back in. Not while you are busy
  (sitting, fishing, in the boat).
- **Names:** a stone has its own, by rule from its site: "Goldenford waystone", "Ravenmoor
  waystone" (`placeName`). A waystone is woken, not "found": it is not in the places journal.
- **On the map** (changed 2026-11-27 at the owner's word: "why can't I see waypoints on the
  unexplored map"): every waystone in view is marked, explored land or not; woken ones glow blue
  with their names, sleeping ones are dim (name when chosen). The stones are looked up a square
  at a time (`WAYSTONE_CELL`), 4 ms a frame while the map is open, nearest the middle first.
  Choosing a waystone offers **Track**; a woken stone, home or your camp **Travel there**. The
  header counts the stones awake.
- **Tracking** (the owner: "track means show in world, show that the player can move in that
  direction"): one thing at a time, kept per world (`store.track`). A gold marker hangs over it in
  the world with its name and how far it is; when it is out of view the marker sits at the edge of
  the screen pointing the way to turn. The compass marks it in gold, before everything but home,
  and the map draws a dashed line to it. It ends when you reach it (within 9 m; a sleeping stone:
  when you wake it) or with "Stop tracking" on the map. Only waystones can be tracked. The marker
  is hidden while a panel is open and in photo mode.
- **On the compass:** also the nearest stone still asleep within 1.5 km, as "Waystone".
- `window.__meadow.waypoints`: `awake`, `points`, `asleep` (within 2.5 km), `track`, `busy`;
  `__meadow.travelToPoint(point)`.

## Plan: a world with places in it (2026-11-28; planned, the land not yet changed)

### What the owner said

- "Currently the world feels so random."
- "We need to work on visuals, graphics and the math of generation." Six pictures to go by
  (kept outside the repo, in the owner's Downloads, 2026-11-27: Volcanic Ruins Beneath a Fiery
  Sky; Golden Oasis at Sunset; Aurora Over the Snowbound Fortress; Fantasy Tropical Isles and
  Skybound Castle; Enchanted Valley Castle Vista; Enchanted Cherry Blossom Valley).
- "Those images have man-made structures also, so I'm thinking these biomes can have something
  like Stillwater Meadow." **This amends the earlier rule** (no built things away from home but
  buildings that match their biome): each biome may now have a settled place of its own.
- "Grass and desert and snow and many need new texture, new trees, better colours, eye-catching
  sceneries."
- "In the real world ocean covers most part, so work on ocean, and since ocean is large we can
  think to design continents, islands."
- "Rivers and waterfall literally need better visual."
- "You can create any visual with code": textures, trees, structures and effects are all made in
  code; no packs.

### What the six pictures share (our reading)

Each is one composed place: a landmark on a height (castle, palace, fortress, pagodas, the
volcano); a tall waterfall off it into water in the middle of the scene; a small settlement by
that water with a bridge and a path in; a ruin in the middle distance; one distinctive peak on
the horizon; one strong palette (gold and violet; blue with warm windows; black and orange;
turquoise and green; pink and lavender; green and sky blue); warm lights; a sky with character
(two moons, aurora, ash, pink cloud).

### Why the world feels random (our reading)

Every feature is scattered by its own independent rule (biome patches, lakes, buildings,
waystones), so nothing stands in relation to anything else: no castle overlooks a lake, no fall
drops beside a village. Stillwater is the only composed place. Biomes blend and share similar
greens, so two kilometres on rarely feels like arriving.

### The plan (ours: every number and choice here is a pick the owner may overturn)

1. **Oceans, continents, islands.** One broad field decides land or sea; about 55 to 60% sea
   (less than Earth's 71%: open water is ground you cannot walk). Continents 4 to 8 km across,
   each named, with its own waystones and its own completion ("34% explored, 5 of 9 waystones"):
   these are the "small finite worlds" the owner wanted, with the sea as their border east to
   west. Home's continent is guaranteed, home inland by its lake. Coasts with bays, headlands,
   cliffs and beaches, and a pale shallow shelf before deep water. Islands in chains near the
   continents, each with one thing on it. **With the 12 km lands:** latitude is untouched; a
   continent simply lies across whatever belts it covers, and the sea changes by latitude too
   (pack ice toward a pole, turquoise lagoons and island chains at an equator).
2. **Crossing.** First, passages between harbours: find a harbour, and a skipper sails you to
   another you know of, as a short sailing scene. Free sailing in your own boat later. (Waystones
   alone cannot do it: you could never reach another continent the first time.)
3. **Regions with a heart.** Each belt of a continent in regions about 2 km across, each with one
   clear biome and one heart: a site with water, a height raised beside it for the landmark, a
   cliff cut for the fall, and the settlement, bridge, path and lights laid out from those. The
   rest of the region is the wild way to it, the landmark seen from afar. Waystones stand at
   hearts; trails join heart to heart; some coastal hearts are harbours. The settled-lake code
   (switched off, `?settlements=1`) is the starting point.
4. **Each biome's heart and look,** one at a time, cherry blossom first (pagodas, lanterns, the
   shrine and the blossom trees exist): snow (fortress on a cliff, frozen fall, cottages with lit
   windows, aurora); meadow (castle on a hill, windmill farm, ruined arch); blossom (pagoda town
   on terraces, arched bridge, stone lanterns); desert (domed palace over an oasis, tents, palms,
   crystals); tropical isles (thatched village with jetty and boat, lagoon, rock arches);
   volcanic (ruined arches and a stone bridge over lava, burning trees). For each: its own sky
   tint, fog colour and grade where you stand; a ground texture of its own; its own trees and
   plants; its structures as a kit.
5. **Rivers and waterfalls.** Shape: rivers that start as a brook and widen to 12 to 20 m, with
   tributaries, a valley, meanders, rapids; cliffs of 10 to 40 m for falls, most at hearts; lakes
   with outlets; an estuary at the sea. Look: water coloured by depth, ripples that follow the
   current, foam at banks and below rapids; a fall as layered sheets with wet rock behind, a
   plunge pool, mist, seen from far off and heard; frozen as icicles; lava from the same code.

### Order

All the changes to the land (continents, regions and hearts, the rivers' shape) go out together,
so discoveries are cleared once (`WORLD_GEN`), each after pictures the owner has seen:
(1) pictures of continents and islands from above; (2) regions and hearts on them; (3) harbours
and passages; (4) the biomes' looks, one at a time; (5) free sailing. What does not move the land
can be built and judged at once: the waterfall's and the river water's look (begun 2026-11-28),
the biomes' palettes and textures.

### The first pictures (2026-11-28, `tools/world-map.mjs`; for the owner to judge)

`e:/Games/_assets/previews/worldmap-1.png`, `-7.png`, `-42.png`: 30 km square, home in the middle;
left, land and sea; right, the regions' hearts, harbours and trails.

- A plain field of noise will not do for continents: at about half land it joins into one
  landmass without end (400 km2 and off the picture). So the sea is ruled into squares 9 km wide
  and each has one continent or none (one in seven is open sea): a middle pushed about in its
  square, a radius of 2.1 to 3.5 km, a coast bent by two fields of noise. Home's square always has
  one (radius 3.3 to 3.8 km), home 900 m off its middle.
- What came out, three seeds: 57 to 66% sea; continents mostly 14 to 28 km2 (4 to 6 km across),
  6 to 10 hearts each, a third to a half of them harbours; home's continent 39 to 103 km2 (it
  joins a neighbour in two of the three seeds).
- Known faults: the continents sit in rows and columns, like blobs on a grid (more pushing about
  and more varied sizes are the levers); two continents can draw the same name; islands show as
  sand-coloured specks; the land's own shape and the game's sea are not in the picture.

### Continents and islands in the game (built 2026-11-28, on "go with your picks")

The first step of the order above is built: the game's own sea (`core/shape.js` `seaAt`) is now the
continents' rule, and `tools/world-map.mjs` draws from the game's own functions (`seaAt`,
`rawHeight`, `continentAt`), so the picture is the land you walk. `WORLD_GEN` is 3: worlds visited
before have their discoveries cleared once more.

- **The rule.** Squares of `CONTINENT_CELL` (9 km), home's square centred on home and every other
  row pushed half a square along (so the continents no longer stand in rows and columns); in each,
  one continent or none (one in seven is open sea): a middle pushed up to a quarter of a square
  about, a radius of 2 to 3.5 km, a long way and a short way (up to 1.3 to 1) at a seeded angle,
  and a coast bent by noise. Home's square always has one, radius 3 to 3.5 km, home 800 m off its
  middle (no longer joined to a neighbour in the three seeds drawn). Islands rise from the shelf
  within about 1.3 km of a coast, a few more toward an equator.
- **The land under the sea.** Beyond the coast the land sinks to 26 m under, and now its hills
  and mountains sink with it (before, a mountain range stood out of the open sea), so only the
  islands stand out of it. Home is on land for 2 km whatever the seed.
- **Names.** Each continent has a name from its square (`continentAt(x, z).name`), never the same
  as another's within two squares. Nothing in the game shows them yet.
- **Cost.** The full sea is about 8 times the old one's noise (0.6 against 0.08 microseconds a
  call), and it is read under every height; so it is worked out once on a 32 m grid (blocks of
  2 km, the oldest dropped past 900) and read between. Measured in one page, 160 000 reads: old
  12 to 14 ms, new 5 to 12 ms (the first pass, filling the grid, included). The grid moves the
  coast by up to a few tens of metres against the full rule, everywhere alike.
- **Seen from afar.** Beyond the finest ground the land paints its low ground as water; for the
  sea it now lies under the sea's own sheet (3 km round you), so the sea runs to the horizon
  instead of ending in a straight-edged pale shelf.
- **What came out** (`worldmap-1-game.png`, `-7-game.png`, `-42-game.png`): 59 to 67% sea; home's
  continent 43 to 46 km2 (about 7 km across); the others mostly 16 to 58 km2, 5 to 17 hearts each;
  about 10 km2 of islands in each 30 km square and 150 to 170 scraps of land under 2 km2.
  In the game: `coast-0.png` to `coast-3.png` (`tools/coast-view.mjs`).
- **Not yet.** No way to cross the sea: waystones on other continents show on the map and can
  be tracked but not reached (harbours and passages are next, and must come before this goes to
  the live site). No pack ice on the sea toward the poles (the sea's sheet never freezes; far off,
  the painted sea does). The regions' hearts are still only in the picture.

### Decisions not yet answered by the owner

How much sea; how big a continent; how to cross first; names and completion goals per continent;
how big a region; which biome first; whether settlements have people in them (the pictures do;
the game has no villagers; until the owner says, none).

### To be straight about

The pictures are paintings and the game is low-poly on an integrated graphics chip (Intel Iris
Xe): composition, palette and light can be matched, the fine detail cannot, and every texture,
tree and see-through layer costs frames there, so each piece is measured on the owner's computer.

## How the rivers and falls are drawn (their look redone 2026-11-28; the land untouched)

The first piece of "a world with places in it" that needs no change to the land. Before: a flat
cyan ribbon with white stripes, lying on a grass slope. Now (`world/rivers.js`):

- **Calm water:** blue-green, deeper in the middle; it thins to nothing at its edges, so the bed
  shows through and the river has no hard border; ripples drawn out along the current; flecks of
  foam drifting, more below a fall and along the banks.
- **A fall's face:** white water in ropes running down, pale veins of the river's colour between;
  over it a second strip standing a little off the face (the falling sheet: clumps moving faster
  than the face, bellying out below the lip), so the fall has depth; foam churning in the pool
  below, further below a tall fall.
- **Mist:** puffs rising from the foot of each fall, swelling and thinning as they climb; more,
  bigger and higher below a tall one.
- **Rocks:** boulders down both sides of every fall (slabs up to about 1.7 m across the radius
  beside one dropping more than 4 m, so it runs through a rocky chute), a few at its lip and round
  its pool; stones now and then along the banks and in quick water. One shape, pushed in and out
  so no two faces match, one instanced mesh a river (a river with 19 falls: 386 stones, one draw).
  **For the eye only:** the land's height, where you may walk and the river's levels are as they
  were; you can walk through a rock.
- Everything is lit by the day as the lakes are (grey at night, not glowing), hazed and graded;
  a frozen river shows ice, and its falling sheet and mist stop. All of a river's pieces hang from
  its ribbon and are thrown away with it (geometries and textures held are the same after three
  far trips as after one).
- Cost, on the owner's computer (1920 x 1000, High, the frame rate uncapped, standing in the
  foot of a tall fall, the new pieces shown then hidden, three times over in one page): 55 / 57,
  57 / 62, 57 / 60 frames a second, so about 2 to 5 frames there, the worst place. Stills taken
  with the mist hidden show what it adds (a white haze over the foot); what the falling sheet
  adds does not show in a still (it is a matter of movement) and is not yet proved worth its
  cost.
- Still as it was, for the change to the land: rivers are 2.4 to 4.3 m wide from spring to mouth,
  and a fall is a steep ramp of the ground, not a cliff. Where a river meets a small lake, a pale
  flat sheet shows in the low ground beside the lake (there before this work; not yet looked into).
- `window.__meadow.riversView()`: each river drawn, with how many falls and stones.

## How seasons by latitude work (built 2026-11-28)

Built from the plan below, with the owner's "go with your picks" on the pictures (stripes
accepted; belt edges wandering about 900 m; the old patches adding half) and on the three
decisions (old worlds cleared once; the sun one for the whole world).

- **Latitude** (`core/shape.js`): `LAND` 12,000 m, home `HOME_SOUTH` 2,700 m south of a pole.
  `latitudeAt(x, z)` is 0 at an equator and 1 at a pole (home 0.55), with the wander
  (`latShift`: up to about `BELT_WANDER` 900 m broadly and 250 m finely, fading to nothing within
  1.5 km of home, so home's own year is exactly the calendar's). `beltOf(L)` names the belt.
- **What a place is:** `coldBase = clamp(latCold(L) + PATCHES * patches) * mild`, `latCold` from
  `COLD_BY_LAT` (-0.6 at the equator, 0 at home's latitude, 0.9 at the pole), `PATCHES` 0.5.
  `rainAt` leans a little wetter at the equator and drier in the subtropics. Everything that asks
  what the country is (`coldAt`, the biomes, the buildings' rules, the map) is as it was.
- **What the year does:** `yearAt(x, z)` gives a spot's year `{ A, m }`: `A = smooth(0.2, 0.55, L)`
  (how much the year moves it: nothing in the tropics, 0.6 at the subtropics' edge so no snow
  lies there in a mild winter, in full from home's latitude to the pole) and `m` (which
  half-year: 0 as at home, 1 half a year apart, changing over 600 m across an equator, where `A`
  is nothing). `core/year.js`: the season value there is `s + m * (0.75 - 2s)`, and
  `chillNow(c, s, y) = c + seasonHere(s, y) * A`; `snowFrom`, `iceFrom`, `flowersOut` and `leavesAt`
  take the year too, and "cooling or warming" flips with `m`. The old `swing` (warm country moved
  less) is gone: latitude does that now.
- **Who reads it:** trees and flowers to pick (`yearOf(it)`, kept on each), lily pads and each
  lake's and river's ice (`yearOf(lake)`), the weather's rain or snow, `readHere` for where you
  stand. The **ground** carries each vertex's year (attribute `yearly`: 8 more bytes a vertex);
  the **grass** shares the year where the camera is (`yearHereU`: its field is about 100 m
  across, over which the year hardly changes). One uniform still: `uSeason`.
- **The tropics' wet and dry season:** `wetSeasonAt`: it rains more in that side's summer
  (`systems/weatherfield.js`), and the grass and ground gold in the dry half (`droughtNow` in
  `SEASON_GLSL`: in the subtropics the drought is in summer, as before).
- **The season's name where you stand** (`seasonState.nameHere`, with `beltHere`, `phaseHere`,
  `seasonHere`): the four names by the half-year there; "Wet season" or "Dry season" in the
  tropics; none at a pole. The clock, the Here line, the pike and the season stamped on places
  found and postcards use it. `seasonState.name` is still the calendar's (home's).
- **Travelling at once** (`settleSeason`, from `travelTo`): the grass's tint, the insects and the
  snow lying on trees and rocks are as the season has them there straight away; before, a winter's
  snow rode with you into a summer for some minutes.
- **The sun** is one for the whole world, as before.
- **Old worlds** (`systems/save.js` `WORLD_GEN` 2, kept per world as `gen`): a world last visited
  under an older number has its position, places found, explored map, woken waystones, tracking,
  camp and lanterns cleared once (lanterns go back in the backpack), with a line saying the land
  has changed. What you carry, journals, pets and settings are kept.
- **What moved:** the climate beyond the mild ground round home, and with it where plains and
  cliffs shape the land, the lakes' looks, the buildings and so some trails and waystones.
- `tools/climate-map.mjs` drew the pictures the owner judged, from the proposed rule against the
  land as it then was; now that the rule is the game's, its "as it is" views show the new land.

## Plan: seasons by latitude (decided 2026-11-27; built 2026-11-28, see above)

**Why.** The owner: a player who wants spring in winter has to wait, which is annoying (the World
panel's season picker is a debugging tool, not for players); and in the real world seasons vary
by place, by latitude, and not every place has changing seasons. A sphere and a wrapped planet
were talked through and set aside ("forget about this"); the world stays endless and flat.

**Decided by the owner.**
- The endless world is divided into small finite worlds, each with its own north and south: "a
  lot of north-south".
- 6 km from pole to equator, so a land is 12 km north to south.
- The kind of year follows latitude, as on Earth, in five belts: polar (frozen all year),
  subpolar (long winter, short cool summer), temperate (four seasons), subtropical (hot summer,
  mild winter, no snow), tropical (no winter: a wet and a dry season).
- Home lies in a temperate belt.

**Ours (the owner may overturn any).** Where the belts' edges lie; how strongly temperature
follows latitude against the local patches; that the belts' edges wander a little; the formulas
below; the order of work. Every distance below is proposed, none measured.

### The rule

North is -z (the compass and the sun have it so). Let `d` be how far south a spot is of the pole
north of home: `d = z - (HOME.z - 2700)`. (`makeHome` does not read the climate, so anchoring to
home is not circular.)

- **Latitude** `L = |1 - (d mod 12000) / 6000|`: 1 at a pole, 0 at an equator; it repeats every
  12 km. Home is at `L = 0.55`.
- **Which half-year** `off = floor((floor(d / 6000) + 1) / 2) mod 2`: 0 where the year runs as at
  home, 1 where it runs half a year apart. It changes only at equators (d = 6, 18, 30 km...),
  never at a pole, so it repeats every 24 km: lands are mirror images of their neighbours, and
  the two sides of a pole are in the same season.
- **Belts** (proposed): tropical `L < 0.2`, subtropical to 0.4, temperate to 0.7, subpolar to
  0.87, polar above. From home that puts the subpolar belt about 0.9 km north and the pole
  2.7 km north; the subtropical about 0.9 km south, the tropical 2.1 km, the equator 3.3 km, and
  the middle of the other temperate belt (the opposite season) 6.6 km south.

### Two separate things: what a place is, and what the year does to it

1. **What a place is** stays `coldAt`: its own warm-season chill, which about twenty callers use
   to decide what exists there (snowfields, which trees, biomes, buildings' rules, lakes frozen
   for good, the map's colours). Latitude goes into `coldBase`:
   `coldBase = clamp(T(L') + 0.35 * patches) * mild`, where `T` runs about -0.6 at the equator,
   -0.3 at 0.3, 0 at home's 0.55, +0.3 at 0.75, +0.7 at 0.9; `patches` is today's noise field (so
   a cold valley can lie in a mild belt); `L'` is `L` with `d` shifted up to about 300 m by a
   slow noise, so a belt's edge wanders instead of running ruler-straight; `mild` keeps the
   country round home as it is. Rain may lean a little by latitude (wetter at the equator, drier
   in the subtropics, where the deserts are), the noise still deciding.
2. **What the year does** is on the season's side, never folded into `coldAt` (or half the map
   would draw as snow). Today: chill today = `c + s * swing(c)`, `s` the one season value
   (0 midsummer to 0.75 midwinter). New: chill today = `c + sHere * A(L)`.
   - `A(L)`, how much the year moves a place: 0 below `L = 0.15`, rising to 1 by 0.45, 1 from
     there to the pole (the pole is frozen by `c` anyway). This is what makes the tropics
     seasonless and the temperate belt the one with four seasons.
   - `sHere`: the other half-year's season value is simply `0.75 - s`, so
     `sHere = s + m * (0.75 - 2s)`, `m` going 0 to 1 across an equator over a few hundred metres
     (where `A` is 0, so the change is not seen).
   - "Cooling or warming" (`isCooling`, which leaves and flowers read) flips with `off`; lake and
     river ice use the lagged season value the same way.

### Who has to change

- **The ground and grass shaders** (`SEASON_GLSL`, `world/terrain.js`, `world/grassfield.js`).
  They keep the one uniform `uSeason`. `A` and `m` depend only on z, so the shader can work them
  out from the spot's own z with a few `smoothstep`s (the wander is in the baked cold, not here).
  No new vertex data should be needed: the ground's `clime` has three values and the grass map's
  four channels are full, so this matters. To be measured A/B on the owner's computer.
- **Things with their own chill** (`features/seasons.js`: trees, flowers to pick, lily pads; lake
  and river ice in `core/shape.js`; `systems/weatherfield.js` for snow or rain): each also keeps
  its `A` and `m`, worked out once with its chill.
- **Where you stand** (`readHere`): winter here, flowers out, leaves, insects, clothes, music.
- **Names of the season.** The clock label, the "Here" line and the season stamped on found
  places and postcards say the season where you stand: the four names in the temperate and
  subpolar belts, "wet season" and "dry season" in the tropical, none at the pole.
- **Tropical wet and dry.** In the tropical belt the weather field rains more in the half of the
  year that is that side's summer, and the grass golds in the dry half.
- **The sun.** Day length and the sun's height stay as now, one for the whole world (proposed:
  day and night follow the player's real clock, and a sun that changed with every few
  kilometres walked would be strange).

### What must still hold

- The home lake freezes in midwinter (the skipper's pine cones, the skating dance): home is in
  the temperate belt with a full `A`, and `mild` keeps its own ground as it is.
- Every kind of country stays findable (a seed sweep of the distance from home to each, before
  and after). Expect cold kinds to the north of home and warm kinds to the south, where today
  they are scattered.
- Weather stays a pure function of the seed, the place and the moment, the same for everyone.
- Nothing is rebuilt as the days pass.

### What it moves (the cost)

`coldBase` and `rainAt` are read by more than colours: the land's own shape (`plainsAt` and
`cliffsAt` flatten or step it), the lakes (beach, frozen, names), the buildings' rules, and so
the trails, and some waystones. Beyond the mild ground round home, **existing worlds change**:
places found, woken waystones, what is tracked, the camp, lanterns and the explored map can all
point at land that is no longer what it was. The save needs a number for the world's making, and
the owner a decision (below).

### Order of work

1. **Pictures first, no change to the game.** A tool draws the climate from above, old against
   new, for a few seeds, with the belts and home marked, and the seed sweep of distances. The
   owner judges by pictures; east-west stripes are the look at risk. Belt edges, the blend and
   the wander are tuned here.
2. **Climate by latitude** (`coldBase`, the lean on rain), the world's making numbered in the
   save, old saves handled as decided. Tests about where things lie are brought up to date.
3. **The year by latitude in the game's own code:** `core/year.js` (`A`, `m`, the flipped
   cooling), each thing's chill, lake and river ice, the weather's snow, `readHere`.
4. **The shaders,** with an A/B on the owner's computer.
5. **Tropical wet and dry, and the names of the season.**
6. **One full run of the suite,** docs, then the owner tries it before any release.

**Tests.** `tests/helpers.js` holds every test at `season=summer`, which is the world's phase:
under it the other half-year is in winter, so tests that travel far see winter there. Tests that
assert climate by place and will need looking at, at least: in `world.spec.js` the kinds of
country, nature, seasons by place, flowers and biomes; in `lakes.spec.js` frozen lakes; in
`explore.spec.js` skating, the castle, the sea, the fox and the countries list.

### Decisions wanted from the owner

1. **Old worlds,** the live site's among them. Proposed: when a world made before this is opened,
   its places found, woken waystones, tracking, camp, lanterns and explored map are cleared once,
   with a line saying the land has changed; what you carry, your journals, pets and settings are
   kept.
2. **How strongly temperature follows latitude.** Proposed above: latitude leads, the patches
   add about a third. To be settled on the pictures.
3. **The sun** staying one for the whole world.

### Not part of this

Asked or suggested, not decided: names and completion goals for each land ("34% explored, 12 of
40 waystones"); dividing lands east to west; hiding the World panel and its keys from play;
latitude lines on the map; rules of their own for the enchanted wood and volcanic country (no
leaf fall, no lying snow).

## Tools

- `node tools/fingerprint.mjs out.json` (dev server running): writes a numeric fingerprint of the
  generated world (ground heights, lake shape, walkable area, every instanced plant's position).
  `node tools/fingerprint.mjs a.json b.json --compare` says whether two are identical. Use it to
  prove a refactor moved nothing, and that one seed always gives the same world.
- `MEADOW_RUNNER=1 MEADOW_WORKERS=1 node tests/run.mjs` (Git Bash): the test suite, one test at a
  time. The software renderer used by headless Chrome is slow, so two at once time out on load.
