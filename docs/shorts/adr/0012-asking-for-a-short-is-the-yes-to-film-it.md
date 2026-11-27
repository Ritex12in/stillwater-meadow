# 0012. Asking for a short is the yes to film it

- **Status:** accepted (Claude's reading of the owner's instructions; the owner may say otherwise)
- **Date:** 2026-11-28
- **Who decided:** The owner, by instruction: "make the next short", then "if it's done, work on 003".

## Context

[ADR 0009](0009-nothing-is-filmed-before-its-brief-is-approved.md) says nothing is filmed before the
owner approves its brief. For the first short the owner read the script and said "yes, film it". For
the second and third they asked for the shorts to be made, without asking to see a script first.

## Decision

When the owner asks for a short to be made, that is the approval to film it. Claude picks the idea
from IDEAS.md, writes the brief alongside (story, script, claims check, what was filmed from which
version), takes stills of every shot and looks at them before filming, and makes the short. The
owner's review of the finished short is the check. This refines 0009; it does not replace its
purpose: no short is posted that the owner has not watched.

## What follows

- A short can go from idea to a finished file in one sitting.
- The owner sees a script only as part of a finished short; a change they want costs a re-voice and
  the re-filming of the shots it touches (minutes, by `REUSE=1`).
- If the owner wants to read scripts first again, they say so and 0009 stands as written.
