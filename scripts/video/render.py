"""Render a 1080p H.264 walkthrough from genuine browser recordings and narration."""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".tools/media-deps"))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

WORK = ROOT / ".tools/video"
OUT = ROOT / "deliverables"
OUT.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")
SCENES = json.loads((WORK / "scenes.json").read_text(encoding="utf-8"))
POINTS = {
    "overview": ["One screen", "Six statuses", "Today pinned first"],
    "create": ["Name required", "New by default", "Richer contact context"],
    "timeline": ["Newest first", "Save + schedule", "Persistent updates"],
    "pipeline": ["Move between stages", "Totals by currency", "Load every lead"],
    "attention": ["Overdue reminders", "No next step", "Quiet for 7+ days"],
    "profile": ["Editable profiles", "Typed activities", "Archive and restore"],
    "exports": ["Independent scheduling", "Calendar download", "Filtered CSV export"],
    "quality": ["Desktop + mobile", "62 API tests per DB", "28 browser checks"],
}


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def wrapped(draw, value, face, width):
    lines = []
    current = ""
    for word in value.split():
        proposed = (current + " " + word).strip()
        if draw.textlength(proposed, font=face) > width and current:
            lines.append(current)
            current = word
        else:
            current = proposed
    return lines + [current]


def frame(scene, index):
    image = Image.new("RGB", (1920, 1080), "#102e28")
    draw = ImageDraw.Draw(image)
    draw.line((40, 96, 1880, 96), fill="#355249", width=1)
    draw.rounded_rectangle((42, 34, 78, 70), radius=10, fill="#dcba73")
    draw.line((51, 60, 67, 44), fill="#183c31", width=3)
    draw.line((54, 44, 67, 44, 67, 57), fill="#183c31", width=3)
    draw.text((92, 31), "LeadFlow.", font=font(29, True), fill="#f7f6ed")
    draw.text((1600, 40), "VATSAL  /  PRODUCT DEMO", font=font(15), fill="#bacabc")
    if scene["id"] == "intro":
        draw.text(
            (122, 233),
            "RELATIONSHIPS, WITH A NEXT STEP.",
            font=font(22),
            fill="#dcba73",
        )
        draw.text((112, 300), "LeadFlow.", font=font(120, True), fill="#f7f6ed")
        draw.text(
            (122, 475),
            "Good leads. Great conversations.",
            font=font(46),
            fill="#cbd8c7",
        )
        draw.text(
            (122, 566),
            "A focused CRM for timely follow-through.",
            font=font(29),
            fill="#a6bcae",
        )
        for i, label in enumerate(["TRACK LEADS", "LOG DISCUSSIONS", "FOLLOW THROUGH"]):
            x = 122 + i * 410
            draw.rounded_rectangle(
                (x, 697, x + 370, 769),
                radius=16,
                fill="#244b3f",
                outline="#3b6152",
                width=1,
            )
            draw.text((x + 25, 718), label, font=font(19, True), fill="#e4eadb")
        draw.text(
            (122, 877),
            "NEXT.JS   +   FASTAPI   +   POSTGRESQL",
            font=font(19),
            fill="#a5b9aa",
        )
    elif scene["id"] == "delivery":
        draw.text(
            (78, 143),
            "READY TO REVIEW. READY TO RUN.",
            font=font(24, True),
            fill="#dcba73",
        )
        draw.text(
            (74, 193), "The complete delivery", font=font(65, True), fill="#f7f6ed"
        )
        items = [
            ("01", "Public source", "github.com/vatsal2025/leadflow"),
            ("02", "Setup and configuration", "README + .env.example + Docker Compose"),
            ("03", "Working sample data", "8 seeded leads + 14 discussions"),
            (
                "04",
                "Evidence and walkthrough",
                "Tests, screenshots, verification and video",
            ),
        ]
        for i, (number, title, description) in enumerate(items):
            y = 330 + i * 126
            draw.rounded_rectangle((80, y, 1130, y + 102), radius=15, fill="#1d4337")
            draw.text((103, y + 27), number, font=font(27, True), fill="#dcba73")
            draw.text((174, y + 14), title, font=font(27, True), fill="#f6f6ed")
            draw.text((174, y + 56), description, font=font(23), fill="#b4c8b7")
        draw.rounded_rectangle((1190, 330, 1840, 815), radius=25, fill="#eaf0e2")
        draw.text(
            (1230, 382), "EXPLORE THE SOURCE", font=font(21, True), fill="#476445"
        )
        draw.text((1230, 445), "github.com", font=font(44, True), fill="#183c31")
        draw.text((1230, 506), "/vatsal2025/leadflow", font=font(32), fill="#315847")
        draw.line((1230, 603, 1795, 603), fill="#bdcbb8", width=2)
        draw.text((1230, 648), "Built by VATSAL", font=font(32, True), fill="#183c31")
        draw.text(
            (1230, 707), "Every conversation counts.", font=font(24), fill="#476445"
        )
    else:
        draw.text(
            (42, 138),
            f"{index:02d} / PRODUCT WALKTHROUGH",
            font=font(13, True),
            fill="#dcba73",
        )
        y = 205
        for line in wrapped(draw, scene["title"], font(34, True), 248):
            draw.text((42, y), line, font=font(34, True), fill="#f7f6ed")
            y += 47
        y = max(y + 75, 450)
        for item in POINTS[scene["id"]]:
            draw.ellipse((44, y + 8, 51, y + 15), fill="#dcba73")
            lines = wrapped(draw, item, font(20), 218)
            for line in lines:
                draw.text((68, y), line, font=font(20), fill="#bfd0bc")
                y += 28
            y += 27
        draw.text((42, 896), "ACTUAL APP RECORDING", font=font(13), fill="#91aa97")
        if scene["id"] == "quality":
            draw.rounded_rectangle(
                (861, 115, 1307, 997),
                radius=29,
                fill="#3a584a",
                outline="#839b84",
                width=2,
            )
            draw.text(
                (1430, 350), "Verified workflows", font=font(27, True), fill="#f6f6ed"
            )
            for i, item in enumerate(
                [
                    "Atomic database saves",
                    "Conflict-safe edits",
                    "Safe request retries",
                    "Secure sessions",
                ]
            ):
                draw.text((1430, 425 + i * 65), item, font=font(23), fill="#bfd0bc")
        else:
            draw.rounded_rectangle((316, 120, 1880, 1006), radius=16, fill="#e8eddf")
    draw.rectangle((0, 1008, 1920, 1080), fill="#102e28")
    # Discreet chapter progress marker, with no content hidden beneath captions.
    draw.rectangle((40, 1069, 1880, 1073), fill="#345247")
    draw.rectangle(
        (40, 1069, 40 + 1840 * (index + 1) / len(SCENES), 1073), fill="#b99b5d"
    )
    dest = WORK / f"{scene['id']}.frame.png"
    image.save(dest)
    return dest


def stamp(seconds):
    centis = round(seconds * 100)
    h, rem = divmod(centis, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02}:{s:02}.{cs:02}"


def srt_stamp(seconds):
    ms = round(seconds * 1000)
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def captions(scene):
    items = json.loads((WORK / f"{scene['id']}.captions.json").read_text())
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,25,&H00F2F6ED,&H00F2F6ED,&H00282E10,&H00282E10,0,0,0,0,100,100,0,0,1,1,0,2,80,80,23,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    rows = []
    for i, item in enumerate(items):
        start = item["start"] + 0.35
        end = min(
            item["end"] + 0.35,
            items[i + 1]["start"] + 0.35
            if i + 1 < len(items)
            else scene["duration"] - 0.15,
        )
        value = (
            item["text"]
            .replace("\\", "\\\\")
            .replace("{", "")
            .replace("}", "")
            .replace("\n", " ")
        )
        rows.append(f"Dialogue: 0,{stamp(start)},{stamp(end)},Default,,0,0,0,,{value}")
    (WORK / f"{scene['id']}.ass").write_text(header + "\n".join(rows), encoding="utf-8")
    return items


def duration(file):
    result = subprocess.run(
        [FFMPEG, "-i", str(file)], capture_output=True, text=True, check=False
    )
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not match:
        raise RuntimeError(f"Cannot read duration of {file}")
    h, m, s = map(float, match.groups())
    return h * 3600 + m * 60 + s


def run(args):
    result = subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args],
        check=False,
        cwd=WORK,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)


def main():
    subtitle_rows = []
    elapsed = 0
    clips = []
    for i, scene in enumerate(SCENES):
        sid = scene["id"]
        backdrop = frame(scene, i)
        items = captions(scene)
        for caption_index, item in enumerate(items):
            caption_end = min(
                item["end"] + 0.35,
                items[caption_index + 1]["start"] + 0.35
                if caption_index + 1 < len(items)
                else scene["duration"],
            )
            subtitle_rows.append(
                f"{len(subtitle_rows) + 1}\n{srt_stamp(elapsed + item['start'] + 0.35)} --> {srt_stamp(elapsed + caption_end)}\n{item['text']}\n"
            )
        args = ["-loop", "1", "-framerate", "30", "-i", str(backdrop)]
        video = WORK / f"{sid}.webm"
        if video.exists():
            args += [
                "-ss",
                str(max(0, duration(video) - scene["duration"])),
                "-i",
                str(video),
            ]
            if sid == "quality":
                resize = "scale=419:870:flags=lanczos"
                x = 874
            else:
                resize = "scale=1548:870:flags=lanczos"
                x = 324
            filters = f"[1:v]{resize},setsar=1,fps=30[screen];[0:v][screen]overlay={x}:128:shortest=1[base];"
            audio_index = 2
        else:
            filters = "[0:v]null[base];"
            audio_index = 1
        args += ["-i", str(WORK / f"{sid}.mp3")]
        filters += f"[base]subtitles={sid}.ass,fade=t=in:st=0:d=0.18,fade=t=out:st={scene['duration'] - 0.18}:d=0.18[v];[{audio_index}:a]adelay=350|350,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]"
        clip = WORK / f"{sid}.mp4"
        clips.append(clip)
        args += [
            "-filter_complex",
            filters,
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            str(scene["duration"]),
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-threads",
            "4",
            "-c:a",
            "aac",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-b:a",
            "160k",
            "-movflags",
            "+faststart",
            str(clip),
        ]
        run(args)
        print("Rendered", sid, flush=True)
        elapsed += scene["duration"]
    (WORK / "concat.txt").write_text(
        "\n".join(f"file '{p.name}'" for p in clips), encoding="utf-8"
    )
    output = OUT / "LeadFlow-Product-Walkthrough.mp4"
    run(
        [
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            "concat.txt",
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )
    (OUT / "LeadFlow-Product-Walkthrough.srt").write_text(
        "\n".join(subtitle_rows), encoding="utf-8"
    )
    Image.open(WORK / "intro.frame.png").save(OUT / "LeadFlow-Poster.png")
    run(["-i", str(output), "-f", "null", "-"])
    measured = duration(output)
    assert 120 <= measured <= 180, measured
    (OUT / "video-verification.json").write_text(
        json.dumps(
            {
                "duration_seconds": measured,
                "resolution": "1920x1080",
                "fps": 30,
                "video_codec": "H.264",
                "audio_codec": "AAC",
                "full_decode": "passed",
                "bytes": output.stat().st_size,
            },
            indent=2,
        )
    )
    print("Final video:", output, "duration:", measured, "seconds", flush=True)


if __name__ == "__main__":
    main()
