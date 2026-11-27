# 0006. The past is filmed from the real versions

- **Status:** proposed
- **Date:** 2026-11-27
- **Who decided:** Claude's pick; the owner liked the idea of showing how the character changed but has not been asked about the method.

## Context

The stories are about how the game changed. Every one of its 155 commits is the whole game as it was. An old look could be faked by hand, or the real old game could be run and filmed.

## Decision

A shot of the game as it was is filmed from the game at that commit: checked out into its own folder (a git worktree outside the repo), run on its own port, with the same camera and pose as the shots it is cut against. Nothing is mocked up. If a version will not run, the short says so or does without it.

## What follows

- A tool is needed to check out a commit, install what it needs, run it and film it (PLAN.md, step 2).
- Old versions lack today's test handle (`window.__meadow`) in part or whole, so driving the camera in them may need a small shim per era; how much is not known until tried.
- Each brief's shot list names the commit of every shot.
