# 013. Grey falls at night

- **Status:** filming: written and made on 2026-11-28 at the owner's word ("write 10 more short scripts and make videos"; the ideas and scripts are Claude's)
- **Idea:** B7 (new) in [IDEAS.md](../IDEAS.md)
- **Length:** about 47 seconds (set by the voice when made)
- **Shows only what is live on the site?** yes, from the publish of 2026-11-28
- **Approved by the owner on:** 2026-11-28, by asking for it to be made ([ADR 0012](../adr/0012-asking-for-a-short-is-the-yes-to-film-it.md)); the script itself they have not read

## The story

The owner played in winter after midnight on low graphics and sent a report from the game's report command (a screenshot with the seed, the place and the time), saying "colors different". The falls had frozen into flat grey slabs (`75b5b3b`). The fix drew a frozen fall as a curtain of icicles (`d313a7d`). The owner: "honestly it looks weird and static; waterfall should not change with season; make it glow at night" (`932d97a`): the falls of a grove's heart never freeze and glow after dark.

## The opener

"I'm building a whole game with AI. I haven't written a single line of code." ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md))

## The hook

The falls frozen grey at night. "I sent the AI a report: the waterfall looks wrong at night."

## The script

The shots are in `tools/shorts/shorts/013-grey-falls-at-night.mjs` (each one's version, place, hour and camera).

| # | Line (voice and caption) | Note | Filmed from |
|---|---|---|---|
| 1 | I'm building a whole game with AI. I haven't written a single line of code. | the opener | today |
| 2 | I sent the AI a report: the waterfall looks wrong at night. |  | `75b5b3b` |
| 3 | The game has a report command. It saves a screenshot, with the seed, the place and the time. |  | `75b5b3b` |
| 4 | It read the report. Winter, after midnight, low graphics. The falls had frozen into flat grey slabs. |  | `75b5b3b` |
| 5 | Its fix: icicles, pale in the moonlight. |  | `d313a7d` |
| 6 | I said it looked static. A waterfall shouldn't change with the season. Make it glow at night. |  | `d313a7d` |
| 7 | So now these falls never freeze, and after dark they glow. |  | `932d97a` |
| 8 | I play, I report, it fixes. |  | today |

Words: 109, with the end card.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The owner is building a whole game with AI and has written no code. | Yes ([CLAIMS.md](../CLAIMS.md)). Not "AI made everything". |
| 3 | The report command saves a screenshot with the seed, the place and the time. | Yes: `/report`. |
| 4 | Winter, after midnight, low graphics; grey slabs. | Yes: the report of 28 November, 12.34 am, low. |
| 5 | Icicles. | Yes: `d313a7d`. |
| 6 | The owner's words. | Yes. |
| 7 | These falls never freeze and glow. | Yes: the grove's falls (`932d97a`), live from 28 November. |

## Sound

The game's day music, low under the voice (the night take for night shots is not separate).

## To post

- **Title:** Grey falls at night
- **Description:** I'm building a whole game with AI: I describe it, Claude writes the code. The owner played in winter after midnight on low graphics and sent a report from the game's report command (a screenshot with the seed, the place and the time), saying "colors different". Every old clip is the game as it really was. Made with AI (the voice is AI too). Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #madewithai #cozygames #proceduralgeneration #indiedev
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

To watch `e:\Games\_assets\shorts\013-grey-falls-at-night\013-grey-falls-at-night.mp4` and say yes, or what to change.

## Notes

- 2026-11-28: written and made in one sitting while the owner slept, at their word. The stills of every shot were looked at before filming (see below).
