# Stillwater Meadow

A calm, walkable low-poly lakeside world in the browser: real-time day and night, weather,
seasons, cats and dogs to tame with fish you catch, ducks, a bamboo boat with a skipper (who trades
his fishing rod for a good bouquet), a fishing game, a campfire,
stargazing and a photo mode. Trees, grass, flowers, bushes and rocks use the free (CC0)
[Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) by Quaternius,
and the bench, fences and vines come from his free (CC0)
[Fantasy Props](https://quaternius.com/packs/fantasypropsmegakit.html) and
[Medieval Village](https://quaternius.com/packs/medievalvillagemegakit.html) MegaKits; the ground
uses hand-painted CC0 grass and soil textures by [Cethiel](https://opengameart.org/users/cethiel).
Grass clumps and flower clumps come from his free (CC0)
[Ultimate Stylized Nature Pack](https://quaternius.com/packs/ultimatestylizednature.html)
(`tools/prepare_meadow.py` -> `public/assets/meadow`); its common trees, slender pines and
rocks only ship as OBJ, so `tools/obj_to_gltf.mjs` converts them first. Everything else (maples, birches and the
round-crowned trees, daisies, lupins, lamp posts, mountains, sky, clouds, water, the autumn leaf litter and the snow) is built from code.

## Run it

```sh
npm install
npm run dev        # http://127.0.0.1:8080
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build on port 8080 |
| `npm run lint` | ESLint over `src/` and `tests/` |
| `npm test` | Playwright end-to-end tests (uses the installed Chrome) |
| `npm run test:quick` | The same tests with a small built-in runner; `MEADOW_WORKERS=1` runs them one at a time (the software renderer used in headless Chrome is slow) |

Open with `?debug` for a frame-time graph and live tuning panel. Other URL options:
`?weather=rain|storm|fog|snow`, `?season=spring|summer|autumn|winter`, and a fixed time with
`#morning`, `#noon`, `#evening`, `#night` or an hour such as `#21.5`. `?assets=0` uses the
hand-built plants instead of the nature models (also the automatic fallback if they fail to load).

## Nature models

The models in `public/assets/nature/` come from the standard (free) version of Quaternius'
Stylized Nature MegaKit, CC0 1.0 (see `LICENSE.txt` there). `tools/prepare_nature.py` rebuilds
that folder from the unzipped pack: it copies the models the meadow uses without their texture
references, turns the leaf textures grey so the season colours can tint them, and downscales
the textures. It needs Python with Pillow.

`public/assets/props/` (bench, fence, vines) is built the same way by `tools/prepare_props.py`
from the Fantasy Props and Medieval Village MegaKits (CC0; licences copied alongside).

`public/assets/ground/` holds the ground textures: `tools/prepare_ground.py` copies Cethiel's
grass, flower-meadow and soil tiles (CC0, OpenGameArt) and `tools/paint_leaves.py` paints the
autumn leaf litter. The terrain shader (`world/terrain.js`) blends them by per-vertex weights
(sand by the lake, soil on the path, rock up high), tiles them in world space at two scales and
angles so the repeat doesn't show, adds flower-meadow patches in spring and summer and fallen
leaves in autumn, and paints its own snow (drifts, blue hollows, sparkle) through `SNOW_COLOR`.

## How the code is organised

```
src/
  main.js            boot, fixed build order, the frame loop, per-system error isolation
  core/              math and random streams, world shape and height field, renderer, materials, shared state
  world/             sky (moon phases), lights, terrain, water, vegetation, props, particles, effects
  characters/        the children (kid, kidpose), rigs for the skipper and animals, the player, petting, the boat
  systems/           activity state machine, actions and keys, audio mixer, save, time, weather,
                     input, camera, quality, post-processing
  ui/                HUD and prompts, World popover, settings
  features/          ducks, wildlife, voices, seasons, flowers, fishing, campfire, stargazing,
                     photo mode, music, the rod quest, taming and pet names, the friend, footsteps
tests/               Playwright regression and feature tests
tools/               asset preparation script
public/assets/       nature models and textures (CC0)
```

Key ideas:

- **Activity state machine** (`systems/activity.js`): sitting, petting, fishing, lying down,
  dialogs and photo mode each say which others may start on top of them. This replaced loose
  flags that let modes fight each other.
- **Action registry** (`systems/actions.js`): every contextual key (E, F, R, T, B, G, Z) registers
  an action with a label, an availability test and a score. The best action per key becomes the
  on-screen prompt and the thing the key does.
- **Fishing and taming** (`features/rod.js`, `fishing.js`, `pets.js`): the rod is earned from the
  skipper (a full bouquet of three kinds, or five pine cones in winter). Fishing is a skill: a
  charged cast, nibbles before the real bite, and a tension fight with a fixed rhythm per species;
  catches fill an 8-fish creel. Fish are worth 1-3 trust by size, double for each animal's
  favourite. Dogs need 5 and take food from your hand; cats need 8, run from you until they trust
  you, and only eat a thrown fish while you keep still at a distance. Nothing is random, and trust
  is never lost. Only tamed animals can be named, petted, follow you or join you at the fire.
- **Trees grown from code** (`world/proctrees.js`): maples, birches and round-crowned trees are
  branching skeletons of tapered tubes with rounded clusters of leaf cards, on leaf and bark textures
  painted at load; about a third of the triangles of the models they replaced. Every broadleaf tree
  then takes its own shape in the vertex shader (`treeWarp`): a smooth noise field and a per-tree hash
  lean it, twist its crown and stretch it, the same for bark, leaves and their shadows.
  `tools/studio/trees.html?fam=MapleTree` shows a family's five variants.
- **The shrine's great cherry** (`cherryHero` in `world/proctrees.js`, placed by `world/shrine.js`): one
  tall, cone-shaped tree behind the hall, built to plan (a leader and three sub-trunks, branches
  spiralling up and shortening toward the top, blossom clusters at their tips) with painted five-petal
  blossom, and a thick fall of notched petals drifting from its crown. `?fam=Cherry` in the studio.
- **Sculpted children** (`core/sculpt.js`, `characters/kid.js`, `kidpose.js`): the boy you play and the
  girl who wanders the meadow are built from code. Bodies are sculpted from distance fields (shapes
  blended into one soft surface, meshed with surface nets, coloured per vertex); hair is layered
  leaf-shaped locks that bend from the root, lagging behind the head on a spring and fluttering in
  the wind; faces change expression with what happens (a bite, a snapped line, a tamed pet).
  `kidpose.js` poses walk, run, idle, sitting and kneeling for both.
  `tools/studio/kid.html?who=boy&view=turn|head|faces|poses|motion` previews them.
- **Company** (`features/friend.js`, `emotes.js`, `pets.js`): the girl can be greeted and talked to (C), walks
  with you hand in hand (X), sits beside you, by the lit campfire, or lies down to watch the stars, takes a
  bouquet (G) and wears a flower from it, and answers your waves, cheers and dances (keys 1-4). Tamed pets
  settle round you when you sit, cats come to your feet, and a tamed dog fetches a thrown stick (Y).
- **Audio mixer** (`systems/audio.js`): four buses — nature, animals, music, interface — each with
  its own volume; suspended while the tab is hidden.
- **Two random streams** (`core/math.js`): the seeded world-building stream is only used at boot
  in a fixed order, so trees and flowers never move between versions; runtime randomness uses a
  separate stream.
- **Nature models** (`core/assets.js`, `world/kitplants.js`): loaded before the world is built and
  reduced to plain geometry, so the same placement, wind, distance fade and season tinting apply.
  Beyond 55 m a tree draws a thinned copy of its own model (fewer, larger leaf cards; trunk and
  main boughs only), so it keeps its look at a third of the cost. Between 45 and 60 m the two
  cross-fade as a fine dither (`lodFade`), shadow included, so nothing switches in one frame.
- **Distance thinning**: grass and flowers thin out gradually with distance, each plant vanishing
  at its own distance (`addWind` fade), and shadows fade out over the outer 18 m of the shadow
  area (`world/lights.js`) instead of ending at a line.
- **Atmosphere** (`core/atmosphere.js`): patches three's fog so the haze glows toward the sun,
  matching the sky's horizon, and adds a gentle colour grade (soft highlights, warm shade) to
  every surface; the sky and lake shaders call the same functions so the horizon stays seamless.
  Imported first in `main.js`, before anything is drawn.
- **Wind** (`addWind` in `core/materials.js`): plants sway, and gusts roll across the meadow as
  bands that press the grass over and lighten it; tree crowns rustle with the same field.
- **Scenery and light**: distant mountains with valley mist (`world/mountains.js`); painted
  sprite clouds and a flock of birds (`world/ambient.js`); lamp light pools painted into the shared
  lighting code (`core/atmosphere.js`), and light on the lake (`world/water.js`): lamp streaks and the
  sun's or moon's glitter path, with no mirrored scene; screen-space sunbeams (`systems/post.js`, High).
- **Grass** (`world/grassfield.js`): made on the GPU in two draw calls. A tuft shape is drawn
  many times on grids that follow the camera; the vertex shader places each copy at a stable spot
  in its world cell, reads height and where grass grows from a baked map, thins it with distance
  and sways it. Near: grass clumps from the meadow pack; far: simple tufts.
- **Far forest** (`world/farforest.js`): thousands of trees on the hills past the walkable edge
  and on the mountains' lower slopes, each a camera-facing card showing a picture of a real tree
  model rendered into a texture at startup; three draw calls in all.
- **Wildflowers** (`world/wildflowers.js`): daisy and lupin clumps built in code, kit flower
  clumps, wispy grass and pebbles, clustered along the path, round the bench and in the meadow.
- **Performance**: grass, flowers, trees and rocks are split into culled chunks; rain, snow and
  leaves animate on the GPU; terrain height is baked into a grid matching the rendered mesh;
  quality tiers (shadow size and refresh rate, resolution, bloom) adapt to the frame rate.

three.js is pinned to r128 to keep the hand-tuned colours and lighting unchanged.
