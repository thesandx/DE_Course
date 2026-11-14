import { InlineText } from '@/components/course/InlineText';
import { CodeBlock } from '@/components/gcp/CodeBlock';
import { LabTick } from '@/components/gcp/LabProgress';
import { fileCommand, stepFile, stepPlace } from '@/lib/course/k8s/lab';
import { cn } from '@/lib/utils';
import type { K8sLabStep, K8sLesson, K8sPort } from '@/types/k8s';

import { Predict } from './Predict';

export interface K8sLabStepCardProps {
  /** The anchor and the tick id, such as "step-3". */
  id: string;
  number: number;
  port: K8sPort;
  lesson: K8sLesson;
  step: K8sLabStep;
  /** The `fill` class of the port's hue, for the number badge. */
  fill: string;
}

function badgesOf(step: K8sLabStep): Array<{ label: string; tone: string }> {
  return [
    ...(step.file !== undefined ? [{ label: 'File', tone: 'bg-sunken text-ink-soft' }] : []),
    ...(step.secondTerminal === true
      ? [{ label: 'Terminal 2', tone: 'bg-sunken text-ink-soft' }]
      : []),
    ...(step.browser === true ? [{ label: 'Browser', tone: 'bg-sunken text-ink-soft' }] : []),
    ...(step.breakIt === true ? [{ label: 'Break it', tone: 'bg-hard-soft text-hard' }] : []),
    ...(step.cloud === true
      ? [{ label: 'GKE · can cost', tone: 'bg-medium-soft text-medium' }]
      : []),
    ...(step.predict !== undefined
      ? [{ label: 'Predict', tone: 'bg-brand-soft text-brand-deep' }]
      : []),
  ];
}

/**
 * One lab step: what to do, the commands to paste, and what the terminal
 * should print. A step with a prediction hides its commands until the learner
 * has guessed. The tick at the foot is kept in the browser.
 */
export function K8sLabStepCard({ id, number, port, lesson, step, fill }: K8sLabStepCardProps) {
  const file = stepFile(lesson, step);
  const badges = badgesOf(step);

  const work = (
    <div className="flex min-w-0 flex-col gap-3">
      {file !== undefined && (
        <CodeBlock label={`Terminal · writes ${file.name}`} code={fileCommand(port, file)} />
      )}
      {step.code !== undefined && <CodeBlock label={stepPlace(step)} code={step.code} />}
      {step.output !== undefined && (
        <div className="bg-easy-soft rounded-input flex min-w-0 flex-col gap-2 p-4">
          <p className="eyebrow text-easy">Expected output</p>
          <pre className="text-small text-ink overflow-x-auto font-mono leading-relaxed">
            <code>{step.output}</code>
          </pre>
        </div>
      )}
    </div>
  );

  return (
    <li
      id={id}
      className={cn(
        'bg-surface rounded-card shadow-card flex min-w-0 scroll-mt-20 flex-col gap-4 border p-4 sm:p-5',
        step.breakIt === true ? 'border-hard-bar' : 'border-line',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'rounded-input text-small text-ink inline-grid size-8 shrink-0 place-items-center font-mono font-semibold',
            fill,
          )}
        >
          {number}
        </span>
        <span className="sr-only">Step {number}</span>
        {badges.map((badge) => (
          <span
            key={badge.label}
            className={cn('rounded-pill text-micro px-2.5 py-1 font-semibold', badge.tone)}
          >
            {badge.label}
          </span>
        ))}
      </div>
      <p className="text-body">
        <InlineText text={step.text} />
      </p>
      {step.predict !== undefined ? <Predict question={step.predict}>{work}</Predict> : work}
      <div className="border-line border-t pt-2">
        <LabTick id={id} label="I did this step" />
      </div>
    </li>
  );
}
