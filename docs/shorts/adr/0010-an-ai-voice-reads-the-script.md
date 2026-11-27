# 0010. An AI voice reads the script

- **Status:** accepted (which voice: open)
- **Date:** 2026-11-28
- **Who decided:** The owner ("you ai voiceover"). The tool and the shortlist of voices are Claude's.

## Context

[ADR 0004](0004-voice-and-captions-both.md) says every short has a voice and captions, and left open
whose voice. Claude's pick was the owner's own; the owner chose an AI voice instead. This PC's
built-in voices (David, Zira, Mark, Ravi, Heera) are the old robotic kind. `edge-tts`, a free Python
package, reaches the neural voices Microsoft's Edge browser uses for reading aloud; it installed here
and works (tried 2026-11-28). It also gives the time each sentence is spoken, which is what the
captions need.

## Decision

The voice of every short is an AI voice, made from the brief's script by `edge-tts`. One voice is
used for all shorts, so the series sounds like one person. The script's lines are sent to Microsoft's
service to be spoken; nothing else is sent. The recording and its timings are kept with the short in
`e:\Games\_assets\shorts\NNN-name\`. A short's description says the voice is AI, as it says the code
is.

## What follows

- The owner picks the voice from samples (`e:\Games\_assets\shorts\voice-samples\`: the same two
  lines in six voices). Until then the voice is not fixed.
- The captions are timed from the voice's own sentence times: step 5 of the plan no longer waits on a
  recording from the owner.
- **Not checked: whether Microsoft's terms allow these voices in videos that earn money.** `edge-tts`
  is not an official Microsoft product; it uses the browser's read-aloud service. If the channel is to
  be monetised, this should be looked into, or a paid voice service chosen (a new ADR).
- It needs the internet when a short's voice is made, and the service could change or stop.
- A script can be re-voiced in seconds, so wording can be tried by ear.
