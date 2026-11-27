# 0002. Vertical, short, inside the safe areas

- **Status:** proposed
- **Date:** 2026-11-27
- **Who decided:** Claude's pick, offered on 2026-11-27; the owner has not objected, nor said yes.

## Context

Reels and YouTube Shorts are watched on phones, held upright, mostly once, often without sound. Both apps draw their own buttons and text over the picture. The game's existing film (`tools/film/`) is 1920 x 1080, landscape.

## Decision

Every short is 1080 x 1920 (9:16), 30 frames a second, H.264 with AAC sound, 15 to 35 seconds long. Captions and anything that must be read stay out of the top 250 pixels and the bottom 450, and 60 pixels in from each side. The same file goes to both platforms, with neither's watermark.

## What follows

- The film tools need a vertical mode and cameras framed for a tall picture (PLAN.md, step 3).
- A story too long for 35 seconds is two shorts.
- The safe-area numbers are from the platforms' general guidance, not measured on the owner's phone: to be checked on the first render.
