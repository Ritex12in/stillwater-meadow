# 001. The character

- **Status:** draft (not approved: nothing is filmed)
- **Idea:** A1 in [IDEAS.md](../IDEAS.md)
- **Length:** about 31 seconds
- **Shows only what is live on the site?** yes, but for one shot (line 6: the jump, which is not live; see Notes)
- **Approved by the owner on:** —

## The story

The owner cannot model or animate, and wanted a character that felt like theirs. The first player was
a simple figure (`5dcb32b`, 13 November), then a sculpted child (`c9b7c6f`). On 22 November two sets of
downloaded characters were tried, a free low-poly kit (`c112bbf`) and seven anime avatars (`0769acd`);
neither felt right. The owner drew character sheets instead and described what they saw: the head
round, then oval again (`da80b7d`, `9d2b54f`); the hair asked about ("whether it matched; it did
not", `36e98f0`), then "sharp spikes with a curve" (`da8f185`), then "few, big, separate spikes"
(`905b641`), then flame shapes from the flame's own maths (`d9e1567`), then given springs and
collision (`d10efd5`). The same day came two words, "Remove Vroid" (`770a715`), and the downloaded
avatars were gone. About 25 commits in a day, and no modelling program opened.

## The hook

Today's boy, close, his hair moving in the wind. "This character has no 3D model."

## The script

| # | Time | Line (voice and caption) | On screen | Filmed from |
|---|---|---|---|---|
| 1 | 0–2 s | This character has no 3D model. | Today's boy, close up, hair moving. | today |
| 2 | 2–6 s | Every strand of his hair is code. And I didn't write it. An AI did. | A slow turn round him. | today |
| 3 | 6–9 s | Day one, he looked like this. | Hard cut: the first figure, same pose, same camera. | `5dcb32b` |
| 4 | 9–13 s | I tried downloading characters. They never felt like mine. | The kit character, then an avatar, each pushed aside. | `c112bbf`, `0769acd` |
| 5 | 13–21 s | So I drew what I wanted, and described it. Round head. No, oval. Bigger hair. Spikes. With a curve. | The owner's sheet for a second; then the real versions, one per phrase, same pose. | `e469097`, `20fcba4`, `9d2b54f`, `36e98f0`, `da8f185`, `d9e1567` |
| 6 | 21–25 s | Then his hair got physics. | He jumps and lands; the hair bounces. | today (or `d10efd5`, running, if the jump is held back) |
| 7 | 25–29 s | No modelling software. I described him. An AI coded him. | Wide: him by the lake at sunset. | today |
| 8 | 29–31 s | Stillwater Meadow. Free, in your browser. | End card. | — |

Words: 78. Length: 31 s.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The character has no 3D model. | Yes: the characters are built in code (`src/characters/kid.js`). |
| 2 | Every strand of his hair is code; an AI wrote it, not the owner. | Yes. |
| 3 | He looked like this on day one. | Yes if filmed from `5dcb32b`, which is 13 November, the first day in the history. |
| 4 | Downloaded characters were tried and did not stay. | Yes: `c112bbf`, `0769acd`, removed in `770a715`. |
| 5 | The owner drew what they wanted and described it. | Yes, if the owner confirms the sheets are their own drawings (asked below). |
| 6 | The hair has physics. | Yes: `d10efd5`. |
| 7 | No modelling software was used for him. | Yes for the character. It does not say the whole game is code, which would not be true. |

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

1. Approval of this brief, or changes.
2. The voice: which of the six AI voices ([ADR 0010](../adr/0010-an-ai-voice-reads-the-script.md); samples in `e:\Games\_assets\shorts\voice-samples\`).
3. The character sheets: are they the owner's own drawings, may they be shown, and where are the files?
4. Whether line 6 may show the jump (not live yet) or should show him running (live).

## Notes

- 2026-11-27: drafted. Written before the owner asked for a pipeline first; kept as the first brief, not approved.
- 2026-11-27: "All code" cut from line 7 after the check of what is and is not made in code.
- The title says "I can't draw 3D", not "I can't draw": the owner did draw the sheets.
