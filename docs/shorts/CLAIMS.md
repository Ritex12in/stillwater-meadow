# What a video may say

Every spoken line and caption is checked against this list before a brief is approved
([ADR 0005](adr/0005-made-with-ai-said-plainly-and-only-true-claims.md)). It was checked against the
code on 2026-11-27 and must be checked again whenever the game changes what is true.

## True, and may be said

| Claim | Why it is true |
|---|---|
| "Made with AI": the code is written by an AI (Claude) that the owner directs. | The commit history; the owner's decision to say so. |
| The owner did not write the code, model or animate; they described what they wanted, drew character sheets, and judged pictures. | docs/endless-world.md records the owner's words and decisions. |
| The characters (the boy, the girl, the skipper), the cats and dogs, and their hair, faces and clothes are made in code: no 3D model files. | `src/characters/kid.js`, `animals.js`. |
| All the animation is code: walking, sitting, jumping, climbing, gliding. No animation files. | `src/characters/kidpose.js`, `movepose.js`. |
| The shape of the land, the mountains, the lakes, rivers, waterfalls, the sea, the sky, the weather and the seasons are made in code. (The grass and soil painted on the ground are picture files: see below.) | `src/core/shape.js`, `src/world/`. |
| The buildings (pagodas, castles, windmills, harbours, waystones) are made in code. | `src/world/buildings.js`. |
| The whole world comes from one seed; any word is a seed; the world has no edge. | `src/systems/save.js`, `src/core/shape.js`. |
| It runs in a web browser, free, with nothing to install. | The public site. |
| "155 commits in 15 days" (13 to 27 November 2026). | `git log`. Update the numbers when used later. |
| The music is the game's own. | `src/features/music.js` makes it in code. |

## Not true as things stand: must not be said

| Claim | What is true instead |
|---|---|
| **"Everything is coded"**, "no assets", "100% code". | Many trees, bushes, ferns, mushrooms, rocks, grass clumps and some flowers, the bench and the fences are downloaded models with their textures: Quaternius' Stylized Nature kits (CC0, free to use, no credit needed), about 127 MB in `public/assets/`, loaded by `src/core/assets.js`. Some trees are grown from code (`src/world/proctrees.js`), not all. The grass, soil and flower-meadow textures on the ground are downloaded pictures too (CC0, from OpenGameArt: `public/assets/ground/`), as are the clumps of meadow flowers (`public/assets/meadow/`). |
| "No 3D models." | True of the characters, animals and buildings only. Say which. |
| That a feature from chapter 6 of HISTORY.md can be played today. | Those are not on the public site yet. Say "coming soon", or wait. |
| That the owner wrote or "coded" the game themselves. | The AI wrote the code; the owner directed it. |

## Ways to say it that are true

- "No 3D models for the characters. Every strand of hair is code."
- "I didn't model him or animate him. I described him, and an AI wrote the code."
- "The world, the water, the sky, the people, the animation: all code. A few trees and rocks are from a free kit."
- "Almost everything you see is code."

## If the owner wants "everything is coded" to be true

It would need the downloaded plants, rocks, bench and fences replaced by code-made ones: a piece of
work on the game itself, with its own cost in looks and speed. It is on the list in
[PLAN.md](PLAN.md) as an open question, not as a task.
