import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GcpVideo } from '@/types/gcp';

import { StationVideo } from './StationVideo';

const VIDEO: GcpVideo = {
  station: 'demo',
  duration: 90,
  chapters: [
    { title: 'The mission', start: 0.3 },
    { title: 'The fix', start: 30 },
    { title: 'Recap', start: 70 },
  ],
  cues: [
    { start: 0.5, end: 4, text: 'The dashboard is slow.' },
    { start: 31, end: 35, text: 'Compute the answer once.' },
  ],
  checks: [
    {
      at: 29.7,
      prompt: 'What is slow?',
      options: ['The dashboard', 'The network'],
      answers: [0],
      why: 'The dashboard takes 40 seconds.',
    },
  ],
};

// jsdom has a video element that cannot play. These stand in for the browser.
const play = vi.fn(function (this: HTMLMediaElement) {
  fireEvent.play(this);
  return Promise.resolve();
});
const pause = vi.fn(function (this: HTMLMediaElement) {
  fireEvent.pause(this);
});

function setup(): HTMLVideoElement {
  const { container } = render(
    <StationVideo video={VIDEO} src="/demo.mp4" poster="/demo.jpg" captionsSrc="/demo.vtt" />,
  );
  const media = container.querySelector('video');
  if (media === null) throw new Error('no video element');
  return media;
}

/** Moves the film to a time, as the browser does while it plays. */
function advance(media: HTMLVideoElement, to: number): void {
  media.currentTime = to;
  fireEvent.timeUpdate(media);
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
});

afterEach(() => {
  vi.restoreAllMocks();
  play.mockClear();
  pause.mockClear();
});

describe('StationVideo', () => {
  it('shows the length, the chapters and one play overlay before it starts', () => {
    const media = setup();
    expect(screen.getByText(/about 2 min/)).toBeInTheDocument();
    expect(screen.getByText('0:00 / 1:30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The fix/ })).toBeInTheDocument();
    expect(media).toHaveAttribute('poster', '/demo.jpg');
    expect(media.querySelector('track')).toHaveAttribute('src', '/demo.vtt');

    fireEvent.click(screen.getByRole('button', { name: 'Play the video' }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Play the video' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('shows the caption of the moment, and hides it when captions are off', () => {
    const media = setup();
    advance(media, 2);
    expect(screen.getByText('The dashboard is slow.')).toBeInTheDocument();

    const captions = screen.getByRole('button', { name: 'Captions' });
    expect(captions).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(captions);
    expect(captions).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('The dashboard is slow.')).not.toBeInTheDocument();
  });

  it('pauses for the quick check, and goes on after the right answer', () => {
    const media = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play the video' }));
    advance(media, 29.2);
    expect(screen.queryByText('What is slow?')).not.toBeInTheDocument();

    advance(media, 29.8);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByText('What is slow?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip the question' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /The network/ }));
    expect(screen.queryByText('The dashboard takes 40 seconds.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /The dashboard/ }));
    expect(screen.getByText('The dashboard takes 40 seconds.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue the video' }));
    expect(play).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('What is slow?')).not.toBeInTheDocument();

    // The same question does not come back when the learner watches on.
    advance(media, 30.2);
    expect(screen.queryByText('What is slow?')).not.toBeInTheDocument();
  });

  it('does not open a quick check when the learner jumps over it', () => {
    const media = setup();
    fireEvent.click(screen.getByRole('button', { name: /Recap/ }));
    expect(media.currentTime).toBe(70);
    expect(play).toHaveBeenCalledTimes(1);
    advance(media, 70.3);
    expect(screen.queryByText('What is slow?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recap/ })).toHaveAttribute('aria-current', 'true');
  });

  it('steps through the speeds', () => {
    const media = setup();
    fireEvent.click(screen.getByRole('button', { name: /Change the speed/ }));
    expect(media.playbackRate).toBe(1.25);
    expect(screen.getByText('1.25x')).toBeInTheDocument();
  });

  it('answers the keyboard shortcuts and the bar', () => {
    const media = setup();
    const player = screen.getByRole('group', { name: 'Video player' });
    fireEvent.keyDown(player, { key: 'k' });
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(player, { key: 'ArrowRight' });
    expect(media.currentTime).toBe(5);
    fireEvent.keyDown(player, { key: 'k' });
    expect(pause).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('slider', { name: 'Position in the video' }), {
      target: { value: '40' },
    });
    expect(media.currentTime).toBe(40);
    expect(screen.getByText('0:40 / 1:30')).toBeInTheDocument();
  });

  it('says so when the file does not load', () => {
    const media = setup();
    fireEvent.error(media);
    expect(screen.getByText('The video did not load')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play the video' })).not.toBeInTheDocument();
  });
});
