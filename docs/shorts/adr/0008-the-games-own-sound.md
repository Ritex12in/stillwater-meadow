# 0008. The game's own sound

- **Status:** proposed
- **Date:** 2026-11-27
- **Who decided:** Claude's pick, offered on 2026-11-27.

## Context

A short needs music under the voice. Commercial music brings licensing trouble and differs by platform. The game makes its own music in code (a kalimba over soft pads, major by day, minor by night) and has its own ambience, and `tools/film/audio.mjs` already records them.

## Decision

The sound under the voice is the game's own music and ambience, recorded from the game. Nothing licensed from elsewhere is mixed in. If the owner wants a trending sound, they add it in the app when posting.

## What follows

- No licensing questions on any platform.
- The shorts sound like the game.
- The music is quiet and slow: it will not drive fast cuts. To be judged on the first short.
