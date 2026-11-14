# ADR-0013: Make station videos with simcraft, and keep the files in the bucket

- **Status:** Accepted
- **Date:** 2026-11-13
- **Deciders:** repository owner

> **Note, 2026-11-14.** The DE course now has one video per track, built and hosted the same way. The decision is unchanged. The paths changed: the scripts are in `scripts/course-videos/<course>/`, the timings are in `lib/course/videos/<course>.ts`, the MP4 files are at `course-videos/<course>/<slug>.mp4`, and the player is `components/course/CourseVideo.tsx`.

## Context

The owner asked for an explainer video on each section of the GCP course. The video must have a voice and captions, look like a video on a video site, and be simple and interactive. The owner named the [simcraft](https://github.com/dotslashsimran/simcraft) repository as the tool.

The course has 19 stations. A station changes when the exam guide changes, so a video must be cheap to make again.

Constraints:

- The app has no budget for a video service or a paid voice.
- The container image is about 64 MB. The 19 videos are about 80 MB.
- The bucket is private. Every read goes through a signed URL.
- An agent session has no production credentials. A person uploads files.

## Decision

We will make each video from a script file with simcraft and a local voice model. We will keep the MP4 files in the app bucket. The app has its own player.

- A script is `scripts/gcp-videos/stations/<slug>.json`. The simcraft `vox-explainer` skill draws it with the colours and fonts of the design language.
- Kokoro, a free text-to-speech model, makes the voice on the build computer. It gives the time of every word. The captions, the chapters and the quick checks use those times.
- The MP4 files are at `course-videos/gcp/<slug>.mp4` in the bucket. `services/course-video.service.ts` signs a read URL that lasts 6 hours.
- The timings are code in `lib/course/gcp/videos/timings.ts`. The posters and the captions files are in `public/gcp/videos/`.
- `components/gcp/StationVideo.tsx` plays the file. It draws the captions and pauses for a quick check when a chapter ends.
- A station with no file in the bucket shows no player. So the code and the files do not need to arrive together.

## Alternatives considered

### Option A — rendered MP4 files in the bucket, with our own player (chosen)

The learner gets a real video that works on every phone and in full screen. The files cost almost nothing to store. The player follows the design language and can pause for a question.

### Option B — commit the MP4 files to `public/`

This needs no upload step. But it adds 80 MB to the repository and more than doubles the image. Each changed video stays in the Git history for ever.

### Option C — embed videos from a video site

The site gives streaming and a player at no cost. But the videos are then public or unlisted, the page loads a third-party script, and the player cannot pause for our quick checks.

### Option D — animate the script in the browser, with no video file

This needs no file and no bucket. But the voice still needs an audio file, the animation engine becomes part of the app bundle, and full screen on an iPhone needs a real video.

### Option E — a paid voice or an avatar service

The voice can sound better. But each change costs money, and the script text goes to another company. The owner did not ask for it.

## Consequences

**Good**

- No new dependency in the app, no new environment variable, and no new service.
- A video costs only build time. One video takes about 10 minutes to make.
- The captions are text in the page, so a screen reader and a search can use them.

**Bad**

- A person must upload the files after each build. An old file with new timings shows captions out of step.
- A signed URL stops after 6 hours. A learner who leaves the page open longer must load it again.
- The build needs Python, `ffmpeg` and a model download. These are not part of `pnpm install`.
- The page asks the bucket if the file exists. The answer stays in memory for 10 minutes, or 1 minute when the file is absent.
