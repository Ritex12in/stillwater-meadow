# Stillwater Meadow

A calm, walkable low-poly lakeside world in the browser: real-time day and night, weather,
seasons, cats and dogs to befriend, ducks, a bamboo boat with a skipper, fishing, a campfire,
stargazing and a photo mode. No downloaded assets — everything is built from code.

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

Open with `?debug` for a frame-time graph and live tuning panel. Other URL options:
`?weather=rain|storm|fog|snow`, `?season=spring|summer|autumn|winter`, and a fixed time with
`#morning`, `#noon`, `#evening`, `#night` or an hour such as `#21.5`.

## How the code is organised

```
src/
  main.js            boot, fixed build order, the frame loop, per-system error isolation
  core/              math and random streams, world shape and height field, renderer, materials, shared state
  world/             sky (moon phases), lights, terrain, water, vegetation, props, particles, effects
  characters/        rigs, the player, animals, petting, the boat and skipper
  systems/           activity state machine, actions and keys, audio mixer, save, time, weather,
                     input, camera, quality, post-processing
  ui/                HUD and prompts, World popover, settings
  features/          ducks, wildlife, voices, seasons, flowers, fishing, campfire, stargazing,
                     photo mode, music, pet names, footsteps
tests/               Playwright regression and feature tests
```

Key ideas:

- **Activity state machine** (`systems/activity.js`): sitting, petting, fishing, lying down,
  dialogs and photo mode each say which others may start on top of them. This replaced loose
  flags that let modes fight each other.
- **Action registry** (`systems/actions.js`): every contextual key (E, F, R, B, G, Z) registers
  an action with a label, an availability test and a score. The best action per key becomes the
  on-screen prompt and the thing the key does.
- **Audio mixer** (`systems/audio.js`): four buses — nature, animals, music, interface — each with
  its own volume; suspended while the tab is hidden.
- **Two random streams** (`core/math.js`): the seeded world-building stream is only used at boot
  in a fixed order, so trees and flowers never move between versions; runtime randomness uses a
  separate stream.
- **Performance**: grass, flowers, trees and rocks are split into culled chunks; rain, snow and
  leaves animate on the GPU; terrain height is baked into a grid matching the rendered mesh;
  quality tiers (shadow size and refresh rate, resolution, bloom) adapt to the frame rate.

three.js is pinned to r128 to keep the hand-tuned colours and lighting unchanged.
