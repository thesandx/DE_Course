# The GCP station videos

This folder builds the explainer video of each station in the GCP course. One station has one video of two to three minutes, with a voice, captions, chapters and quick checks.

The decision and its reasons are in [ADR-0013](../../docs/adr/0013-make-station-videos-with-simcraft-and-keep-them-in-the-bucket.md). The rules for the content are in [`lib/course/gcp/README.md`](../../lib/course/gcp/README.md#explainer-videos).

## Files

| File                   | What it holds                                                                |
| ---------------------- | ---------------------------------------------------------------------------- |
| `stations/<slug>.json` | The script of one video: chapters, beats and quick checks. You edit this.    |
| `brand/brand.json`     | The colours, fonts and shape of the videos. They follow the design language. |
| `brand/fonts/`         | The font files the renderer loads.                                           |
| `make_video.py`        | Builds one video from one script.                                            |
| `collect.py`           | Copies the results of all videos into the files the app reads.               |

## The tools

The build uses two free tools. Neither is a dependency of the app.

- [simcraft](https://github.com/dotslashsimran/simcraft), the `vox-explainer` skill. It draws the frames in a browser and joins them into an MP4 file.
- [Kokoro](https://github.com/hexgrad/kokoro), a text-to-speech model that runs on your computer. It gives the time of every spoken word. The captions and the highlights use those times.

You also need Python 3.12, Node 22, `ffmpeg` and a Chromium for Playwright.

```bash
git clone https://github.com/dotslashsimran/simcraft ~/simcraft
python3.12 -m venv ~/video-venv
~/video-venv/bin/pip install kokoro soundfile numpy
```

## Build one video

```bash
~/video-venv/bin/python scripts/gcp-videos/make_video.py \
  scripts/gcp-videos/stations/data-lake.json \
  --simcraft ~/simcraft --work ~/video-work
```

- Add `--voice-only` to check a script fast. It makes the voice and the captions, and reports the problems, but draws no picture.
- One video takes about 10 minutes to draw.
- The result is in `~/video-work/<slug>/`: the MP4 file, a poster, the captions and `meta.json`.

The script stops when it finds a problem. The most frequent problems are these:

- A beat is longer than 8 seconds. Split it into two beats.
- A `mark` or an `at` word is not in the sentence the voice says.
- The picture is still for half a second. Give a `big` beat a longer text, or use a `card`.

## Write a script

A script is a list of chapters. A chapter is a list of beats. A beat is one sentence for the voice (`say`) and one picture (`device`).

| Device  | Shows                                        |
| ------- | -------------------------------------------- |
| `big`   | One large line, with an optional `sub` line  |
| `card`  | A `label`, a `head` and a `text`             |
| `list`  | A `label` and up to five `items`             |
| `stat`  | One number that counts up, with a `sub` line |
| `chart` | A line of `points`                           |

- `mark` highlights words of the text when the voice says the `at` word.
- `items_at` gives, for each list item, the spoken word that shows it.
- A chapter can end with a `check`: a `prompt`, `options`, the index of the `answer`, and a `why`. The player pauses there. The last chapter cannot have a check.

## Put the videos into the app

1. Build every video that changed.
2. Collect the results:

   ```bash
   python3 scripts/gcp-videos/collect.py --work ~/video-work --videos ~/video-upload
   pnpm format
   ```

   This writes `lib/course/gcp/videos/timings.ts` and the posters and captions in `public/gcp/videos/`.

3. Commit those files. Do not commit an MP4 file.
4. Upload the MP4 files to the app bucket. A person does this step, with their own Google account:

   ```bash
   gcloud storage cp ~/video-upload/*.mp4 gs://<GCS_BUCKET>/course-videos/gcp/
   ```

A station page shows its video only when the file is in the bucket. So you can merge the code before you upload. Upload a changed video and its `timings.ts` at about the same time, or the captions are out of step for a short time.
