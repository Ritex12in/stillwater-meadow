# 001. The character

- **Status:** re-making: rewritten on 2026-11-28 to 40 to 60 seconds, the opener first ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md)), at the owner's word ("too short and missing some points"); the earlier cut waits to be replaced
- **Idea:** A1 in [IDEAS.md](../IDEAS.md)
- **Length:** about 50 seconds (to be set by the voice when made)
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

## The opener

The first line of every short ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md)): "I'm building a whole game with AI. I haven't written a single line of code."

## The hook

Today's boy, close, his hair moving. "Two weeks ago, this boy was a stack of boxes." ("Fifteen days" became "two weeks", which ages better.)

## The script

Rewritten 2026-11-28 to 40 to 60 seconds: the opener, the hook, then the story in full.

| # | Line (voice and caption) | On screen | Filmed from |
|---|---|---|---|
| 1 | I'm building a whole game with AI. I haven't written a single line of code. | Today's boy by the home lake in the late sun, the camera coming round to him. | today |
| 2 | Two weeks ago, this boy was a stack of boxes. | Today's boy, close up, a slow quarter turn. | today |
| 3 | Day one. A few boxes, and his dog. | The first version: a figure of boxes by the lake, his dog beside him. | `620f25a` (13 Nov) |
| 4 | Day two, he was sculpted, all in code. | The first sculpted child, close. | `c9b7c6f` (14 Nov) |
| 5 | But he didn't feel like mine. So I drew him on paper, and described what I saw. | The first version of 22 November, the camera closing in. | `e469097` (22 Nov) |
| 6 | Round head. No, oval. Bigger hair. Spikes. With a curve. | Five real versions, one per phrase, same pose and camera. | `20fcba4`, `9d2b54f`, `36e98f0`, `da8f185`, `d9e1567` (22 Nov) |
| 7 | About twenty five tries in one day, and not one modelling program. | The flame-spiked version, the camera going round him. | `d9e1567` |
| 8 | Then his hair got springs, so it bounces when he lands. | He jumps and lands; the hair bounces. | today |
| 9 | Now he rolls out of long falls, and he glides. | A 14 m fall and the roll; then a drop and the glider opening. | today |
| 10 | I describe him. The AI writes the code. | Wide: him by the lake at dusk; the end card. | today |

Words: 115, with the end card. About 50 s at the voice's pace.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The owner is building a whole game with AI and has written no code. | Yes ([CLAIMS.md](../CLAIMS.md)): the AI writes all the code. Not "AI made everything". |
| 2 | Two weeks ago he was boxes. | Yes: `620f25a`, 13 November, fifteen days before 28 November. |
| 3, 4 | Day one boxes and the dog; day two sculpted in code. | Yes: `620f25a`, `c9b7c6f`; `src/characters/kid.js`. |
| 5, 6 | The owner drew him and described him; the steps. | Yes: the commits of 22 November, from the owner's sheets. |
| 7 | About 25 tries in a day; no modelling program. | Yes: about 25 commits on 22 November; the figure is code, no model file. |
| 8 | His hair has springs and bounces. | Yes: `d10efd5`. |
| 9 | He rolls out of long falls and glides. | Yes, and live. |
| 10 | The owner describes; the AI writes the code. | Yes. |

## Shots

Not worked out until the trial of old versions (PLAN.md, step 2) shows which of these commits run and
how far their camera can be driven. Intended: the home lake, late afternoon, clear, summer; the
camera a metre and a half from him at chest height for the close shots; the same for every version.

## Sound

The game's day music, low under the voice; the night take is not needed.

## To post

- **Title:** 15 days of one character, from boxes to this
- **Description:** Day one he was a few boxes. I drew him on paper, described what I wanted, and an AI wrote the code, try after try: his face, his clothes, every spike of his hair. Every frame here is the game as it was that day. Made with AI (Claude); the voice is AI too. Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #madewithai #proceduralgeneration #cozygames #threejs
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

To watch `e:\Games\_assets\shorts\001-the-character\001-the-character.mp4` and say yes, or what to change. Then to post it (the title, description and tags are in `001-the-character.txt` beside it).

## Notes

- 2026-11-27: drafted. Written before the owner asked for a pipeline first; kept as the first brief, not approved.
- 2026-11-27: "All code" cut from line 7 after the check of what is and is not made in code.
- The title says "I can't draw 3D", not "I can't draw": the owner did draw the sheets.
- 2026-11-28: the owner said "go with your picks": the voice is en-US-Andrew; line 5 shows the jump; the character sheets are not shown (the files are not with the project).
- 2026-11-28: the owner, on seeing the stills: the characters that were tried from outside are out of context and are not to be mentioned. The line about them and its two shots are gone ([ADR 0011](../adr/0011-only-the-games-own-characters-are-in-the-story.md)).
- 2026-11-28: the stills showed that the versions of 22 November draw the game's own figure only with `hero=classic` in the address; the shot list asks for it.
- 2026-11-28: the owner asked for the script itself to be rewritten. The first script defined him by what he is not ("no 3D model", "no modelling software"); this one tells how he changed, day by day, and adds the second day's sculpted child and what he can do now. The earlier script is in the file's history.
- 2026-11-28: stills of all twelve shots taken. The six versions of 22 November now show the game's own boy. The glide shot (line 6) frames him as a speck against the sky and must be reframed before filming.
- The title's "The title says" note above is about the earlier title and no longer applies.
- 2026-11-28: filmed and edited (`node tools/shorts/make.mjs 001`): 27.1 s, 1080 x 1920, 27 MB, 12 shots from 9 versions of the game, 24 captions, the AI voice over the game's day music. The six versions of line 4 cut in on the words they show (Round, oval, Bigger, Spikes, With). Claude has looked at it only as stills (a strip of one frame every two seconds, and single frames): the motion, the voice and the mix have not been heard or seen by anyone yet.
- Day one (`620f25a`) cannot be driven by script, so it is framed as that version opens: from behind, further off than the rest.
- 2026-11-28: the owner, having seen the shorts: "too short and missing some points; 40 to 60 seconds; mention at the start that I am building a game using AI completely, then a hook, then the story" ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md)). Rewritten: the opener first (worded so it is true: the AI writes all the code; the downloaded kit art means "AI made everything" would not be), then the hook, then the story with the steps the 25-second cut skipped. The earlier script is in the file's history.
