# 010. The moves

- **Status:** filming: written and made on 2026-11-28 at the owner's word ("write 10 more short scripts and make videos"; the ideas and scripts are Claude's)
- **Idea:** C3 in [IDEAS.md](../IDEAS.md)
- **Length:** about 45 seconds (set by the voice when made)
- **Shows only what is live on the site?** yes
- **Approved by the owner on:** 2026-11-28, by asking for it to be made ([ADR 0012](../adr/0012-asking-for-a-short-is-the-yes-to-film-it.md)); the script itself they have not read

## The story

The owner: "we need more actions for the player; currently he can't climb, jump, jump from a cliff, can't glide; every action needs detailed animation" (27 November). Each move was planned frame by frame (the crouch, the push, the tuck, the landing), then built (`abed753`, `f8d77d0`): a jump, landings by the height of the fall (soft, heavy, a roll), climbing a steep face, sliding, and a glider found by a cairn near home.

## The opener

"I'm building a whole game with AI. I haven't written a single line of code." ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md))

## The hook

The boy at the foot of a steep face, before any move existed. "I told the AI: he can't climb, he can't jump, he can't glide."

## The script

The shots are in `tools/shorts/shorts/010-the-moves.mjs` (each one's version, place, hour and camera).

| # | Line (voice and caption) | Note | Filmed from |
|---|---|---|---|
| 1 | I'm building a whole game with AI. I haven't written a single line of code. | the opener | today |
| 2 | I told the AI: he can't climb, he can't jump, he can't glide. |  | `df1e170` |
| 3 | So first it planned every move, frame by frame. The crouch, the push, the tuck, the landing. |  | today |
| 4 | A short drop, he lands softly. A long one, he rolls out of it. |  | today, today |
| 5 | Push into a steep face, and he takes hold and climbs. |  | today |
| 6 | And somewhere near home, a glider lies by a cairn. |  | today |
| 7 | Find it, and you can jump off anything and fly. |  | today |
| 8 | Every move is code. Not one animation file. |  | today |

Words: 104, with the end card.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The owner is building a whole game with AI and has written no code. | Yes ([CLAIMS.md](../CLAIMS.md)). Not "AI made everything". |
| 2 | The owner said so. | Yes: the owner's words. |
| 3 | Planned frame by frame. | Yes: the plan of 27 November (docs/endless-world.md). |
| 4 | Soft landing on a short drop, a roll on a long one. | Yes: `moves.js`. |
| 5 | He climbs a steep face. | Yes. |
| 6 | A glider lies by a cairn near home. | Yes: `features/glider.js`. |
| 8 | Every move is code; no animation files. | Yes ([CLAIMS.md](../CLAIMS.md)). |

## Sound

The game's day music, low under the voice (the night take for night shots is not separate).

## To post

- **Title:** The moves
- **Description:** I'm building a whole game with AI: I describe it, Claude writes the code. The owner: "we need more actions for the player; currently he can't climb, jump, jump from a cliff, can't glide; every action needs detailed animation" (27 November). Every old clip is the game as it really was. Made with AI (the voice is AI too). Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #madewithai #cozygames #proceduralgeneration #indiedev
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

To watch `e:\Games\_assets\shorts\010-the-moves\010-the-moves.mp4` and say yes, or what to change.

## Notes

- 2026-11-28: written and made in one sitting while the owner slept, at their word. The stills of every shot were looked at before filming (see below).
