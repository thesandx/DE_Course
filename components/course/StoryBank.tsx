'use client';

import { useMemo, useState } from 'react';

import { Icon } from '@/components/layout/Icon';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { Textarea } from '@/components/ui/Textarea';
import {
  assessStory,
  speakingTime,
  STORY_FIELDS,
  STORY_THEMES,
  type StoryFieldName,
  type StoryThemeSlug,
  storyWordCount,
  THEMES_TARGET,
} from '@/lib/course/story-bank-themes';
import { cn } from '@/lib/utils';

/** Loaded on demand, so zod stays out of the page's first load. See ProfileForm. */
const loadSchema = () => import('@/lib/course/story-bank');

/** One saved story, as the page passes it in. Mirrors `Story` in `lib/course/story-bank`. */
export interface StoryBankStory extends Record<StoryFieldName, string> {
  id: string;
  title: string;
  themes: StoryThemeSlug[];
  updatedAt: string;
}

export interface StoryBankProps {
  initialStories: StoryBankStory[];
  maxStories: number;
}

interface Draft extends Record<StoryFieldName, string> {
  id: string | null;
  title: string;
  themes: StoryThemeSlug[];
}

type Status =
  | { kind: 'idle' }
  | { kind: 'saved'; title: string }
  | { kind: 'removed'; title: string }
  | { kind: 'failed'; message: string };

const EMPTY_DRAFT: Draft = {
  id: null,
  title: '',
  themes: [],
  situation: '',
  task: '',
  action: '',
  result: '',
  reflection: '',
};

const NETWORK_ERROR = 'The network dropped. Check your connection.';

async function errorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return typeof body === 'object' && body !== null && 'message' in body
    ? String((body as { message: unknown }).message)
    : 'Try again in a moment.';
}

/**
 * The behavioral story bank: which interview themes your stories cover, the
 * stories themselves, and a guided STAR editor that checks each story against
 * the habits of a senior or staff answer while you write.
 */
export function StoryBank({ initialStories, maxStories }: StoryBankProps) {
  const [stories, setStories] = useState<StoryBankStory[]>(initialStories);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const covered = useMemo(() => {
    const counts = new Map<StoryThemeSlug, number>();
    for (const story of stories) {
      for (const theme of story.themes) counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
    return counts;
  }, [stories]);

  const checks = draft === null ? [] : assessStory(draft);
  const draftWords = draft === null ? 0 : storyWordCount(draft);
  const full = stories.length >= maxStories;

  function open(next: Draft): void {
    setDraft(next);
    setErrors({});
    setStatus({ kind: 'idle' });
    setConfirmRemove(false);
  }

  function edit<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => (current === null ? current : { ...current, [key]: value }));
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
  }

  function toggleTheme(theme: StoryThemeSlug): void {
    if (draft === null) return;
    edit(
      'themes',
      draft.themes.includes(theme)
        ? draft.themes.filter((item) => item !== theme)
        : [...draft.themes, theme],
    );
  }

  async function save(): Promise<void> {
    if (draft === null) return;
    let schema: Awaited<ReturnType<typeof loadSchema>>;
    try {
      schema = await loadSchema();
    } catch {
      setStatus({ kind: 'failed', message: NETWORK_ERROR });
      return;
    }

    const { id, ...fields } = draft;
    const parsed = schema.storyInputSchema.safeParse(id === null ? fields : { ...fields, id });
    if (!parsed.success) {
      const next: Partial<Record<keyof Draft, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && field in EMPTY_DRAFT) {
          next[field as keyof Draft] ??= issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      const response = await fetch('/api/stories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        setStatus({ kind: 'failed', message: await errorMessage(response) });
        return;
      }
      const saved = (await response.json()) as StoryBankStory;
      setStories((current) => [saved, ...current.filter((story) => story.id !== saved.id)]);
      setDraft(null);
      setStatus({ kind: 'saved', title: saved.title });
    } catch {
      setStatus({ kind: 'failed', message: NETWORK_ERROR });
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (draft?.id === null || draft === null) return;
    const { id, title } = draft;
    setBusy(true);
    try {
      const response = await fetch(`/api/stories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        setStatus({ kind: 'failed', message: await errorMessage(response) });
        return;
      }
      setStories((current) => current.filter((story) => story.id !== id));
      setDraft(null);
      setStatus({ kind: 'removed', title });
    } catch {
      setStatus({ kind: 'failed', message: NETWORK_ERROR });
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  }

  const statusAlert =
    status.kind === 'saved' ? (
      <Alert tone="success" title={`Saved “${status.title}”.`} />
    ) : status.kind === 'removed' ? (
      <Alert tone="success" title={`Removed “${status.title}”.`} />
    ) : status.kind === 'failed' ? (
      <Alert tone="danger" title="The story bank was not changed.">
        {status.message}
      </Alert>
    ) : null;

  if (draft !== null) {
    const passed = checks.filter((check) => check.ok).length;
    return (
      <form
        className="grid gap-6 lg:grid-cols-12 lg:items-start"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        onFocus={() => {
          loadSchema().catch(() => undefined);
        }}
      >
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Input
            label="Title"
            name="title"
            value={draft.title}
            maxLength={120}
            hint="A few words you will remember, such as “Four teams, one active-rider metric”."
            onChange={(event) => edit('title', event.target.value)}
            {...(errors.title !== undefined && { error: errors.title })}
          />

          <fieldset className="flex flex-col gap-1">
            <legend className="text-small mb-2 font-semibold">
              Themes this story answers (one to four)
            </legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {STORY_THEMES.map((theme) => (
                <Checkbox
                  key={theme.slug}
                  label={theme.label}
                  hint={theme.question}
                  checked={draft.themes.includes(theme.slug)}
                  onChange={() => toggleTheme(theme.slug)}
                />
              ))}
            </div>
            {errors.themes !== undefined && (
              <p className="text-small text-hard font-semibold" role="alert">
                {errors.themes}
              </p>
            )}
          </fieldset>

          {STORY_FIELDS.map((field) => (
            <Textarea
              key={field.name}
              label={field.label}
              name={field.name}
              hint={field.hint}
              rows={field.name === 'action' ? 6 : 3}
              maxLength={2000}
              value={draft[field.name]}
              onChange={(event) => edit(field.name, event.target.value)}
              {...(errors[field.name] !== undefined && { error: errors[field.name] })}
            />
          ))}

          {statusAlert}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? 'Saving…' : 'Save story'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
              Back to my stories
            </Button>
            {draft.id !== null &&
              (confirmRemove ? (
                <Button variant="secondary" disabled={busy} onClick={() => void remove()}>
                  Yes, remove this story
                </Button>
              ) : (
                <Button variant="quiet" disabled={busy} onClick={() => setConfirmRemove(true)}>
                  Remove story
                </Button>
              ))}
          </div>
        </div>

        <aside
          aria-label="Story strength"
          className="border-line bg-surface shadow-card rounded-card flex flex-col gap-4 border p-5 lg:sticky lg:top-24 lg:col-span-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-heading">Story strength</h2>
            <span className="text-small text-ink-soft font-mono">
              {passed} of {checks.length}
            </span>
          </div>
          <p className="text-small text-ink-soft">
            {draftWords} words, about {speakingTime(draftWords)} out loud. Aim for about 2 minutes.
          </p>
          <ul className="flex flex-col gap-3">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 inline-grid size-6 shrink-0 place-items-center rounded-full',
                    check.ok ? 'bg-easy-bar text-on-night' : 'bg-sunken text-ink-faint',
                  )}
                >
                  {check.ok ? <Icon name="check" className="size-3.5" /> : null}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">
                    {check.label}
                    <span className="sr-only">{check.ok ? ': done.' : ': not yet.'}</span>
                  </span>
                  {!check.ok && <span className="text-small text-ink-soft">{check.tip}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-micro text-ink-faint">
            The checks look for habits, not truth. Say each story out loud before the loop.
          </p>
        </aside>
      </form>
    );
  }

  const coveredCount = STORY_THEMES.filter((theme) => covered.has(theme.slug)).length;

  return (
    <div className="flex flex-col gap-6">
      {statusAlert}

      <section aria-labelledby="coverage-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="coverage-heading" className="text-title">
            Theme coverage
          </h2>
          <Progress
            className="w-full sm:max-w-xs"
            label="Themes covered"
            value={coveredCount}
            max={THEMES_TARGET}
            valueText={`${coveredCount} of ${THEMES_TARGET}`}
          />
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STORY_THEMES.map((theme) => {
            const count = covered.get(theme.slug) ?? 0;
            return (
              <li
                key={theme.slug}
                className={cn(
                  'border-line rounded-card flex flex-col gap-1 border p-4',
                  count > 0 ? 'bg-easy-soft' : 'bg-surface',
                )}
              >
                <span className="font-semibold">{theme.label}</span>
                {count > 0 ? (
                  <Badge tone="success" className="self-start">
                    {count} {count === 1 ? 'story' : 'stories'}
                  </Badge>
                ) : (
                  <Badge className="self-start">Missing</Badge>
                )}
                <span className="text-small text-ink-soft">{theme.question}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="stories-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="stories-heading" className="text-title">
            My stories{' '}
            <span className="text-ink-soft font-mono">
              {stories.length}/{maxStories}
            </span>
          </h2>
          <Button size="lg" disabled={full} onClick={() => open(EMPTY_DRAFT)}>
            Add a story
          </Button>
        </div>
        {full && (
          <Alert tone="info" title="Your story bank is full.">
            Remove a weaker story to add a new one. Ten strong stories beat twelve average ones.
          </Alert>
        )}
        {stories.length === 0 ? (
          <EmptyState title="No stories yet">
            Start with your biggest project. It usually answers three or four themes, and the other
            stories grow from it.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {stories.map((story) => {
              const passed = assessStory(story).filter((check) => check.ok).length;
              const count = storyWordCount(story);
              return (
                <li key={story.id}>
                  <button
                    type="button"
                    onClick={() => open({ ...story })}
                    className="border-line bg-surface shadow-card hover:shadow-raised rounded-card flex w-full flex-col gap-3 border p-4 text-left transition-shadow"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold break-words">{story.title}</span>
                      <span className="text-small text-ink-soft shrink-0 font-mono">
                        {passed}/6
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {story.themes.map((slug) => (
                        <Chip key={slug}>
                          {STORY_THEMES.find((theme) => theme.slug === slug)?.label ?? slug}
                        </Chip>
                      ))}
                    </span>
                    <span className="text-small text-ink-soft">
                      {count} words, about {speakingTime(count)} out loud. Tap to edit.
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
