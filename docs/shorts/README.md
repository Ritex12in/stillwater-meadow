# Shorts: how we make short videos about Stillwater Meadow

Short vertical videos for Instagram Reels and YouTube Shorts that tell the story of the game being
made. This folder is the pipeline's memory: what has happened, what could be made, what is planned,
what was decided and why, and what was posted.

Nothing here is a video. Videos, voice recordings and renders live outside the repo in
`e:\Games\_assets\shorts\` ([ADR 0007](adr/0007-media-outside-the-repo.md)).

## What is where

| File | What it holds | When it changes |
|---|---|---|
| [HISTORY.md](HISTORY.md) | The game's story so far, day by day, with the commit of each turn. The source material. | After each milestone of the game. |
| [IDEAS.md](IDEAS.md) | Every short that could be made, with its status. | Whenever an idea comes up or moves on. |
| [PLAN.md](PLAN.md) | What is to be built and made next, in order, and the questions still open. | When the order or the answers change. |
| [CLAIMS.md](CLAIMS.md) | What a video may say about the game, checked against the code. | When the game changes what is true. |
| [adr/](adr/) | Decisions, one file each: the context, the decision, what follows from it. | A new file per decision; old ones are never rewritten, only superseded. |
| [briefs/](briefs/) | One file per short: its story, hook, script, shot list and status. | Through that short's life. |
| [LOG.md](LOG.md) | What was posted, where, when, and how it did. | After each post, and when numbers come in. |

## The stages of a short

A short moves through these in order. It does not move on until the stage's check is met.

| # | Stage | Who | Output | Check before moving on |
|---|---|---|---|---|
| 1 | Idea | either | A row in IDEAS.md | It tells one thing, and the story behind it is in HISTORY.md. |
| 2 | Brief | Claude drafts | `briefs/NNN-name.md`: story, hook, script, shots | Every line of the script passes CLAIMS.md. Every shot names the version of the game it is filmed from. |
| 3 | Approval | the owner | Brief marked `approved` | **Nothing is filmed before this** ([ADR 0009](adr/0009-nothing-is-filmed-before-its-brief-is-approved.md)). |
| 4 | Voice | Claude | The script's lines spoken by the AI voice ([ADR 0010](adr/0010-an-ai-voice-reads-the-script.md)), with each sentence's time | Every line is there, in order, and sounds right to the owner. |
| 5 | Film | Claude | Frames for each shot, from the real versions of the game | Each shot looked at as stills before the whole is rendered. |
| 6 | Edit | Claude | One vertical video with voice, captions and the game's sound | Captions inside the safe areas; length within the brief's; plays without sound and still makes sense. |
| 7 | Review | the owner | A yes, or changes | The owner has watched it through. |
| 8 | Post | the owner | The video on each platform, with the title and description from the brief | A row in LOG.md. |
| 9 | Learn | either | Numbers in LOG.md; a line in IDEAS.md or a new ADR if something should change | Looked at a week after posting. |

## The shape of every short

Story first, then a hook, then the video ([ADR 0003](adr/0003-story-then-hook-then-video.md)):

1. **The story** is what really happened: a want, a difficulty, a turn, a result. It is written in the
   brief before anything else, with the commits that show it.
2. **The hook** is the first two seconds: the one picture and line that make someone stay.
3. **The video** is the story told in 15 to 35 seconds, with a voice and captions
   ([ADR 0004](adr/0004-voice-and-captions-both.md)), in a tall frame
   ([ADR 0002](adr/0002-vertical-short-and-safe.md)).

## Rules that hold for all of them

- **True.** Footage of the past is the game as it was at that commit, not a mock-up
  ([ADR 0006](adr/0006-the-past-is-filmed-from-the-real-versions.md)). What is said passes
  [CLAIMS.md](CLAIMS.md) ([ADR 0005](adr/0005-made-with-ai-said-plainly-and-only-true-claims.md)).
- **Ours.** The sound is the game's own music and ambience
  ([ADR 0008](adr/0008-the-games-own-sound.md)).
- **Reproducible.** A short is made by a command from its brief, so it can be made again when the
  game changes.

## Status

The pipeline is set up on paper (2026-11-27). Two tools exist (2026-11-28): one that runs and opens any
past version of the game, and a test of the tall frame with its safe areas. The maker is built and the first short is made (2026-11-28), waiting for
the owner's review: see [PLAN.md](PLAN.md).
