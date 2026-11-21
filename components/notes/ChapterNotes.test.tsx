import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChapterNotes } from './ChapterNotes';

const IMAGE_ID = 'aB3dE5fG7hJ9kL1mN3pQ5rS7';
const upload = vi.fn(
  async (_files: readonly File[], onEach: (image: { id: string; alt: string }) => void) => {
    onEach({ id: IMAGE_ID, alt: 'Query plan' });
  },
);
vi.mock('@/hooks/useNoteImageUpload', () => ({
  useNoteImageUpload: () => ({ busy: false, error: null, upload, dismiss: vi.fn() }),
}));

let report: ((visible: boolean) => void) | null = null;

class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    report = (visible) =>
      callback(
        [{ isIntersecting: visible } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  observe(): void {}
  disconnect(): void {}
}

function renderNotes() {
  return render(
    <ChapterNotes
      noteKey="de:lesson:sql:window-functions"
      title="Window functions"
      initial={{ markdown: 'Rank before you filter.', editedAt: '2026-11-20T10:00:00.000Z' }}
      pipEnabled
    />,
  );
}

describe('ChapterNotes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
  });

  afterEach(() => {
    report = null;
    vi.unstubAllGlobals();
  });

  it('hides the floating button while the notes at the end are on screen', () => {
    renderNotes();
    act(() => report?.(true));
    expect(screen.queryByRole('button', { name: /Open my notes/ })).not.toBeInTheDocument();
    act(() => report?.(false));
    expect(
      screen.getByRole('button', { name: /Open my notes for Window functions/ }),
    ).toBeVisible();
  });

  it('opens the same note in a panel and keeps a placeholder at the end', () => {
    renderNotes();
    act(() => report?.(false));
    fireEvent.click(screen.getByRole('button', { name: /Open my notes/ }));

    expect(screen.getByRole('dialog', { name: 'My notes' })).toBeInTheDocument();
    expect(screen.getByText('Your notes are open in the panel')).toBeVisible();
    // One editor, not two: the panel is the notes box itself.
    expect(screen.getAllByRole('textbox', { name: /My notes for Window functions/ })).toHaveLength(
      1,
    );
    expect(screen.queryByRole('button', { name: /Open my notes/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close the notes panel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Your notes are open in the panel')).not.toBeInTheDocument();
  });

  it('closes on Escape and when another floating panel opens', () => {
    renderNotes();
    act(() => report?.(false));
    fireEvent.click(screen.getByRole('button', { name: /Open my notes/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open my notes/ }));
    act(() => {
      window.dispatchEvent(new CustomEvent('floating-panel:open', { detail: 'assistant' }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves the note back to the end of the chapter', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderNotes();
    act(() => report?.(false));
    fireEvent.click(screen.getByRole('button', { name: /Open my notes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Bring them back here' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('adds a pasted image to the note as a picture', async () => {
    renderNotes();
    const box = await screen.findByRole('textbox', { name: /My notes for Window functions/ });
    const file = new File(['x'], 'plan.png', { type: 'image/png' });
    fireEvent.paste(box, { clipboardData: { files: [file], getData: () => '' } });
    await act(async () => {});
    expect(upload).toHaveBeenCalled();
    const figure = box.querySelector(`figure[data-image="${IMAGE_ID}"] img`);
    expect(figure?.getAttribute('src')).toBe(`/api/notes/images/${IMAGE_ID}`);
    expect(screen.getByRole('button', { name: 'Add an image' })).toBeInTheDocument();
  });

  it('offers Pip revision notes even when the note is empty', () => {
    render(
      <ChapterNotes
        noteKey="de:lesson:sql:window-functions"
        title="Window functions"
        initial={null}
        pipEnabled
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Notes with Pip/ }));
    expect(screen.getByRole('radio', { name: /Revision notes/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Tidy up/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Write revision notes' })).toBeEnabled();
  });
});
