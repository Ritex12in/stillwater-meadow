# 001. The character

- **Status:** review: the rewritten script was approved by the owner on 2026-11-28 ("yes, film it"); filmed and edited the same day; waits for the owner to watch it
- **Idea:** A1 in [IDEAS.md](../IDEAS.md)
- **Length:** 27 seconds
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

Today's boy, close, his hair moving. "Fifteen days ago, this boy was made of boxes."

## The script

Rewritten 2026-11-28 at the owner's word: the story of how he changed, told for itself (see Notes).

| # | Line (voice and caption) | On screen | Filmed from |
|---|---|---|---|
| 1 | Fifteen days ago, this boy was made of boxes. | Today's boy, close up, a slow quarter turn. | today |
| 2 | Day one. | The first version: a figure of boxes by the lake, his dog beside him. | `620f25a` (13 Nov) |
| 3 | Day two, he was sculpted, in code. | The first sculpted child, close, same framing as today's. | `c9b7c6f` (14 Nov) |
| 4 | Then I drew him on paper, and we rebuilt him to match. Round head. No, oval. Bigger hair. Spikes. With a curve. | Six real versions of him, one per phrase, same pose and camera. | `e469097`, `20fcba4`, `9d2b54f`, `36e98f0`, `da8f185`, `d9e1567` (22 Nov) |
| 5 | Then his hair learned to move. | He jumps and lands; the hair bounces. | today |
| 6 | Now he jumps, and he glides. | He drops from a height and the glider opens. | today |
| 7 | I describe him. An AI writes the code. | Wide: him by the lake at dusk. | today |
| 8 | Stillwater Meadow. Free, in your browser. | End card over the same shot. | today |

Words: 62. Length: 27 s (set by the voice: en-US-Andrew).

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | Fifteen days ago he was a figure of boxes. | Yes: `620f25a` is 13 November and the figure in it is built of boxes; the short is dated 28 November. The number must be changed if the short is posted much later ("In two weeks" would age better). |
| 2, 3 | Day one; day two he was sculpted in code. | Yes: `620f25a` is the first day in the history, `c9b7c6f` the second (14 November), and the children are built in code (`src/characters/kid.js`). |
| 4 | The owner drew him and he was rebuilt to match, in those steps. | Yes: the commits of 22 November, made from the owner's character sheets. "We" is the owner and the AI. |
| 5 | His hair moves. | Yes: hair with springs and collision, `d10efd5`. |
| 6 | He jumps and glides. | Yes, and live on the site. |
| 7 | The owner describes; an AI writes the code. | Yes. |

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
