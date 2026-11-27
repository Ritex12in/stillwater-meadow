# 0007. Media outside the repo

- **Status:** accepted
- **Date:** 2026-11-27
- **Who decided:** The owner's standing rule; the folder layout is Claude's.

## Context

The repo goes to GitHub. The owner's standing rule: videos, renders and audio go to `e:\Games\_assets`, never into the project.

## Decision

Under `e:\Games\_assets\shorts\`: `NNN-name\` for each short, holding its frames, its voice recording, its working files and the finished `NNN-name.mp4` with a `NNN-name.txt` of the title, description and tags to post. Old versions of the game are checked out under `e:\Games\_assets\shorts\_versions\`. In the repo: these documents, the briefs, and the tools.

## What follows

- The repo stays small and holds nothing that cannot be made again.
- The media are not backed up by git: the owner's own backup, if any, is what keeps them.
