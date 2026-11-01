import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCourse } from '@/lib/course/courses';
import { hubStats } from '@/lib/course/hub';
import { EMPTY_LEARNER } from '@/lib/course/progress';

import { CourseHub } from './CourseHub';
import { CourseJoin } from './CourseJoin';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

describe('CourseHub', () => {
  it('offers every open course to a new learner, and the later one without a button', () => {
    render(<CourseHub name="Sandeep" joined={[]} />);
    expect(screen.getByRole('heading', { name: 'Choose a course' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Join course' })).toHaveLength(2);
    expect(screen.getByText('Opening later')).toBeInTheDocument();
  });

  it('shows a tracker card per joined course and offers the rest', () => {
    render(<CourseHub name="Sandeep" joined={[hubStats(EMPTY_LEARNER, 'gcp', '2026-11-01')]} />);
    expect(screen.getByRole('heading', { name: 'Your courses' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GCP Professional Data Engineer' })).toHaveAttribute(
      'href',
      '/gcp',
    );
    expect(screen.getAllByRole('button', { name: 'Join course' })).toHaveLength(1);
  });

  it('joins a course and opens it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<CourseHub name="Sandeep" joined={[]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Join course' })[1] as HTMLElement);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/gcp'));
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as unknown;
    expect(body).toMatchObject({ course: 'gcp' });
  });

  it('says why a join failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    render(<CourseHub name="Sandeep" joined={[]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Join course' })[0] as HTMLElement);
    expect(await screen.findByText(/Sign in again to join/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('CourseJoin', () => {
  it('shows what the course holds and the join button', () => {
    render(
      <CourseJoin
        course={getCourse('gcp')}
        previewTitle="The five lines"
        preview={[{ title: 'Design', detail: '4 stations', hue: 3 }]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'GCP Professional Data Engineer',
    );
    expect(screen.getByRole('button', { name: 'Join this course' })).toBeInTheDocument();
    expect(screen.getByText('4 stations')).toBeInTheDocument();
  });
});
