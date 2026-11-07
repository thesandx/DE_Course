import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InlineText } from '@/components/course/InlineText';
import { Prose } from '@/components/course/Prose';
import { CodeBlock } from '@/components/gcp/CodeBlock';
import { LabFinish, LabMeter, LabProgress } from '@/components/gcp/LabProgress';
import { LabStepCard } from '@/components/gcp/LabStepCard';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { allStations, getLab, LAB_XP, labId, stationId } from '@/lib/course/gcp/catalog';
import { labPlan, tickIds } from '@/lib/course/gcp/labs';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';
import { requireGcpLearner } from '@/services/learner.service';
import type { LabStep } from '@/types/gcp';

interface Props {
  params: Promise<{ station: string }>;
}

function find(stationSlug: string) {
  const ref = allStations().find((item) => item.station.slug === stationSlug);
  const lab = getLab(stationSlug);
  return ref === undefined || lab === undefined ? undefined : { ...ref, lab };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = find((await params).station);
  return found === undefined
    ? { title: 'Lab not found', description: 'This lab does not exist.' }
    : { title: `Lab ${found.station.code}: ${found.lab.title}`, description: found.lab.scenario };
}

export const dynamic = 'force-dynamic';

/**
 * A hands-on lab for one station. It opens once the station is done. The
 * learner works in their own Google Cloud project, ticks each step, and can
 * finish the lab only after ticking every cleanup step.
 */
export default async function GcpLabPage({ params }: Props) {
  const { station: stationSlug } = await params;
  const found = find(stationSlug);
  if (found === undefined) notFound();
  const { line, station, lab } = found;

  const { progress, shell } = await requireGcpLearner(`/gcp/labs/${stationSlug}`);
  const open = progress.done[stationId(station.slug)] !== undefined;
  const done = progress.done[labId(station.slug)] !== undefined;
  const hue = hueStyle(line.hue);
  const stationHref = `/gcp/lines/${line.slug}/${station.slug}`;
  const plan = labPlan(lab);
  const ticks = tickIds(plan);
  const conceptTitles = (step: LabStep): string[] =>
    step.concepts.flatMap((number) => {
      const concept = station.concepts[number - 1];
      return concept === undefined ? [] : [concept.title];
    });

  const header = (
    <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-4 p-6 sm:p-8">
      <p className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-pill eyebrow text-ink px-3 py-1', hue.fill)}>
          Hands-on lab · {station.code}
        </span>
        <span className="eyebrow text-on-night-soft">
          Line {line.number} · {station.title}
        </span>
      </p>
      <h1 className="text-display">{lab.title}</h1>
      <div className="border-night-line bg-night-raised/60 rounded-card flex flex-col gap-1 border p-4">
        <p className="eyebrow text-gold">Scenario</p>
        <p className="text-body text-on-night-soft">{lab.scenario}</p>
      </div>
      <dl className="border-night-line mt-1 grid grid-cols-3 gap-4 border-t pt-5">
        {[
          { label: 'Time', value: `~${lab.minutes} min` },
          { label: 'Steps', value: String(plan.steps.length + plan.cleanup.length) },
          { label: 'Reward', value: done ? 'Earned' : `+${LAB_XP} XP` },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <dt className="eyebrow text-on-night-soft">{stat.label}</dt>
            <dd className="font-display text-heading font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );

  const briefing = (
    <section
      aria-labelledby="briefing-heading"
      className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <p className="eyebrow text-ink-faint">Before you start</p>
        <h2 id="briefing-heading" className="text-title">
          What you build, and what it costs
        </h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-heading">You will create</h3>
          <ul className="flex flex-col gap-1.5">
            {lab.creates.map((item) => (
              <li key={item} className="text-small text-ink-soft flex gap-2">
                <Icon name="spark" className="text-iris mt-0.5 size-4 shrink-0" />
                <span>
                  <InlineText text={item} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-small text-ink-soft">
            Every name starts with{' '}
            <code className="font-mono">lab{station.code.replace('.', '')}</code>, so the cleanup
            can find it.
          </p>
        </div>
        <div className="bg-sunken rounded-input flex flex-col gap-2 p-4">
          <h3 className="text-heading">Cost</h3>
          <Prose source={lab.cost} />
          <ul className="flex flex-col gap-1.5">
            {lab.freeTier.map((hint) => (
              <li key={hint} className="text-small text-ink-soft flex gap-2">
                <Icon name="check" className="text-easy mt-0.5 size-4 shrink-0" />
                <span>
                  <InlineText text={hint} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {lab.files.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-heading">Sample data</h3>
          <ul className="flex flex-col gap-2">
            {lab.files.map((file) => (
              <li
                key={file.name}
                className="border-line rounded-input flex flex-col gap-2 border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-small font-mono font-semibold">{file.name}</span>
                  <span className="text-small text-ink-soft">{file.about}</span>
                </span>
                <a
                  href={`/api/lab-files/${lab.station}/${file.name}`}
                  download={file.name}
                  className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  if (!open) {
    return (
      <AppShell
        {...shell}
        variant="focus"
        crumbs={[
          { label: 'GCP course', href: '/gcp' },
          { label: 'Labs', href: '/gcp/labs' },
          { label: `Lab ${station.code}` },
        ]}
        back={{ fallbackHref: '/gcp/labs', label: 'Back to labs' }}
      >
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
          {header}
          <section className="bg-surface border-line rounded-card shadow-card flex flex-col items-start gap-3 border border-dashed p-5 sm:p-6">
            <p className="eyebrow text-ink-faint">Locked</p>
            <h2 className="text-title">Finish station {station.code} to open this lab</h2>
            <p className="text-body text-ink-soft">
              The lab puts the station’s concepts into practice, so it opens once you pass the
              station’s checkpoint.
            </p>
            <Link href={stationHref} className={buttonStyles()}>
              Go to station {station.code}
              <Icon name="arrow-right" className="size-4" />
            </Link>
          </section>
          {briefing}
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'GCP course', href: '/gcp' },
        { label: `Line ${line.number}`, href: `/gcp/lines/${line.slug}` },
        { label: station.code, href: stationHref },
        { label: 'Lab' },
      ]}
      back={{ fallbackHref: stationHref, label: `Back to station ${station.code}` }}
    >
      <LabProgress station={lab.station}>
        <main className="flex w-full flex-col">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-8 md:py-8 lg:grid-cols-12 lg:items-start lg:gap-8">
            <article className="flex min-w-0 flex-col gap-4 lg:col-span-8">
              {header}
              {briefing}

              <h2 className="text-title pt-2">Steps</h2>
              {plan.steps.map((step, index) => (
                <LabStepCard
                  key={ticks.steps[index]}
                  id={ticks.steps[index] ?? `step-${index + 1}`}
                  badge={String(index + 1)}
                  eyebrow={`Step ${index + 1} of ${plan.steps.length}`}
                  step={step}
                  concepts={conceptTitles(step)}
                  fill={hue.fill}
                />
              ))}

              <section
                id="cleanup"
                aria-labelledby="cleanup-heading"
                className="bg-hard-soft border-hard-bar rounded-card flex scroll-mt-20 flex-col gap-2 border p-5 sm:p-6"
              >
                <p className="eyebrow text-hard">Mandatory</p>
                <h2 id="cleanup-heading" className="text-title">
                  Clean up everything
                </h2>
                <p className="text-body text-ink-soft">
                  Do every cleanup step, even if you stop half-way through the lab. The lab counts
                  only when each one is ticked, so nothing you made keeps billing you.
                </p>
              </section>
              {plan.cleanup.map((step, index) => (
                <LabStepCard
                  key={ticks.cleanup[index]}
                  id={ticks.cleanup[index] ?? `cleanup-${index + 1}`}
                  badge={`C${index + 1}`}
                  eyebrow={`Cleanup ${index + 1} of ${plan.cleanup.length}`}
                  step={step}
                  concepts={[]}
                  fill={hue.fill}
                  tone="cleanup"
                />
              ))}
              <section
                aria-labelledby="verify-heading"
                className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5 sm:p-6"
              >
                <h3 id="verify-heading" className="text-heading">
                  Prove nothing is left
                </h3>
                <p className="text-small text-ink-soft">
                  Check each page in the console, or run the commands in Cloud Shell. Each command
                  should print a “No … left” message.
                </p>
                <Tabs
                  label="Ways to prove nothing is left"
                  items={[
                    {
                      id: 'console',
                      label: 'Console (UI)',
                      content: <Prose source={lab.verifyConsole} />,
                    },
                    {
                      id: 'shell',
                      label: 'Cloud Shell',
                      content: <CodeBlock label="Cloud Shell" code={lab.verify} />,
                    },
                  ]}
                />
              </section>

              <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5 sm:p-6">
                <LabFinish
                  itemId={labId(lab.station)}
                  done={done}
                  xp={LAB_XP}
                  cleanup={ticks.cleanup}
                />
              </section>

              <nav aria-label="After the lab" className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={stationHref}
                  className={cn(buttonStyles({ variant: 'secondary', size: 'lg' }), 'grow')}
                >
                  <Icon name="arrow-left" className="size-4" />
                  Station {station.code}
                </Link>
                <Link
                  href="/gcp/labs"
                  className={cn(buttonStyles({ variant: 'dark', size: 'lg' }), 'grow')}
                >
                  All labs
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              </nav>
            </article>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-span-4">
              <section
                aria-labelledby="lab-progress-heading"
                className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5"
              >
                <h2 id="lab-progress-heading" className="text-heading">
                  Your progress
                </h2>
                <LabMeter ids={ticks.steps} label="Steps" />
                <LabMeter ids={ticks.cleanup} label="Cleanup" />
                <p className="text-micro text-ink-faint">
                  Ticks are kept in this browser. Finishing the lab saves it to your account.
                </p>
              </section>
              <section className="bg-surface border-line rounded-card shadow-card hidden flex-col gap-2 border p-5 lg:flex">
                <h2 className="text-heading">In this lab</h2>
                <ol className="flex flex-col gap-1">
                  {plan.steps.map((step, index) => (
                    <li key={step.title}>
                      <a
                        href={`#${ticks.steps[index] ?? ''}`}
                        className="text-small text-ink-soft hover:text-ink hover:bg-sunken rounded-input flex min-h-11 items-center gap-2 px-2"
                      >
                        <span className="text-ink-faint w-5 shrink-0 font-mono">{index + 1}</span>
                        <span className="truncate">{step.title}</span>
                      </a>
                    </li>
                  ))}
                  <li>
                    <a
                      href="#cleanup"
                      className="text-small text-hard hover:bg-sunken rounded-input flex min-h-11 items-center gap-2 px-2 font-semibold"
                    >
                      <span className="w-5 shrink-0 font-mono">C</span>
                      Clean up
                    </a>
                  </li>
                </ol>
              </section>
            </aside>
          </div>
        </main>
      </LabProgress>
    </AppShell>
  );
}
