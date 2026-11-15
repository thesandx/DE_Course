import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DoubtAssistant } from './DoubtAssistant';

let pathname = '/de/tracks/sql/window-functions';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const fetchMock = vi.fn<typeof fetch>();

function streamed(text: string): Response {
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

describe('DoubtAssistant', () => {
  beforeEach(() => {
    pathname = '/de/tracks/sql/window-functions';
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens from the floating button with a model dropdown and suggestions', () => {
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    expect(screen.getByRole('dialog', { name: /Pip/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toHaveValue('anthropic/claude-haiku-5.5');
    expect(screen.getByRole('button', { name: /Explain this page in simple words/ })).toBeVisible();
  });

  it('remembers the chosen model', () => {
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'anthropic/claude-sonnet-5.5' },
    });
    expect(window.localStorage.getItem('loop-ready-assistant-model')).toBe(
      'anthropic/claude-sonnet-5.5',
    );
  });

  it('sends the question with the page path and shows the streamed answer', async () => {
    fetchMock.mockResolvedValue(streamed('Use `ROW_NUMBER()` to **pick one row**.'));
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.change(screen.getByLabelText('Your doubt'), { target: { value: 'Why not RANK?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('ROW_NUMBER()')).toBeInTheDocument();
    expect(screen.getByText('pick one row')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/assistant');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      path: '/de/tracks/sql/window-functions',
      messages: [{ role: 'user', content: 'Why not RANK?' }],
    });
    await waitFor(() =>
      expect(
        window.sessionStorage.getItem('loop-ready-assistant-chat:/de/tracks/sql/window-functions'),
      ).toContain('Why not RANK?'),
    );
  });

  it('searches the web when the globe is on, and lists the sources under the answer', async () => {
    const sources = [{ url: 'https://docs.getdbt.com/docs/build/snapshots', title: 'Snapshots' }];
    fetchMock.mockResolvedValue(
      streamed(`See [docs.getdbt.com](https://docs.getdbt.com/).\u001e${JSON.stringify(sources)}`),
    );
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    const web = screen.getByRole('button', { name: /Web search/ });
    expect(web).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(web);
    expect(web).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('loop-ready-assistant-web')).toBe('on');

    fireEvent.change(screen.getByLabelText('Your doubt'), { target: { value: 'dbt 2 news?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('link', { name: /Snapshots/ })).toHaveAttribute(
      'href',
      sources[0]?.url,
    );
    expect(screen.getByRole('link', { name: 'docs.getdbt.com' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      webSearch: true,
    });
  });

  it('shows the server message when the model cannot answer', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'busy', message: 'That model is busy right now.' }, { status: 429 }),
    );
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Quiz me on my notes/ }));
    expect(await screen.findByText('That model is busy right now.')).toBeInTheDocument();
  });

  it('offers hints, not answers, on a problem page', () => {
    pathname = '/de/problems/latest-trip-status';
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    expect(screen.getByRole('button', { name: /Give me a small hint/ })).toBeInTheDocument();
  });

  it('says it is not set up when the server has no key', () => {
    render(<DoubtAssistant enabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    expect(screen.getByText(/not set up yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your doubt')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('images', () => {
    const PNG = new File([new Uint8Array([137, 80, 78, 71])], 'error.png', { type: 'image/png' });
    const JPEG_URL = 'data:image/jpeg;base64,/9j/AAAA';

    beforeEach(() => {
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn(async () => ({ width: 3200, height: 1600, close: vi.fn() })),
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        fillStyle: '',
      } as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(JPEG_URL);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function attach(...files: File[]) {
      const input = document.querySelector('input[type="file"]');
      if (!(input instanceof HTMLInputElement)) throw new Error('No file input');
      fireEvent.change(input, { target: { files } });
    }

    it('attaches a photo, shrinks it, and sends it with the question', async () => {
      fetchMock.mockResolvedValue(streamed('That error means the column is ambiguous.'));
      render(<DoubtAssistant enabled />);
      fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
      expect(screen.getByRole('button', { name: 'Attach an image' })).toBeInTheDocument();

      attach(PNG);
      expect(await screen.findByAltText('Image 1 to send')).toHaveAttribute('src', JPEG_URL);
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(await screen.findByText(/column is ambiguous/)).toBeInTheDocument();
      expect(screen.getByAltText('Image 1 you attached')).toBeInTheDocument();
      expect(screen.queryByAltText('Image 1 to send')).not.toBeInTheDocument();
      const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
        messages: { content: string; images?: string[] }[];
      };
      expect(body.messages[0]).toEqual({
        role: 'user',
        content: 'Explain this image in the context of this page.',
        images: [JPEG_URL],
      });
      // Session storage keeps how many images there were, never the images.
      await waitFor(() => {
        const saved = window.sessionStorage.getItem(
          'loop-ready-assistant-chat:/de/tracks/sql/window-functions',
        );
        expect(saved).toContain('"imageCount":1');
        expect(saved).not.toContain('base64');
      });
    });

    it('removes an attached image', async () => {
      render(<DoubtAssistant enabled />);
      fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
      attach(PNG);
      await screen.findByAltText('Image 1 to send');
      fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }));
      expect(screen.queryByAltText('Image 1 to send')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    });

    it('refuses a file that is not an image and a fourth image', async () => {
      render(<DoubtAssistant enabled />);
      fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
      attach(new File(['a,b'], 'rows.csv', { type: 'text/csv' }));
      expect(await screen.findByText('Attach a PNG, JPEG, WebP or GIF image.')).toBeInTheDocument();

      attach(PNG, PNG, PNG, PNG);
      expect(await screen.findByAltText('Image 3 to send')).toBeInTheDocument();
      expect(screen.getByText(/Only 3 images fit on one question/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Attach an image' })).toBeDisabled();
    });

    it('takes a pasted screenshot', async () => {
      render(<DoubtAssistant enabled />);
      fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
      fireEvent.paste(screen.getByLabelText('Your doubt'), {
        clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => PNG }] },
      });
      expect(await screen.findByAltText('Image 1 to send')).toBeInTheDocument();
    });

    it('gives the question and the image back when the send fails', async () => {
      fetchMock.mockResolvedValue(
        Response.json(
          { error: 'upstream', message: 'The model could not answer.' },
          { status: 502 },
        ),
      );
      render(<DoubtAssistant enabled />);
      fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
      attach(PNG);
      await screen.findByAltText('Image 1 to send');
      fireEvent.change(screen.getByLabelText('Your doubt'), { target: { value: 'What is this?' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      expect(await screen.findByText('The model could not answer.')).toBeInTheDocument();
      expect(screen.getByLabelText('Your doubt')).toHaveValue('What is this?');
      expect(screen.getByAltText('Image 1 to send')).toBeInTheDocument();
    });
  });
});
