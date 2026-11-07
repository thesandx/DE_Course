import { Prose } from '@/components/course/Prose';
import { Icon } from '@/components/layout/Icon';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type { LabStep } from '@/types/gcp';

import { CodeBlock } from './CodeBlock';
import { LabTick } from './LabProgress';

export interface LabStepCardProps {
  /** The anchor and the tick id, such as "step-3" or "cleanup-1". */
  id: string;
  /** What the badge says, such as "3" or "C1". */
  badge: string;
  /** "Step 3" or "Cleanup 1". */
  eyebrow: string;
  step: LabStep;
  /** The titles of the station concepts the step practises. */
  concepts: readonly string[];
  /** The `fill` class of the line's hue, for the badge. */
  fill: string;
  tone?: 'step' | 'cleanup';
}

/**
 * One lab step: why it matters, how to do it in the console or in Cloud
 * Shell, the SQL to paste, what the learner should see, and where in the
 * console to see it. The console tab comes first, because every step can be
 * done there. The tick at the foot is the only client part.
 */
export function LabStepCard({
  id,
  badge,
  eyebrow,
  step,
  concepts,
  fill,
  tone = 'step',
}: LabStepCardProps) {
  const ways = [
    ...(step.console !== undefined
      ? [{ id: 'console', label: 'Console (UI)', content: <Prose source={step.console} /> }]
      : []),
    ...(step.shell !== undefined
      ? [
          {
            id: 'shell',
            label: 'Cloud Shell',
            content: <CodeBlock label="Cloud Shell" code={step.shell} />,
          },
        ]
      : []),
  ];

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        'rounded-card shadow-card flex scroll-mt-20 flex-col gap-4 border p-5 sm:p-6',
        tone === 'cleanup' ? 'bg-surface border-hard-bar' : 'bg-surface border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'rounded-input text-small inline-grid h-9 min-w-9 shrink-0 place-items-center px-2 font-mono font-semibold',
            tone === 'cleanup' ? 'bg-hard-soft text-hard' : cn(fill, 'text-ink'),
          )}
        >
          {badge}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn('eyebrow', tone === 'cleanup' ? 'text-hard' : 'text-ink-faint')}>
            {eyebrow}
          </p>
          <h3 id={`${id}-heading`} className="text-heading">
            {step.title}
          </h3>
        </div>
      </div>

      {concepts.length > 0 && (
        <ul aria-label="Concepts practised" className="flex flex-wrap gap-2">
          {concepts.map((concept) => (
            <li
              key={concept}
              className="bg-sunken text-micro text-ink-soft rounded-pill px-3 py-1 font-medium"
            >
              {concept}
            </li>
          ))}
        </ul>
      )}

      <Prose source={step.body} />

      {ways.length === 2 ? (
        <Tabs label={`How to do: ${step.title}`} items={ways} />
      ) : (
        ways.map((way) => <div key={way.id}>{way.content}</div>)
      )}

      {step.sql !== undefined && <CodeBlock label="SQL · BigQuery Studio" code={step.sql} />}

      {step.check !== undefined && (
        <div className="bg-easy-soft rounded-input flex flex-col gap-1 p-4">
          <p className="eyebrow text-easy">You should see</p>
          <Prose source={step.check} />
        </div>
      )}

      {step.see !== undefined && (
        <div className="bg-sunken border-line rounded-input flex flex-col gap-1 border p-4">
          <p className="eyebrow text-ink-soft flex items-center gap-1.5">
            <Icon name="monitor" className="size-4" />
            See it in the console
          </p>
          <Prose source={step.see} />
        </div>
      )}

      <div className="border-line border-t pt-2">
        <LabTick id={id} label={tone === 'cleanup' ? 'I deleted this' : 'I did this step'} />
      </div>
    </section>
  );
}
