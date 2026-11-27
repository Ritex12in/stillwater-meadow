"""The voice of a short (docs/shorts, ADR 0010): each line of its script spoken by the AI voice, with
the time of every word, for the captions and the cuts to follow.

    python tools/shorts/voice.py <lines.json> <out dir> [voice]

`lines.json` is a list of strings. Writes `line-01.mp3`, `line-02.mp3`, ... and `voice.json`:
[{ "text", "file", "words": [{ "text", "at", "dur" }] }] (seconds from the line's start).
The lines are sent to Microsoft's read-aloud service (the edge-tts package); nothing else is.
"""
import asyncio
import json
import os
import sys

import edge_tts


async def speak(text, voice, path):
    words = []
    com = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    with open(path, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"text": chunk["text"], "at": chunk["offset"] / 1e7, "dur": chunk["duration"] / 1e7})
    return words


async def main():
    lines = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "en-US-AndrewNeural"
    os.makedirs(out, exist_ok=True)
    made = []
    for i, text in enumerate(lines):
        name = "line-%02d.mp3" % (i + 1)
        words = await speak(text, voice, os.path.join(out, name))
        made.append({"text": text, "file": name, "words": words})
    json.dump({"voice": voice, "lines": made}, open(os.path.join(out, "voice.json"), "w", encoding="utf-8"), indent=1)
    print("%d lines spoken by %s" % (len(made), voice))


asyncio.run(main())
