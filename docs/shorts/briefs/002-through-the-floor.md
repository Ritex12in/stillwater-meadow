# 002. Through the floor

- **Status:** review: made on 2026-11-28 at the owner's word ("make the next short"; the choice of idea and the script are Claude's); waits for the owner to watch it
- **Idea:** B3 in [IDEAS.md](../IDEAS.md)
- **Length:** 24 seconds
- **Shows only what is live on the site?** yes (the fix is live; the bug is shown as it was)
- **Approved by the owner on:** 2026-11-28, by asking for it to be made; the script itself they have not read

## The story

When jumping and falling were built, a fall of more than six metres was to end in a forward roll. In
the version it was first built in (`abed753`) the boy tucked, tipped forward and sank out of sight:
the figure turns about its feet, so a full turn took his head and back down through the ground. The
next commit (`f8d77d0`) carries the tucked figure round its own middle instead, up and over. Both
versions are in the history, so both are filmed as they were: the same fall, the same camera.

## The hook

He drops out of the sky over the lake, lands, and is gone. "He was meant to roll out of a long fall.
He went through the floor."

## The script

| # | Line (voice and caption) | On screen | Filmed from |
|---|---|---|---|
| 1 | He was meant to roll out of a long fall. He went through the floor. | A fall of 28 m, arms and legs spread; he lands and sinks from sight; then stands as if nothing happened. | `abed753` |
| 2 | Watch it again, slowly. He lands, tucks, tips forward, and he is gone. | The same from 7 m, at three tenths speed, from his side. | `abed753` |
| 3 | The bug: he was turning around his feet, not around his middle. | Again, slowly, from behind and above. | `abed753` |
| 4 | So now the roll carries him up and over. | The same fall in the next version: the roll, above the ground, dust rising. | `f8d77d0` |
| 5 | Fall as far as you like. He rolls it off. | A fall of 14 m at dusk, the roll, up on his feet. | today |
| 6 | Made by describing it to an AI. Stillwater Meadow, free in your browser. | End card. | today |

Words: 69. Length: 24.0 s (set by the voice: en-US-Andrew).

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | He was meant to roll; he went through the floor. | Yes: `abed753`, as filmed. |
| 3 | He turned about his feet, not his middle. | Yes: the fix's own account (`f8d77d0`; `src/characters/movepose.js`, "the hips turn about the feet, so the ball is carried round its own middle instead"). |
| 4 | The roll now carries him up and over. | Yes: `f8d77d0`, as filmed. |
| 5 | "Fall as far as you like." | Yes: nothing hurts him; any fall over six metres ends in the roll. |
| 6 | Made by describing it to an AI. | Yes. |

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
