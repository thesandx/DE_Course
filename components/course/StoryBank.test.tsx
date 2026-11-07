import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoryBank, type StoryBankStory } from '@/components/course/StoryBank';

const STORY: StoryBankStory = {
  id: '3f1c2b9e-8d4a-4f6b-9c2e-1a7d5e3b8f00',
  title: 'One metric for four teams',
  themes: ['influence', 'biggest-project'],
  situation: 'Four teams computed active riders four ways.',
  task: 'Nobody owned it.',
  action: 'I proposed one certified metric.',
  result: 'All 4 teams moved.',
  reflection: '',
  updatedAt: '2026-11-07T10:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StoryBank', () => {
  it('shows coverage and an empty state for a new learner', () => {
    render(<StoryBank initialStories={[]} maxStories={12} />);
    expect(screen.getByText('0 of 8')).toBeInTheDocument();
    expect(screen.getByText('No stories yet')).toBeInTheDocument();
    expect(screen.getAllByText('Missing')).toHaveLength(10);
  });

  it('counts the themes a saved story covers', () => {
    render(<StoryBank initialStories={[STORY]} maxStories={12} />);
    expect(screen.getByText('2 of 8')).toBeInTheDocument();
    expect(screen.getByText(STORY.title)).toBeInTheDocument();
  });

  it('opens the editor with the strength checks', () => {
    render(<StoryBank initialStories={[]} maxStories={12} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a story' }));
    expect(screen.getByRole('textbox', { name: /Situation/ })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Story strength' })).toBeInTheDocument();
    expect(screen.getByText('The result has a number')).toBeInTheDocument();
  });

  it('shows a field error and does not call the server for an invalid story', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<StoryBank initialStories={[]} maxStories={12} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a story' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save story' }));
    expect(await screen.findByText('Give the story a short title.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saves a story and returns to the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ...STORY, id: '9a1c2b9e-8d4a-4f6b-9c2e-1a7d5e3b8f11', title: 'New one' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<StoryBank initialStories={[]} maxStories={12} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a story' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Title/ }), {
      target: { value: 'New one' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Conflict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save story' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(await screen.findByText('Saved “New one”.')).toBeInTheDocument();
    expect(screen.getByText('New one')).toBeInTheDocument();
  });

  it('disables adding when the bank is full', () => {
    render(<StoryBank initialStories={[STORY]} maxStories={1} />);
    expect(screen.getByRole('button', { name: 'Add a story' })).toBeDisabled();
    expect(screen.getByText('Your story bank is full.')).toBeInTheDocument();
  });
});
