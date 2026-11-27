# 001. The character

- **Status:** approved (the owner, 2026-11-28: "go with your picks"), then changed the same day at the owner's word (see Notes); stills taken, not yet filmed
- **Idea:** A1 in [IDEAS.md](../IDEAS.md)
- **Length:** about 27 seconds
- **Shows only what is live on the site?** yes
- **Approved by the owner on:** 2026-11-28

## The story

The owner cannot model or animate, and wanted a character that felt like theirs. The first player was
a simple figure (`620f25a`, 13 November), then a sculpted child (`c9b7c6f`). On 22 November the owner
drew character sheets and described what they saw, and the figure was rebuilt part by part: the head
round, then oval again (`da80b7d`, `9d2b54f`); the hair asked about ("whether it matched; it did
not", `36e98f0`), then "sharp spikes with a curve" (`da8f185`), then "few, big, separate spikes"
(`905b641`), then flame shapes from the flame's own maths (`d9e1567`), then given springs and
collision (`d10efd5`). About 25 commits in a day, and no modelling program opened.

## The hook

Today's boy, close, his hair moving in the wind. "This character has no 3D model."

## The script

| # | Time | Line (voice and caption) | On screen | Filmed from |
|---|---|---|---|---|
| 1 | 0–2 s | This character has no 3D model. | Today's boy, close up, hair moving. | today |
| 2 | 2–6 s | Every strand of his hair is code. And I didn't write it. An AI did. | A slow turn round him. | today |
| 3 | 6–9 s | Day one, he looked like this. | Hard cut: the first figure, same pose, same camera. | `5dcb32b` |
| 4 | 9–17 s | So I drew what I wanted, and described it. Round head. No, oval. Bigger hair. Spikes. With a curve. | The real versions, one per phrase, same pose and camera. | `e469097`, `20fcba4`, `9d2b54f`, `36e98f0`, `da8f185`, `d9e1567` (each asked for the game's own figure) |
| 5 | 17–19 s | Then his hair got physics. | He jumps and lands; the hair bounces. | today |
| 6 | 19–24 s | No modelling software. I described him. An AI coded him. | Wide: him by the lake at sunset. | today |
| 7 | 24–27 s | Stillwater Meadow. Free, in your browser. | End card. | — |

Words: 69. Length: about 27 s (set by the voice).

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The character has no 3D model. | Yes: the characters are built in code (`src/characters/kid.js`). |
| 2 | Every strand of his hair is code; an AI wrote it, not the owner. | Yes. |
| 3 | He looked like this on day one. | Yes if filmed from `5dcb32b`, which is 13 November, the first day in the history. |
| 4 | The owner drew what they wanted and described it. | Yes: the owner's character sheets (docs/endless-world.md records the work done from them). |
| 5 | The hair has physics. | Yes: `d10efd5`. |
| 6 | No modelling software was used for him. | Yes for the character. It does not say the whole game is code, which would not be true. |

An earlier draft said "Fifteen days. No modelling software. All code." **"All code" was cut**: it
reads as a claim about the whole game ([CLAIMS.md](../CLAIMS.md)).

## Shots

Not worked out until the trial of old versions (PLAN.md, step 2) shows which of these commits run and
how far their camera can be driven. Intended: the home lake, late afternoon, clear, summer; the
camera a metre and a half from him at chest height for the close shots; the same for every version.

## Sound

The game's day music, low under the voice; the night take is not needed.

## To post

- **Title:** I can't draw 3D. So I described him to an AI.
- **Description:** The boy in my game has no 3D model. I drew him on paper, described him, and an AI wrote the code: his face, his clothes, every spike of his hair. Made with AI (Claude); the voice is AI too. Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #madewithai #proceduralgeneration #cozygames #threejs
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

Nothing more before filming. The finished short is theirs to watch and say yes or no to.

## Notes

- 2026-11-27: drafted. Written before the owner asked for a pipeline first; kept as the first brief, not approved.
- 2026-11-27: "All code" cut from line 7 after the check of what is and is not made in code.
- The title says "I can't draw 3D", not "I can't draw": the owner did draw the sheets.
- 2026-11-28: the owner said "go with your picks": the voice is en-US-Andrew; line 5 shows the jump; the character sheets are not shown (the files are not with the project).
- 2026-11-28: the owner, on seeing the stills: the characters that were tried from outside are out of context and are not to be mentioned. The line about them and its two shots are gone ([ADR 0011](../adr/0011-only-the-games-own-characters-are-in-the-story.md)).
- 2026-11-28: the stills showed that the versions of 22 November draw the game's own figure only with `hero=classic` in the address; the shot list asks for it.
