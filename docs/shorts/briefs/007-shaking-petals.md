# 007. The shaking petals

- **Status:** filming: written and made on 2026-11-28 at the owner's word ("write 10 more short scripts and make videos"; the ideas and scripts are Claude's)
- **Idea:** C8 (new) in [IDEAS.md](../IDEAS.md)
- **Length:** about 53 seconds (set by the voice when made)
- **Shows only what is live on the site?** yes, from the publish of 2026-11-28
- **Approved by the owner on:** 2026-11-28, by asking for it to be made ([ADR 0012](../adr/0012-asking-for-a-short-is-the-yes-to-film-it.md)); the script itself they have not read

## The story

When the blossom was made to glow at night (`aa550e9`), the owner: "petals on ground started shaking while moving camera". Each petal was worked out point by point and was smaller than a pixel a few metres off, so it flickered as the camera moved. The first fix softened them by the size of a pixel and gave way to an even pink further off (`20bc2b4`); the owner: they "only render by measuring centre as camera position. Why can't we just use petals as fake painted on ground like grass?" That was done (`fab26a5`): a picture of scattered petals, made in code, laid over the ground.

## The opener

"I'm building a whole game with AI. I haven't written a single line of code." ([ADR 0013](../adr/0013-ai-said-first-then-hook-then-story-40-to-60-seconds.md))

## The hook

The petals flickering at night. "I asked for the cherry trees to glow at night. Then the petals on the ground started to shake."

## The script

The shots are in `tools/shorts/shorts/007-shaking-petals.mjs` (each one's version, place, hour and camera).

| # | Line (voice and caption) | Note | Filmed from |
|---|---|---|---|
| 1 | I'm building a whole game with AI. I haven't written a single line of code. | the opener | today |
| 2 | I asked for the cherry trees to glow at night. Then the petals on the ground started to shake. |  | `aa550e9` |
| 3 | Every petal was drawn on its own. Smaller than a pixel, they flickered as the camera moved. |  | `aa550e9` |
| 4 | The first fix hid the far ones. I said: now they only show round the camera. |  | `20bc2b4` |
| 5 | Then I asked: why can't we just paint the petals on the ground, like the grass? |  | `20bc2b4` |
| 6 | So it did. One picture of scattered petals, made in code, laid over the ground. |  | `fab26a5` |
| 7 | No flicker, and they reach as far as you can see. |  | `fab26a5` |
| 8 | My idea. The AI wrote the code. |  | today |

Words: 122, with the end card.

## Claims check

| Line | Claim | Allowed? |
|---|---|---|
| 1 | The owner is building a whole game with AI and has written no code. | Yes ([CLAIMS.md](../CLAIMS.md)). Not "AI made everything". |
| 3 | Each petal smaller than a pixel flickered as the camera moved. | Yes: the account in `20bc2b4`. |
| 4 | The first fix hid the far ones; they showed only round the camera. | Yes: `20bc2b4`, the owner's words. |
| 5 | The owner asked to paint them like the grass. | Yes: the owner's words. |
| 6, 7 | A picture of petals made in code; no flicker; as far as you can see. | Yes: `fab26a5`. "No flicker" is from the code; the owner has not confirmed it in play. |
| 8 | The owner's idea, the AI's code. | Yes. |

## Sound

The game's day music, low under the voice (the night take for night shots is not separate).

## To post

- **Title:** The shaking petals
- **Description:** I'm building a whole game with AI: I describe it, Claude writes the code. When the blossom was made to glow at night (`aa550e9`), the owner: "petals on ground started shaking while moving camera". Every old clip is the game as it really was. Made with AI (the voice is AI too). Play free in your browser: link in bio.
- **Tags:** #indiegame #gamedev #devlog #madewithai #cozygames #proceduralgeneration #indiedev
- **End card:** Stillwater Meadow · free in your browser

## Needed from the owner

To watch `e:\Games\_assets\shorts\007-shaking-petals\007-shaking-petals.mp4` and say yes, or what to change.

## Notes

- 2026-11-28: written and made in one sitting while the owner slept, at their word. The stills of every shot were looked at before filming (see below).
