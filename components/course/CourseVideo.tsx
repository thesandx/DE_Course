'use client';

import { useEffect, useRef, useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { ChoiceList, type ChoiceState } from '@/components/gcp/ChoiceList';
import { Icon } from '@/components/layout/Icon';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { chapterAt, checkReached, cueAt, formatClock } from '@/lib/course/videos/timeline';
import { cn } from '@/lib/utils';
import type { CourseVideo as CourseVideoData, VideoCheck } from '@/types/video';

export interface CourseVideoProps {
  video: CourseVideoData;
  /** The heading of the section, for example "The station in one video". */
  title: string;
  /** The MP4 file: a signed Cloud Storage URL. */
  src: string;
  /** One frame of the video, shown until the learner presses play. */
  poster: string;
  /** The captions as WebVTT, for a full-screen player that draws its own captions. */
  captionsSrc: string;
  className?: string;
}

/** The speeds the speed button steps through, in this order. */
const RATES = [1, 1.25, 1.5, 2, 0.75] as const;

/** How far the arrow keys move the video, in seconds. */
const SKIP_SECONDS = 5;

/** An iPhone has no full screen for a `div`, only for the video itself. */
type InlineVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** An old browser has no `fullscreenElement` at all, so `null` is not the only "no". */
function inFullscreen(): boolean {
  return document.fullscreenElement instanceof Element;
}

const CONTROL =
  'text-on-night hover:bg-night-raised rounded-pill inline-grid size-11 shrink-0 place-items-center';

interface QuickCheckProps {
  check: VideoCheck;
  onContinue: () => void;
}

/**
 * The question that pauses the video. A wrong pick stays marked and the
 * learner tries again; the learner can also skip it.
 */
function QuickCheck({ check, onContinue }: QuickCheckProps) {
  const [tries, setTries] = useState<number[]>([]);
  const heading = useRef<HTMLParagraphElement>(null);
  const answer = check.answers[0] ?? 0;
  const solved = tries.includes(answer);
  const lastWrong = tries.length > 0 && tries[tries.length - 1] !== answer;

  // The video paused by itself. Move the focus, so a keyboard and a screen
  // reader land on the question and not on a silent player.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  function stateOf(option: number): ChoiceState {
    if (tries.includes(option)) return option === answer ? 'right' : 'wrong';
    return solved ? 'muted' : 'idle';
  }

  return (
    <div className="bg-sunken border-line rounded-card animate-rise-in flex flex-col gap-3 border p-4">
      <p ref={heading} tabIndex={-1} className="eyebrow text-brand-deep outline-none">
        Quick check · the video is paused
      </p>
      <p className="text-body font-semibold">
        <InlineText text={check.prompt} />
      </p>
      <ChoiceList
        options={check.options}
        state={stateOf}
        onChoose={(option) => {
          if (!solved && !tries.includes(option)) setTries([...tries, option]);
        }}
        wobble={lastWrong}
      />
      {solved && (
        <p className="text-small text-ink-soft bg-surface rounded-input animate-rise-in p-3">
          <InlineText text={check.why} />
        </p>
      )}
      <Button variant={solved ? 'dark' : 'secondary'} onClick={onContinue} className="self-start">
        {solved ? 'Continue the video' : 'Skip the question'}
      </Button>
    </div>
  );
}

/**
 * The explainer video of a station or a track, with its own controls: play, a bar with
 * the chapter marks, captions, speed and full screen. Under the picture are
 * the chapters, and a quick check that pauses the video when a chapter ends.
 *
 * The picture is always dark, in both colour modes, because it is a film and
 * not a page. Everything around it follows the tokens.
 */
export function CourseVideo({
  video,
  title,
  src,
  poster,
  captionsSrc,
  className,
}: CourseVideoProps) {
  const shell = useRef<HTMLDivElement>(null);
  const media = useRef<InlineVideo>(null);
  const lastTime = useRef(0);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [rate, setRate] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [settled, setSettled] = useState<ReadonlySet<number>>(new Set());
  const [openCheck, setOpenCheck] = useState<number | null>(null);

  useEffect(() => {
    const onChange = (): void => setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const duration = video.duration;
  const cue = captions ? cueAt(video.cues, time) : undefined;
  const chapter = chapterAt(video.chapters, time);
  const check = openCheck === null ? undefined : video.checks[openCheck];
  const minutes = Math.max(1, Math.round(duration / 60));

  function play(): void {
    // A browser can refuse to play, for example when the signed URL is too
    // old. The `error` event reports that; the promise only repeats it.
    media.current?.play().catch(() => undefined);
  }

  function closeCheck(): void {
    if (openCheck === null) return;
    setSettled(new Set([...settled, openCheck]));
    setOpenCheck(null);
  }

  function resume(): void {
    closeCheck();
    play();
  }

  function togglePlay(): void {
    if (playing) media.current?.pause();
    else resume();
  }

  function seek(to: number): void {
    const target = Math.min(Math.max(to, 0), duration);
    if (media.current !== null) media.current.currentTime = target;
    lastTime.current = target;
    setTime(target);
    // The learner chose to go somewhere else: the open question is done.
    closeCheck();
  }

  function openChapter(start: number): void {
    seek(start);
    play();
  }

  function onTime(now: number): void {
    const previous = lastTime.current;
    lastTime.current = now;
    setTime(now);
    if (openCheck !== null) return;
    const reached = checkReached(video.checks, previous, now, settled);
    if (reached === -1) return;
    media.current?.pause();
    // The question is under the picture, and full screen hides it.
    if (inFullscreen()) void document.exitFullscreen();
    setOpenCheck(reached);
  }

  function nextRate(): void {
    const next = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length] ?? 1;
    if (media.current !== null) media.current.playbackRate = next;
    setRate(next);
  }

  function toggleFullscreen(): void {
    if (inFullscreen()) {
      void document.exitFullscreen();
    } else if (shell.current?.requestFullscreen !== undefined) {
      shell.current.requestFullscreen().catch(() => undefined);
    } else {
      media.current?.webkitEnterFullscreen?.();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    // The bar is a range input: it already moves with the arrow keys.
    if (event.target instanceof HTMLInputElement) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'k') togglePlay();
    else if (key === 'c') setCaptions(!captions);
    else if (key === 'f') toggleFullscreen();
    else if (key === 'arrowleft') seek(time - SKIP_SECONDS);
    else if (key === 'arrowright') seek(time + SKIP_SECONDS);
    else return;
    event.preventDefault();
  }

  return (
    <section
      aria-labelledby="course-video-heading"
      className={cn(
        'bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="eyebrow text-ink-faint">Watch first · about {minutes} min</p>
        <h2 id="course-video-heading" className="text-title">
          {title}
        </h2>
        <p className="text-small text-ink-soft">
          A simple walk through the main ideas, with captions. It stops for a quick question on the
          way.
        </p>
      </div>

      {/* A keyboard user reaches the controls with Tab; the keys here are shortcuts on top. */}
      <div
        ref={shell}
        role="group"
        aria-label="Video player"
        onKeyDown={onKeyDown}
        className={cn('bg-night-deep flex flex-col overflow-hidden', !fullscreen && 'rounded-card')}
      >
        <div className={cn('relative', fullscreen ? 'min-h-0 grow' : 'aspect-video')}>
          <video
            ref={media}
            src={src}
            poster={poster}
            playsInline
            preload="metadata"
            className="size-full object-contain"
            onClick={togglePlay}
            onPlay={() => {
              setPlaying(true);
              setStarted(true);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setFailed(true)}
            onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)}
          >
            <track kind="captions" src={captionsSrc} srcLang="en" label="English" />
          </video>

          {!started && !failed && (
            <button
              type="button"
              onClick={resume}
              aria-label="Play the video"
              className="absolute inset-0 grid place-items-center"
            >
              <span className="bg-on-night text-night-deep shadow-float squish inline-grid size-16 place-items-center rounded-full">
                <Icon name="play" filled className="size-7" />
              </span>
            </button>
          )}

          {cue !== undefined && check === undefined && (
            <p className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-3 sm:bottom-4">
              <span className="bg-night-deep/85 text-on-night text-small rounded-box sm:text-body px-2 py-1 text-center font-medium">
                {cue.text}
              </span>
            </p>
          )}

          {check !== undefined && (
            <p className="bg-night-deep/85 text-on-night text-body absolute inset-0 grid place-items-center p-4 text-center font-semibold">
              Quick check. Answer it under the video to go on.
            </p>
          )}
        </div>

        <div className="flex flex-col px-2 pb-1 sm:px-3">
          <div className="relative flex h-8 items-center">
            <div className="bg-night-line relative h-1 w-full rounded-full">
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div
                  className="bg-brand size-full origin-left"
                  style={{ transform: `scaleX(${duration > 0 ? time / duration : 0})` }}
                />
              </div>
              {video.chapters.slice(1).map((mark) => (
                <span
                  key={mark.start}
                  aria-hidden="true"
                  className="bg-night-deep absolute inset-y-0 w-0.5"
                  style={{ left: `${(mark.start / duration) * 100}%` }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={time}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="Position in the video"
                aria-valuetext={`${formatClock(time)} of ${formatClock(duration)}`}
                className="peer absolute -inset-y-4 inset-x-0 cursor-pointer opacity-0"
              />
              <span
                aria-hidden="true"
                className="bg-on-night pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform peer-focus-visible:scale-150"
                style={{ left: `${duration > 0 ? (time / duration) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className={CONTROL}
            >
              <Icon name={playing ? 'pause' : 'play'} filled={!playing} />
            </button>
            <p className="text-small text-on-night-soft px-1 font-mono tabular-nums">
              {formatClock(time)} / {formatClock(duration)}
            </p>
            <span className="grow" />
            <button
              type="button"
              onClick={() => setCaptions(!captions)}
              aria-pressed={captions}
              aria-label="Captions"
              className={cn(
                CONTROL,
                'text-small font-mono font-semibold',
                !captions && 'text-on-night-soft line-through',
              )}
            >
              CC
            </button>
            <button
              type="button"
              onClick={nextRate}
              aria-label={`Speed ${rate}x. Change the speed`}
              className={cn(CONTROL, 'text-small w-auto min-w-11 px-2 font-mono font-semibold')}
            >
              {rate}x
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Leave full screen' : 'Full screen'}
              className={CONTROL}
            >
              <Icon name={fullscreen ? 'shrink' : 'expand'} />
            </button>
          </div>
        </div>
      </div>

      {failed && (
        <Alert tone="danger" title="The video did not load">
          Load the page again to get a fresh link to the video.
        </Alert>
      )}

      {check !== undefined && <QuickCheck key={openCheck} check={check} onContinue={resume} />}

      <div className="flex flex-col gap-2">
        <h3 className="eyebrow text-ink-faint">Chapters</h3>
        <ol className="grid gap-1 sm:grid-cols-2">
          {video.chapters.map((item, index) => (
            <li key={item.start}>
              <button
                type="button"
                onClick={() => openChapter(item.start)}
                aria-current={index === chapter ? 'true' : undefined}
                className={cn(
                  'text-small rounded-input flex min-h-11 w-full items-center gap-3 px-3 text-left',
                  index === chapter
                    ? 'bg-sunken text-ink font-semibold'
                    : 'text-ink-soft hover:text-ink hover:bg-sunken',
                )}
              >
                <span className="text-ink-faint w-9 shrink-0 font-mono tabular-nums">
                  {formatClock(item.start)}
                </span>
                <span className="grow">{item.title}</span>
                {index === chapter && started && (
                  <span className="text-micro text-brand-deep shrink-0">
                    {playing ? 'Playing' : 'Paused'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
