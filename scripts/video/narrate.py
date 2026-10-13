"""Generate scene narration and timed captions; media tools live outside app dependencies."""

import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".tools/media-deps"))
import edge_tts
import imageio_ffmpeg

OUT = ROOT / ".tools/video"
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    scenes = json.loads(
        (ROOT / "docs/video/storyboard.json").read_text(encoding="utf-8")
    )
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    for scene in scenes:
        path = OUT / f"{scene['id']}.mp3"
        captions = []
        cached_text = path.with_suffix(".text.txt")
        if (
            not path.exists()
            or not cached_text.exists()
            or cached_text.read_text(encoding="utf-8") != scene["narration"]
        ):
            communicate = edge_tts.Communicate(
                scene["narration"],
                "en-US-GuyNeural",
                rate="+5%",
                boundary="SentenceBoundary",
            )
            with path.open("wb") as audio:
                async for event in communicate.stream():
                    if event["type"] == "audio":
                        audio.write(event["data"])
                    elif event["type"] == "SentenceBoundary":
                        captions.append(
                            {
                                "start": event["offset"] / 10_000_000,
                                "end": (event["offset"] + event["duration"])
                                / 10_000_000,
                                "text": event["text"],
                            }
                        )
            (OUT / f"{scene['id']}.captions.json").write_text(
                json.dumps(captions), encoding="utf-8"
            )
            cached_text.write_text(scene["narration"], encoding="utf-8")
        result = await asyncio.to_thread(
            subprocess.run,
            [ffmpeg, "-i", str(path)],
            capture_output=True,
            text=True,
            check=False,
        )
        match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
        if not match:
            raise RuntimeError(f"Cannot measure narration: {scene['id']}")
        hours, minutes, seconds = map(float, match.groups())
        scene["duration"] = round(hours * 3600 + minutes * 60 + seconds + 1.0, 2)
        print(scene["id"], scene["duration"], "seconds", flush=True)
    (OUT / "scenes.json").write_text(json.dumps(scenes, indent=2), encoding="utf-8")
    print(
        "Total duration:",
        round(sum(scene["duration"] for scene in scenes), 2),
        "seconds",
    )


if __name__ == "__main__":
    asyncio.run(main())
