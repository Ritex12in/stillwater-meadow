# 002. Through the floor

- **Status:** re-making: rewritten on 2026-11-28 to 40 to 60 seconds, the opener first ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md)), at the owner's word ("too short and missing some points"); the earlier cut waits to be replaced
- **Idea:** B3 in [IDEAS.md](../IDEAS.md)
- **Length:** about 55 seconds (to be set by the voice when made)
- **Shows only what is live on the site?** yes (the fix is live; the bug is shown as it was)
- **Approved by the owner on:** 2026-11-28, by asking for it to be made; the script itself they have not read

## The story

When jumping and falling were built, a fall of more than six metres was to end in a forward roll. In
the version it was first built in (`abed753`) the boy tucked, tipped forward and sank out of sight:
the figure turns about its feet, so a full turn took his head and back down through the ground. The
next commit (`f8d77d0`) carries the tucked figure round its own middle instead, up and over. Both
versions are in the history, so both are filmed as they were: the same fall, the same camera.

## The opener

The first line of every short ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md)): "I'm building a whole game with AI. I haven't written a single line of code."

## The hook

He drops out of the sky over the lake, lands, and is gone. "I asked for a roll out of long falls. He went straight through the floor."

## The script

Rewritten 2026-11-28 to 40 to 60 seconds: the opener, the hook, then the story in full.

| # | Line (voice and caption) | On screen | Filmed from |
|---|---|---|---|
| 1 | I'm building a whole game with AI. I haven't written a single line of code. | Today's boy by the home lake, the camera coming round behind him. | today |
| 2 | I asked for a roll out of long falls. He went straight through the floor. | A fall of 28 m; he lands and sinks from sight, then stands. | `abed753` |
| 3 | When I added jumping, every fall had to land right. A short one, softly. A higher one, heavily. | A 1.6 m drop and a soft landing; a 4.5 m drop and a heavy one. | today |
| 4 | And a long one, in a forward roll. This is the version where the roll came in. Watch it slowly. | A 7 m fall at three tenths speed, from his side. | `abed753` |
| 5 | He lands, tucks, tips forward, and he is gone. | The same, on. | `abed753` |
| 6 | The bug: he was turning around his feet, not around his middle. | Again, slowly, from behind and above. | `abed753` |
| 7 | So the AI moved the turn to his middle, and now the roll carries him up and over. | The same fall in the next version: the roll, above the ground. | `f8d77d0` |
| 8 | Same fall, same camera. Before. And after. | The 7 m fall in each version, cut on "after". | `abed753`, `f8d77d0` |
| 9 | Now fall as far as you like. He rolls it off and runs on. | A 14 m fall at dusk, the roll, up on his feet; the end card. | today |

Words: 134, with the end card. About 58 s at the voice's pace.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The owner is building a whole game with AI and has written no code. | Yes ([CLAIMS.md](../CLAIMS.md)): the AI writes all the code. Not "AI made everything". |
| 2, 4 to 6 | He was meant to roll and went through the floor; he turned about his feet. | Yes: `abed753` as filmed; the fix's own account in `f8d77d0`. |
| 3 | A short fall lands softly, a higher one heavily, a long one in a roll. | Yes: `src/characters/moves.js` (heavy over 2.2 m, a roll over 6 m), and live. |
| 7 | The AI moved the turn to his middle; the roll carries him up and over. | Yes: `f8d77d0`. |
| 9 | Fall as far as you like. | Yes: nothing hurts him. |

## Shots

All on the level ground beside the home lake (seed 1), summer, clear, 3 pm; the last at 6.36 pm.
The boy is lifted and let go moving forward at 3 m/s (the game's own test helper), so every take is
the same fall. Slow motion is the game's own clock run slower, every frame drawn whole.

## Sound

The game's day music, low under the voice.

## To post

- **Title:** I asked for a roll. He went through the floor.
- **Description:** A bug from building my game: he was meant to roll out of a long fall, and sank into the ground instead. He was turning around his feet, not his middle. Both clips are the game as it really was, before and after the fix. Made with AI (Claude wrote the code; the voice is AI too). Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #bugs #madewithai #cozygames #animation #indiedev
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

To watch `e:\Games\_assets\shorts\002-through-the-floor\002-through-the-floor.mp4` and say yes, or
what to change.

## Notes

- 2026-11-28: made in one go at the owner's word, the brief written alongside. Looked at by Claude as
  stills only (a strip of frames; the first shot at three frames a second): nobody has yet seen it
  move or heard it.
- In line 1 the words "he went through the floor" come about half a second after he has sunk and
  stood again. The title says "I asked for a roll": the owner asked for the moves and took Claude's
  plan, which had the roll in it; the spoken line says "he was meant to", which is exact.
- 2026-11-28: the owner, having seen the shorts: "too short and missing some points; 40 to 60 seconds; mention at the start that I am building a game using AI completely, then a hook, then the story" ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md)). Rewritten: the opener first (worded so it is true: the AI writes all the code; the downloaded kit art means "AI made everything" would not be), then the hook, then the story with the steps the 25-second cut skipped. The earlier script is in the file's history.
- Line 9 says "and runs on": a running landing does run on (`moves.js`), but in the shot he is let go at 3 m/s; if the shot does not show him running on, the words go.
