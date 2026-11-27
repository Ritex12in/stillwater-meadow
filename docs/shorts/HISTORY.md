# The story so far

What has happened to the game, in order, as source material for shorts. Each entry names the commit
where it can be seen, so a short can film the game as it was then
([ADR 0006](adr/0006-the-past-is-filmed-from-the-real-versions.md)). Taken from the commit history
(`git log`) and from [docs/endless-world.md](../endless-world.md), which holds the detail and the
owner's own words.

155 commits in 15 days, 13 to 27 November 2026. The owner directs; the code is written by an AI
(Claude). Whether an old commit still runs today has not been checked for any of them
([PLAN.md](PLAN.md), step 2).

## The chapters

### 1. A meadow by a lake (13 November)

One hand-placed valley with a lake: walk, sit, pet the animals, fish, watch the day turn.

| Commit | What |
|---|---|
| `620f25a` | The baseline: the game before any of this work. |
| `5dcb32b` | The first detailed player, dogs and cats: faces, hair, whiskers, blinking. |
| `2247ab2` | Trees, grass, flowers and rocks from a free downloaded kit (Quaternius, CC0). Still in use: see [CLAIMS.md](CLAIMS.md). |
| `13837e7` | "A softer, warmer meadow": sun haze, a colour grade, gusts, pollen, water lilies. |
| `5a16178` | Forty thousand placed grass tufts replaced by a grass field drawn on the graphics card in two calls. |
| `df8bfa5` | The distant mountains reworked: pointed peaks, snow, a forested front range. |

### 2. Things to do, and someone to do them with (14 to 16 November)

| Commit | What |
|---|---|
| `83654a6` | A cherry grove with a shrine. |
| `c1d3644` | The fishing rod is earned: the skipper trades it for a bouquet of three kinds. |
| `7f52b13` | Fishing becomes a skill: charged casts, nibbles, a fight per species. |
| `8c21c85` | Cats and dogs are tamed with fish. |
| `10f2f72` | The first trees grown from code instead of taken from the kit. |
| `c9b7c6f` | **A boy to play and a girl who wanders:** the sculpted children, with moving hair and expressions. |
| `1e20aef` | The game goes live on the web. |
| `584137e` | Company: talk to her, walk hand in hand, stargaze together. |
| `1677fc6` | Winter: a skating dance on the frozen lake, a snowman. |

### 3. The valley becomes a world (21 to 22 November)

The owner asked for an endless world made from a seed, as in Minecraft.

| Commit | What |
|---|---|
| `1dbed87` | "The land has no edge": terrain from a seed, in tiles round the camera, real mountains. |
| `9cfd838` | Woods everywhere, grown from the seed. |
| `9545e38` | Kinds of country from a climate: snow, heath, lush woods. |
| `3cdbc52` | Lakes from the seed, no two alike. |
| `f878351` | The hand-placed valley is gone. |
| `30aee4e`, `ad37abc` | A world of your own; any text is a seed. |
| `492e523` to `d32cc93` | Nature's rules: mountains worn as by water, a treeline, slopes that face the sun, scree. |
| `2b54faf` | A game year of 8 real days; each place has its own season. |
| `b5b7316`, `c112bbf` | Biomes (desert, swamp, enchanted wood, volcanic) and their buildings: pagodas, castles, ruins, windmills. |
| `e868c3e` | The sea. |

### 4. The character, six times over (22 November)

The richest single story: about 25 commits in one day on how the children look.

| Commit | What |
|---|---|
| `c112bbf`, `f1f3a50` | A downloaded character is tried (KayKit). The owner turns it down. |
| `0769acd` | Seven downloaded anime avatars are tried (VRoid). |
| `4da7465`, `43748f0` | Instead, the game's own figures learn from them: faces and hair reshaped. |
| `da80b7d` | Heads made oval, not round. |
| `e469097`, `20fcba4`, `07ac342` | Rebuilt after **the owner's own character sheets**: proportions, faces, clothes. |
| `8533f5b`, `36e98f0`, `da8f185` | Hair, three tries: "the owner asked whether it matched; it did not"; then "sharp spikes with a curve". |
| `9d2b54f` | "The owner asked for the oval back." |
| `d10efd5` | Hair gets physics and collision (the owner's idea). |
| `905b641`, `d9e1567` | Hair as "few, big, separate spikes"; then flame shapes, from the flame's own maths. |
| `c717f08`, `bbac421` | "Randomly messed up" hair put in order; "a little thin". |
| `770a715` | **"Remove Vroid."** The downloaded avatars go; the game's own children stay for good. |
| `c5b30af`, `4367b8d` | The pets and the skipper redrawn the same way. |

### 5. Water, and ways across it (22 to 23 November)

| Commit | What |
|---|---|
| `0c6dc4e` | Rivers and waterfalls. |
| `04b914c`, `608dad0` | Islands in lakes; bridges and stepping stones. |
| `a482f1a` | A film of the game, made by tools that render it frame by frame (`tools/film/`). |
| `f960691` | Fishing in rivers. |
| `a427474` | Made to run well on the owner's own laptop. |

### 6. A map, and a world with a shape (26 to 27 November)

| Commit | What |
|---|---|
| `c92aad4` | A map that shows only where you have been. |
| `5a1df8c`, `a8f116b` | Waystones: standing stones you wake, then travel between; tracking one shows the way. |
| `8bc3009` | Seasons by latitude: poles and equators, so "not every place's season can change" (the owner). |
| `9938baa` | The owner: "currently the world feels so random." A plan for oceans, continents and places. |
| `df1e170` | Waterfalls redrawn: "rivers and waterfall literally need better visual." |
| `738d87d` | Continents and islands. |
| `6c4aa93` | Harbours, and passages between continents. |
| `abed753` | Jumping, climbing, sliding and gliding. |
| `5b38c24` to `0390658` | Debugging by typed commands; a travelling screen; a report command. |

## Things that went wrong (each a story)

| What | Where |
|---|---|
| Continents made from plain noise all joined into one endless landmass, until each got its own square of sea. | `cb721ac`, then `738d87d` |
| The sea ended in a straight-edged pale sheet a kilometre out. | fixed in `738d87d` |
| Snow rode along with the player after fast travel. | fixed in `8bc3009` |
| Rocks beside the new waterfalls came out far too big and dark. | during `df1e170` |
| The roll after a long fall went under the ground. | `abed753`, fixed in `f8d77d0` |
| A map marker pointed the wrong way for anything beyond the view's far end. | fixed in `7acf033` |
| Two sets of downloaded characters were tried and thrown out. | `c112bbf`, `0769acd`, out in `770a715` |
| A resolution change flashed the screen black for a frame. | fixed in `caec23b` |

## Not live yet

The public site is at `8e1ce67` (23 November): chapters 1 to 5. All of chapter 6 (the map, waystones,
seasons by latitude, continents, harbours, the new moves) is on the `endless-world` branch, 22 commits
ahead. A short that shows it shows something players cannot do yet
([PLAN.md](PLAN.md), open question 2).
