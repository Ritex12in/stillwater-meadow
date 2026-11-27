# Plan

What is done, what is next, in order, and what the owner still has to answer. Updated whenever any of
it changes.

## Where things stand (2026-11-28)

| Piece | State |
|---|---|
| These documents: the stages, the history, the ideas, the claims list, nine decisions | written |
| A landscape film of the game (`tools/film/`: frame-by-frame rendering, the game's sound recorded, an edit by ffmpeg) | exists, from 22 November; makes 1920 x 1080 only |
| Debug commands that set up a shot (`time`, `weather`, `season`, `tp`, `goto`, `tick rate`, `tick freeze`) | exist, on `endless-world` |
| Picture sheets of the moves (`tools/move-sheet.mjs`) | exist |
| Filming an old version (`tools/shorts/version.mjs`): checks out a commit outside the repo, serves it, opens it | built and tried (step 2) |
| The tall frame (`tools/shorts/frame-test.mjs`): 1080 x 1920, the interface hidden, safe areas, a caption in the game's font | a test still made (step 3); not yet looked at on a phone |
| The maker (`tools/shorts/make.mjs`): voice, timing, each shot filmed from its own version, captions, edit | built; made short 001 |
| Shorts | 001 (the character, 27 s), 002 (a bug: through the floor, 24 s) and 003 (one valley to a world, 26 s) made; none yet watched by the owner; none posted |

## The order of work

Each step ends with something the owner can look at. A step is not begun until the one before is
agreed, and no short is filmed before its brief is approved
([ADR 0009](adr/0009-nothing-is-filmed-before-its-brief-is-approved.md)).

| # | Step | What it produces | Depends on |
|---|---|---|---|
| 1 | **The owner reads this folder** and answers the open questions below. | Decisions; proposed ADRs become accepted or are replaced. | — |
| 2 ✔ | **Can the past be filmed?** *Done 2026-11-28: yes, all three run (see below).* Try three old versions (the baseline `620f25a`, the first children `c9b7c6f`, the day of the hair `d10efd5`): check out, install, run, take one still each with the same camera. | Three stills side by side, and a note in HISTORY.md of which versions run. Proves or breaks [ADR 0006](adr/0006-the-past-is-filmed-from-the-real-versions.md). | step 1 |
| 3 ◐ | **A vertical frame.** *A test still is made (`e:\Games\_assets\shorts\frame-test.png`); the owner has still to look at it on their phone.* The film tool renders 1080 x 1920; cameras framed for a tall picture; the safe areas drawn as guides on a test still. | One test still with guides, checked on the owner's phone. | step 1 |
| 4 ✔ | **Captions.** *Done 2026-11-28, in `tools/shorts/make.mjs`: the spoken words a few at a time, timed from the voice's own word times.* Burned in from a script's lines and timings; the game's display font; inside the safe areas. | A 5-second test clip. | step 3 |
| 5 ✔ | **Voice.** *Done 2026-11-28: `tools/shorts/voice.py`.* The script's lines spoken by the AI voice (`edge-tts`), with the time of each sentence, for the captions and cuts to follow. *Tried by hand 2026-11-28; not yet a tool.* | The test clip with a voice. | step 4, question 1 |
| 6 ✔ | **One command per short.** *Done 2026-11-28: `node tools/shorts/make.mjs 001` (a shot list in `tools/shorts/shorts/`; `STILLS=1` for one still a shot, `REUSE=1` to keep what is already filmed).* A brief's shot list as data; `node tools/shorts/make.mjs 001` films, edits and writes the video and its text file. | The command, run on a throwaway test. | steps 2 to 5 |
| 7 ◐ | **Short 001**, once its brief is approved. *Filmed and edited 2026-11-28; waits for the owner to watch it.* | The first short, for the owner's review. | step 6, the brief approved |
| 8 | **Post, log, learn.** | A row in [LOG.md](LOG.md); after a week, what to change. | step 7 |

Steps 2 and 3 do not depend on each other and can be done in either order.

### What step 2 found (2026-11-28)

`node tools/shorts/version.mjs 620f25a c9b7c6f d10efd5 HEAD`: every one of them runs today, the first commit included (stills in `e:\Games\_assets\shorts\_versions\trial-<commit>.png`).

| Version | Runs | Can be driven by script |
|---|---|---|
| `620f25a` (13 Nov, the baseline: plain files, no build) | yes | **No handle at all.** The camera can only be moved as a player moves it (the mouse), and the hour and weather by its own on-screen controls. Shots from it must be simple: the view it opens on, or a slow mouse turn. |
| `c9b7c6f` (14 Nov, the first sculpted children) | yes | The player, the camera and the clock (`tick`), but no travelling: shots near where it starts. |
| `d10efd5` (22 Nov, hair with physics) | yes | Everything a shot needs, travelling included. |
| today | yes | Everything. |

The packages have not changed since the first Vite commit, so old versions borrow this repo's `node_modules`: no installing. The versions in between have not been tried; a brief's shot list is checked with the same command before it is approved.

## Open questions for the owner

| # | Question | Claude's pick | Why it matters |
|---|---|---|---|
| 1 | ~~**Whose voice?**~~ **Answered 2026-11-28: an AI voice ([ADR 0010](adr/0010-an-ai-voice-reads-the-script.md)). Still open: which one, from the six samples in `e:\Games\_assets\shorts\voice-samples\`.** | The owner's own, recorded on a phone, one take per line. | A person's voice makes the diary theirs. This PC's built-in voices are not good enough; a voice service would be a new thing to choose and perhaps pay for. |
| 2 | ~~**Unreleased features:** show them as "coming soon", or wait for the release?~~ **Settled 2026-11-28: the owner published everything; nothing in HISTORY.md is unreleased now.** | Start with stories that are live (A1, A2, A4, D1, D5); hold the rest. | The public site is at 23 November. Showing gliding or continents now promises what a visitor cannot find. |
| 3 | ~~**"Everything is coded":** drop the claim, or make it true?~~ **Answered 2026-11-28: the downloaded art stays ("external assets are good"); the claim is dropped.** | Drop it; say what is code ([CLAIMS.md](CLAIMS.md)). | It is not true today: about 12 MB of downloaded plants, rocks, props and ground textures. Making it true is a project on the game, not on the videos. |
| 4 | **The owner's character sheets:** may they appear, and where are the files? | Yes, for a second in A1. | They are the turn of the character's story. |
| 5 | **A name on the end card?** | The game's name and "free in your browser" only. | The owner's choice how they appear. |
| 6 | **How often?** | Decide after the first three: one a week is a pace the pipeline can keep. | Sets how much of this to automate. |
| 7 | **Bugs fixed before a commit** (B2, B4, B5): may the broken state be brought back by undoing the fix in a copy? | Yes, if the short says "this is how it looked". | Otherwise only committed bugs can be shown. |
| 8 | **Language:** English only? | English. | Captions and voice would double otherwise. |

## What could go wrong

| Risk | What we do about it |
|---|---|
| Old versions do not run today (missing files, changed tools). | Step 2 finds out before anything is promised. A short uses only versions that run. |
| Old versions cannot be driven to the same camera and pose (no test handle then). | A small shim per era, or a simpler shot. Known after step 2. |
| Frame-by-frame rendering of a 30-second short takes long on the owner's laptop. | Measured in step 6; shots are rendered once and kept. |
| The safe-area numbers are wrong for the owner's phone. | Checked in step 3 on the phone itself. |
| A short says something that stops being true when the game changes. | CLAIMS.md is re-checked when the game changes; LOG.md records what each posted short said. |
| The AI voice's service changes, stops, or may not be used in videos that earn money (not checked). | [ADR 0010](adr/0010-an-ai-voice-reads-the-script.md); a paid service would be a new ADR. |
