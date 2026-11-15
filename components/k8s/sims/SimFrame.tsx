import { InlineText } from '@/components/course/InlineText';
import { cn } from '@/lib/utils';

export interface SimFrameProps {
  title: string;
  /** One line on what the learner can try. */
  intro: string;
  children: React.ReactNode;
}

/** The card every simulator sits in: a label, a title and one line of help. */
export function SimFrame({ title, intro, children }: SimFrameProps) {
  return (
    <section
      aria-label={`Simulator: ${title}`}
      className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-5 border p-5 sm:p-6"
    >
      <header className="flex flex-col gap-1">
        <p className="eyebrow text-brand-deep">Simulator</p>
        <h2 className="text-title">{title}</h2>
        <p className="text-small text-ink-soft">{intro}</p>
      </header>
      {children}
    </section>
  );
}

export type SimTone = 'ok' | 'meh' | 'no';

/** The colour pair of a verdict. Also used by the simulators for pods and table cells. */
export const SIM_TONE: Readonly<Record<SimTone, string>> = {
  ok: 'bg-easy-soft text-easy',
  meh: 'bg-medium-soft text-medium',
  no: 'bg-hard-soft text-hard',
};

export interface SimVerdictProps {
  tone: SimTone;
  /** The short result, such as "2 endpoints". */
  headline: string;
  /** The explanation, in the course inline dialect. */
  text: string;
}

/** The result line under a simulator. It is announced when it changes. */
export function SimVerdict({ tone, headline, text }: SimVerdictProps) {
  return (
    <p aria-live="polite" className="text-small bg-sunken rounded-input text-ink-soft p-3">
      <strong
        className={cn('rounded-pill mr-2 inline-block px-2.5 py-0.5 font-semibold', SIM_TONE[tone])}
      >
        {headline}
      </strong>
      <InlineText text={text} />
    </p>
  );
}

export interface SimLogProps {
  /** The newest event first. */
  events: readonly string[];
}

/** The last events of a simulator, newest first. */
export function SimLog({ events }: SimLogProps) {
  if (events.length === 0) return null;
  return (
    <ol
      aria-label="Events, newest first"
      className="bg-night-deep rounded-input text-on-night-soft text-micro flex flex-col gap-1 p-3 font-mono"
    >
      {events.map((event, index) => (
        <li
          key={`${events.length - index}-${event}`}
          className={cn(index === 0 && 'text-on-night')}
        >
          {event}
        </li>
      ))}
    </ol>
  );
}
