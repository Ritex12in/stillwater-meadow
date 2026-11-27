# 004. Wide rivers

- **Status:** filming: written and made on 2026-11-28 at the owner's word ("write 10 more short scripts and make videos"; the ideas and scripts are Claude's)
- **Idea:** C7 (new) in [IDEAS.md](../IDEAS.md)
- **Length:** about 53 seconds (set by the voice when made)
- **Shows only what is live on the site?** yes, from the publish of 2026-11-28
- **Approved by the owner on:** 2026-11-28, by asking for it to be made ([ADR 0012](../adr/0012-asking-for-a-short-is-the-yes-to-film-it.md)); the script itself they have not read

## The story

The owner typed "I want wide rivers and waterfalls" (28 November). Every river had been a stream, 2.4 m at its spring and never wider than 5.8 m, its falls stepping down 3.2 m at a time (`fab26a5`). The same night they widened: 2.4 m at the spring to 20 m within half a kilometre, deeper but still wadeable, and falling up to about 10 m at a time on a wide river, so the lower falls became broad cascades (`f508d5a`). The same river and the same fall are filmed in both versions.

## The opener

"I'm building a whole game with AI. I haven't written a single line of code." ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md))

## The hook

The narrow fall of river 1:-1 as it was. "One night I typed: I want wide rivers, and waterfalls."

## The script

The shots are in `tools/shorts/shorts/004-wide-rivers.mjs` (each one's version, place, hour and camera).

| # | Line (voice and caption) | Note | Filmed from |
|---|---|---|---|
| 1 | I'm building a whole game with AI. I haven't written a single line of code. | the opener | today |
| 2 | One night I typed: I want wide rivers, and waterfalls. |  | `fab26a5` |
| 3 | Every river in the game was a stream. Two and a half metres at its spring, and never wider than six. |  | `fab26a5` |
| 4 | Now a river starts as a rill, and widens as it runs, to twenty metres in half a kilometre. |  | `f508d5a` |
| 5 | And the falls grow with it. A stream drops three metres at a time. A wide river, up to ten, in broad cascades. |  | `fab26a5`, `f508d5a` |
| 6 | Same river, same spot. Before. And after. |  | `fab26a5`, `f508d5a` |
| 7 | The water is deeper where it is wide, but you can still wade across. |  | today |
| 8 | All of that, from one sentence. |  | today |

Words: 121, with the end card.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The owner is building a whole game with AI and has written no code. | Yes ([CLAIMS.md](../CLAIMS.md)). Not "AI made everything". |
| 2 | The owner typed it. | Yes: the owner's words, 28 November. |
| 3 | 2.4 m at the spring, never wider than 6. | Yes: `fab26a5`, 2.4 to 5.8 m. |
| 4 | A rill widening to 20 m in half a kilometre. | Yes: `f508d5a`, `riverWidth`. |
| 5 | A stream drops 3 m at a time; a wide river up to 10. | Yes: 3.2 m to about 10 m (`FALL_W`). |
| 7 | Deeper where wide, still wadeable. | Yes: up to about 0.75 m; `walkable` does not stop at water. |
| 8 | From one sentence. | Yes: the one message. |

## Sound

The game's day music, low under the voice (the night take for night shots is not separate).

## To post

- **Title:** Wide rivers
- **Description:** I'm building a whole game with AI: I describe it, Claude writes the code. The owner typed "I want wide rivers and waterfalls" (28 November). Every old clip is the game as it really was. Made with AI (the voice is AI too). Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #madewithai #cozygames #proceduralgeneration #indiedev
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

To watch `e:\Games\_assets\shorts\004-wide-rivers\004-wide-rivers.mp4` and say yes, or what to change.

## Notes

- 2026-11-28: written and made in one sitting while the owner slept, at their word. The stills of every shot were looked at before filming (see below).
