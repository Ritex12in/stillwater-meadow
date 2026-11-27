# 008. Into the hill

- **Status:** filming: written and made on 2026-11-28 at the owner's word ("write 10 more short scripts and make videos"; the ideas and scripts are Claude's)
- **Idea:** B6 (new) in [IDEAS.md](../IDEAS.md)
- **Length:** about 52 seconds (set by the voice when made)
- **Shows only what is live on the site?** yes, from the publish of 2026-11-28
- **Approved by the owner on:** 2026-11-28, by asking for it to be made ([ADR 0012](../adr/0012-asking-for-a-short-is-the-yes-to-film-it.md)); the script itself they have not read

## The story

The owner: "while moving with speed of 10, player merge in ground and comes up when stopped" (28 November). The player's height followed the ground at a fixed rate and fell 0.8 m behind on a slope at that speed (`fab26a5`). The first fix made it follow as fast as he moved, and uphill was right (`4a5d09c`); downhill he floated 0.5 m above the slope. The second keeps him within 3 cm of any slope either way, easing only over a real step (`0e2f0c4`). A test now runs up and down the hill at speed 10.

## The opener

"I'm building a whole game with AI. I haven't written a single line of code." ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md))

## The hook

He runs up the hill at ten times speed and sinks into it. "At ten times his speed, he ran straight into the hill."

## The script

The shots are in `tools/shorts/shorts/008-into-the-hill.mjs` (each one's version, place, hour and camera).

| # | Line (voice and caption) | Note | Filmed from |
|---|---|---|---|
| 1 | I'm building a whole game with AI. I haven't written a single line of code. | the opener | today |
| 2 | At ten times his speed, he ran straight into the hill. |  | `fab26a5` |
| 3 | The game has commands for testing. I typed speed ten, and ran up a slope. |  | `fab26a5` |
| 4 | He sank into the ground as he climbed, and only came up again when he stopped. |  | `fab26a5` |
| 5 | His height chased the ground at a fixed rate. Go fast enough, and it fell behind. |  | `fab26a5` |
| 6 | The first fix made it keep up. Uphill was right. Downhill, he floated. |  | `4a5d09c`, `4a5d09c` |
| 7 | So now he stays within three centimetres of any slope, either way. |  | `0e2f0c4`, `0e2f0c4` |
| 8 | And a test now runs that hill every time, so the bug cannot come back. |  | today |

Words: 119, with the end card.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The owner is building a whole game with AI and has written no code. | Yes ([CLAIMS.md](../CLAIMS.md)). Not "AI made everything". |
| 3 | There are commands for testing; speed 10. | Yes: the `speed` command. |
| 4 | He sank as he climbed and came up when he stopped. | Yes: `fab26a5`, 0.8 m. |
| 5 | His height chased the ground at a fixed rate. | Yes: `damp(..., 14, dt)` in `fab26a5`. |
| 6 | The first fix: uphill right, downhill floated. | Yes: `4a5d09c`, 0.5 m. |
| 7 | Within 3 cm of any slope. | Yes: `0e2f0c4`. |
| 8 | A test runs that hill every time. | Yes: the speed test in `tests/bugs.spec.js` (it runs when the tests are run, not on every play). |

## Sound

The game's day music, low under the voice (the night take for night shots is not separate).

## To post

- **Title:** Into the hill
- **Description:** I'm building a whole game with AI: I describe it, Claude writes the code. The owner: "while moving with speed of 10, player merge in ground and comes up when stopped" (28 November). Every old clip is the game as it really was. Made with AI (the voice is AI too). Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #madewithai #cozygames #proceduralgeneration #indiedev
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

To watch `e:\Games\_assets\shorts\008-into-the-hill\008-into-the-hill.mp4` and say yes, or what to change.

## Notes

- 2026-11-28: written and made in one sitting while the owner slept, at their word. The stills of every shot were looked at before filming (see below).
