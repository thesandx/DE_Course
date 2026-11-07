import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { PageHeading } from '@/components/layout/PageHeading';
import { getLab, LAB_XP, labId, labProgress, LINES, stationId } from '@/lib/course/gcp/catalog';
import { labPlan } from '@/lib/course/gcp/labs';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';
import { requireGcpLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Hands-on labs',
  description:
    'One Google Cloud lab per exam section: real console and Cloud Shell steps, sample data, checks and a cleanup.',
};

export const dynamic = 'force-dynamic';

/** Every lab, by line. A lab opens when its station is done. */
export default async function GcpLabsPage() {
  const { progress, shell } = await requireGcpLearner('/gcp/labs');
  const total = labProgress(progress.done);

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="GCP course" title="Hands-on labs">
          Do each section for real in your own Google Cloud project. Every lab brings its own sample
          data, tells you what to expect at each step, and ends with a cleanup that deletes all it
          made. A lab opens when you finish its station.
        </PageHeading>

        <section
          aria-label="Before your first lab"
          className="bg-night-soft rounded-sheet text-on-night flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-7"
        >
          <div className="flex flex-col gap-2">
            <p className="eyebrow text-on-night-soft">Before your first lab</p>
            <p className="text-body text-on-night-soft max-w-2xl">
              Make a new project for learning, turn on billing, and set a $5 budget alert in{' '}
              <span className="text-on-night font-semibold">Billing › Budgets & alerts</span>. Most
              labs stay inside the free tier; each one says what it costs before you start.
            </p>
          </div>
          <p className="flex shrink-0 flex-col items-start md:items-end">
            <span className="font-display text-key font-semibold">
              {total.done}/{total.total}
            </span>
            <span className="text-small text-on-night-soft">labs done</span>
          </p>
        </section>

        {LINES.map((line) => {
          const hue = hueStyle(line.hue);
          const lineLabs = labProgress(progress.done, line.slug);
          return (
            <section
              key={line.slug}
              aria-labelledby={`line-${line.slug}`}
              className="flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`line-${line.slug}`} className="text-title flex items-center gap-2">
                  <span aria-hidden="true" className={cn('size-2.5 rounded-full', hue.fill)} />
                  Line {line.number} · {line.short}
                </h2>
                <span className="text-small text-ink-soft shrink-0">
                  {lineLabs.done} of {lineLabs.total} done
                </span>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {line.stations.map((station) => {
                  const lab = getLab(station.slug);
                  if (lab === undefined) return null;
                  const open = progress.done[stationId(station.slug)] !== undefined;
                  const done = progress.done[labId(station.slug)] !== undefined;
                  return (
                    <li key={station.slug}>
                      <Link
                        href={`/gcp/labs/${station.slug}`}
                        className={cn(
                          'bg-surface rounded-card shadow-card hover:border-line-strong flex h-full flex-col gap-2 border p-4 transition-colors',
                          open ? 'border-line' : 'border-line border-dashed',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'rounded-pill text-micro text-ink px-2.5 py-0.5 font-mono font-semibold',
                              hue.fill,
                            )}
                          >
                            {station.code}
                          </span>
                          <span
                            className={cn(
                              'text-small inline-flex items-center gap-1 font-semibold',
                              done ? 'text-easy' : open ? 'text-brand-deep' : 'text-ink-faint',
                            )}
                          >
                            {done ? (
                              <>
                                <Icon name="check" className="size-3.5" />
                                Done
                              </>
                            ) : open ? (
                              `Open · +${LAB_XP} XP`
                            ) : (
                              'Locked'
                            )}
                          </span>
                        </span>
                        <span className="text-body font-semibold">{lab.title}</span>
                        <span className="text-small text-ink-soft">
                          ~{lab.minutes} min · {labPlan(lab).steps.length} steps + cleanup
                          {open ? '' : ` · finish ${station.code} to open`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </AppShell>
  );
}
