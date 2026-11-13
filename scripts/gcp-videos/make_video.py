"""Build one GCP station explainer video from its script.

Usage:
  python make_video.py <script.json> --simcraft <path> --work <dir> [--stills 2,9.5] [--voice-only]

  script.json   the station script: chapters, and in each chapter the beats (format in README.md)
  --simcraft    a checkout of https://github.com/dotslashsimran/simcraft (its vox-explainer skill renders the picture)
  --work        where the voiceover, the scene file and the renders go (one folder per station)
  --stills      only write JPEG stills at those seconds, to check layouts
  --voice-only  stop after the voiceover, the captions and the timings

The voice comes first, as the vox-explainer skill asks. Each beat is spoken by the Kokoro model, which also gives
the time of every word. So a beat starts on its first word, a highlight sweeps on the word it marks, and each
caption cue has the exact time of its sentence. Nothing is timed by hand.

It needs Python 3.12 with `kokoro`, `soundfile` and `numpy`, and ffmpeg on the PATH.
"""

import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
RATE = 24000
LEAD_IN = 0.45  # silence before the first word
BEAT_GAP = 0.26  # silence between two beats
CHAPTER_GAP = 0.75  # silence before a new chapter
TAIL = 1.1  # the last frame holds this long after the last word
SCALE = 2 / 3  # of 1920x1080
FPS = 12

# The model reads these terms wrong. The captions keep the written form.
SAY_AS = {
    "JSON": "jason",
    "PostgreSQL": "Postgres",
    "IOPS": "eye-ops",
    "AEAD": "A E A D",
    "12345": "one two three four five",
    "12346": "one two three four six",
}


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def norm(word):
    """The same normal form that vox-explainer's build.py uses to find a word."""
    return re.sub(r"[^\w']", "", word.lower())


def spoken(text):
    for written, said in SAY_AS.items():
        text = re.sub(rf"(?<![\w-]){re.escape(written)}(?![\w-])", said, text)
    return text


_pipeline = None


def synth(text, voice, speed, cache):
    """Speak `text`. Returns (samples, [(start, end, word)]), trimmed to the first and last word."""
    key = hashlib.sha256(f"{voice}|{speed}|{text}".encode()).hexdigest()[:20]
    wav_p, words_p = cache / f"{key}.wav", cache / f"{key}.json"
    if wav_p.exists() and words_p.exists():
        return sf.read(wav_p, dtype="float32")[0], json.loads(words_p.read_text())

    global _pipeline
    if _pipeline is None:
        from kokoro import KPipeline

        _pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")

    chunks, words, offset = [], [], 0.0
    for result in _pipeline(text, voice=voice, speed=speed):
        audio = result.audio.numpy()
        open_word = None
        for token in result.tokens or []:
            if token.start_ts is None or token.end_ts is None:
                continue
            start, end = offset + token.start_ts, offset + token.end_ts
            if open_word is None:
                open_word = [start, end, token.text]
            else:
                open_word[1], open_word[2] = end, open_word[2] + token.text
            if token.whitespace:
                words.append(open_word)
                open_word = None
        if open_word is not None:
            words.append(open_word)
        chunks.append(audio)
        offset += len(audio) / RATE
    audio = np.concatenate(chunks)
    words = [w for w in words if norm(w[2])]
    if not words:
        raise SystemExit(f"no words came back for: {text!r}")

    first, last = max(0.0, words[0][0] - 0.04), min(len(audio) / RATE, words[-1][1] + 0.06)
    audio = audio[int(first * RATE) : int(last * RATE)]
    words = [[round(a - first, 3), round(b - first, 3), w] for a, b, w in words]
    sf.write(wav_p, audio, RATE)
    words_p.write_text(json.dumps(words))
    return audio, words


def sentences(text):
    """Caption cues: one sentence each, and a long sentence breaks at a comma near its middle."""
    out = []
    for sentence in re.split(r"(?<=[.?!])\s+", text.strip()):
        if len(sentence) <= 84:
            out.append(sentence)
            continue
        commas = [m.end() for m in re.finditer(r"[,;:]\s", sentence)]
        if not commas:
            out.append(sentence)
            continue
        cut = min(commas, key=lambda i: abs(i - len(sentence) / 2))
        out += [sentence[:cut].strip(), sentence[cut:].strip()]
    return [s for s in out if s]


def stamp(seconds):
    h, rest = divmod(seconds, 3600)
    m, s = divmod(rest, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def find(toks, phrase, after, before):
    """Seconds of the first word of `phrase` between `after` and `before`, or None."""
    want = [norm(x) for x in str(phrase).split() if norm(x)]
    for i, (word, at) in enumerate(toks):
        if at < after - 0.001 or at >= before:
            continue
        if all(i + k < len(toks) and toks[i + k][0] == w for k, w in enumerate(want)):
            return at
    return None


def main():
    script_p = Path(sys.argv[1]).resolve()
    script = json.loads(script_p.read_text())
    slug = script["station"]
    work = Path(arg("--work", "work")).resolve() / slug
    cache = work.parent / ".voice-cache"
    work.mkdir(parents=True, exist_ok=True)
    cache.mkdir(exist_ok=True)
    voice, speed = script.get("voice", "af_heart"), script.get("speed", 1.06)

    # ---------- the voiceover, with the time of every word ----------
    pieces, words, beats, cues, chapters = [], [], [], [], []
    cursor = LEAD_IN
    pieces.append(np.zeros(int(LEAD_IN * RATE), dtype="float32"))
    for c, chapter in enumerate(script["chapters"]):
        if c > 0:
            pieces.append(np.zeros(int((CHAPTER_GAP - BEAT_GAP) * RATE), dtype="float32"))
            cursor += CHAPTER_GAP - BEAT_GAP
        chapter_start = None
        for beat in chapter["beats"]:
            beat = dict(beat)
            say = beat.pop("say")
            audio, beat_words = synth(spoken(say), voice, speed, cache)
            start = cursor
            if chapter_start is None:
                chapter_start = start
            shifted = [[round(start + a, 3), round(start + b, 3), w] for a, b, w in beat_words]
            words += shifted

            # Captions carry the written text. The spoken words give the times, spread by word count.
            parts = sentences(say)
            counts = [max(1, len([w for w in spoken(p).split() if norm(w)])) for p in parts]
            index = 0
            for part, count in zip(parts, counts):
                first = shifted[min(index, len(shifted) - 1)]
                last = shifted[min(index + count, len(shifted)) - 1]
                cues.append([first[0], last[1], part])
                index += count

            pieces.append(audio)
            cursor += len(audio) / RATE
            gap = beat.pop("pause", BEAT_GAP)
            pieces.append(np.zeros(int(gap * RATE), dtype="float32"))
            cursor += gap
            beat["at"] = round(start, 3)
            beat.setdefault("bg", "a" if len(beats) % 2 == 0 else "b")
            beats.append(beat)
        chapters.append({"title": chapter["title"], "start": round(max(0.0, chapter_start - 0.12), 2)})
    pieces.append(np.zeros(int(TAIL * RATE), dtype="float32"))
    voiceover = np.concatenate(pieces)
    duration = len(voiceover) / RATE
    sf.write(work / "vo.wav", voiceover, RATE)
    (work / "words.json").write_text(json.dumps(words))

    # A cue stays on screen until the next one starts, but never longer than 1.2 s after its last word.
    for i, cue in enumerate(cues):
        limit = cues[i + 1][0] if i + 1 < len(cues) else duration
        cue[1] = round(min(limit - 0.02, cue[1] + 1.2), 3)
    vtt = ["WEBVTT", ""]
    for i, (a, b, text) in enumerate(cues):
        vtt += [str(i + 1), f"{stamp(a)} --> {stamp(b)}", text, ""]
    (work / "captions.vtt").write_text("\n".join(vtt))

    # ---------- checks: every word a beat points at must be in the voiceover ----------
    toks = [(norm(w), a) for a, _, w in words]
    problems = []
    for i, beat in enumerate(beats):
        end = beats[i + 1]["at"] if i + 1 < len(beats) else duration
        length = end - beat["at"]
        if length > 8.0:
            problems.append(f"beat {i + 1} ({beat['device']}) runs {length:.1f}s; split it")
        if beat["device"] == "big" and len(beat["text"]) < 10:
            problems.append(f"beat {i + 1}: big text {beat['text']!r} is too short; the frame reads as frozen")
        for key in ("mark", "headmark", "submark"):
            if beat.get(key):
                at = beat.get(key + "_at", beat[key]).split()[0]
                if find(toks, at, beat["at"], end) is None:
                    problems.append(f"beat {i + 1}: {key} word {at!r} is not spoken in the beat")
                text = " ".join(str(beat.get(f, "")) for f in ("text", "head", "sub"))
                if beat[key].lower() not in text.lower():
                    problems.append(f"beat {i + 1}: {key} {beat[key]!r} is not in the beat's text")
        for item in beat.get("items_at", beat.get("items", []) if beat["device"] == "list" else []):
            if find(toks, item, beat["at"], end) is None:
                problems.append(f"beat {i + 1}: list word {item!r} is not spoken in the beat")
        for tag in beat.get("tags", []):
            if tag.get("at") and find(toks, tag["at"], beat["at"], end) is None:
                problems.append(f"beat {i + 1}: tag word {tag['at']!r} is not spoken in the beat")
    if problems:
        raise SystemExit("script problems:\n  " + "\n  ".join(problems))

    scene = {
        "audio": "vo.wav",
        "format": "16:9",
        "brand": str(HERE / "brand"),
        "twos": True,
        "fps": FPS,
        "tail_ms": int(TAIL * 1000) - 100,
        "beats": beats,
    }
    (work / "scene.json").write_text(json.dumps(scene, indent=1))
    meta = {
        "station": slug,
        "duration": round(duration, 2),
        "words": len(words),
        "chapters": chapters,
        "cues": [[round(a, 2), round(b, 2), text] for a, b, text in cues],
    }
    (work / "meta.json").write_text(json.dumps(meta, indent=1))
    print(f"{slug}: {duration:.1f}s, {len(words)} words, {len(beats)} beats, {len(chapters)} chapters")
    if "--voice-only" in sys.argv:
        return

    # ---------- the picture: simcraft's vox-explainer ----------
    build = Path(arg("--simcraft")).expanduser() / "skills/video/vox-explainer/scripts/build.py"
    for image in {b["img"] for b in beats if b.get("img")}:
        source = script_p.parent / image
        if not source.exists():
            raise SystemExit(f"missing picture: {source}")
        (work / image).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, work / image)
    spec_step = [sys.executable, str(build), str(work / "scene.json"), "--words", str(work / "words.json")]
    stills = arg("--stills")
    # build.py resolves every highlight to a time and writes the spec. One still is the cheapest way to run it.
    subprocess.run(spec_step + ["--stills", stills or "0"], check=True)
    if stills:
        return

    # Render at 1280x720. The picture is drawn "on twos" (12 drawings a second), so 12 frames a second lose nothing.
    spec = work / ".scene_spec.json"
    silent, final = work / "silent.mp4", work / f"{slug}.mp4"
    render = build.parent / "render.mjs"
    subprocess.run(["node", str(render), str(spec), str(silent), "--scale", str(SCALE)], check=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(work / "vo.wav"), "-map", "0:v", "-map", "1:a",
         "-vf", "scale=1280:720", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p",
         "-g", "48", "-c:a", "aac", "-b:a", "56k", "-ac", "1", "-movflags", "+faststart", str(final)],
        check=True,
    )  # fmt: skip
    silent.unlink()
    poster_at = beats[1]["at"] + 1.5 if len(beats) > 1 else 1.0
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", str(poster_at), "-i", str(final), "-frames:v", "1", "-q:v", "4",
         str(work / f"{slug}.jpg")],
        check=True,
    )  # fmt: skip
    print("wrote", final)
    sys.exit(subprocess.run([sys.executable, str(build.parent / "motion_check.py"), str(final)]).returncode)

main()
