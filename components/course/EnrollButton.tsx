'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { localDay } from '@/hooks/useRecordProgress';
import type { CourseSlug } from '@/lib/course/courses';

export interface EnrollButtonProps {
  course: CourseSlug;
  /** Where to go once joined, usually the course dashboard. */
  href: string;
  label?: string;
  variant?: ButtonVariant;
  block?: boolean;
  className?: string;
}

/**
 * Joins a course through `POST /api/enrollments`, then opens the course. The
 * course starts with an empty tracker of its own.
 */
export function EnrollButton({
  course,
  href,
  label = 'Join course',
  variant = 'primary',
  block = false,
  className,
}: EnrollButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ course, day: localDay() }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401) {
        setError('Your session ended. Sign in again to join.');
        return;
      }
      if (!response.ok) {
        setError('You were not enrolled. Check your connection and try again.');
        return;
      }
      router.push(href);
      router.refresh();
    } catch {
      setError('You were not enrolled. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Button variant={variant} size="lg" block={block} onClick={() => void join()} disabled={busy}>
        {busy ? 'Joining' : label}
      </Button>
      {error !== null ? (
        <Alert tone="danger" title="Not enrolled" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
