'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * One step of the sample design answer: what the interviewer asks at this
 * point, what a strong candidate writes, and why. Original content.
 */
interface Step {
  id: string;
  label: string;
  prompt: string;
  /** The candidate's working, shown in the code panel. */
  code: string;
  codeLabel: string;
  /** The model answer, revealed on demand. */
  model: string;
  /** The follow-up an interviewer asks, and the answer. */
  probe: { question: string; answer: string };
}

const STEPS: readonly Step[] = [
  {
    id: 'scope',
    label: 'Scope',
    prompt: 'Before you draw anything: what does the trips table have to answer, and for whom?',
    codeLabel: 'scope.md',
    code: `-- Questions the table must answer
-- 1. Completed trips and gross bookings per city per hour
-- 2. Cancellation rate by rider, driver and reason
-- 3. Driver earnings per week, for payouts
-- Out of scope: live dispatch, surge pricing`,
    model:
      'Name the consumers first: city operations dashboards, finance payouts and data science. Payouts need exact numbers; dashboards need freshness. That split drives every later choice.',
    probe: {
      question: 'Why this grain?',
      answer:
        'Scope decides grain. Payouts and cancellations are both questions about one trip, so the finest useful grain is one row per trip, not per event or per hour.',
    },
  },
  {
    id: 'estimates',
    label: 'Estimates',
    prompt: 'Roughly how big is this table, and how fast does it grow?',
    codeLabel: 'estimates.txt',
    code: `trips per day      ~ 25,000,000
bytes per row      ~ 400
raw per day        ~ 10 GB   (25e6 x 400 B)
per year           ~ 3.6 TB  before compression
columnar, zstd     ~ 0.7 TB  per year`,
    model:
      'Round hard and say the arithmetic out loud. Ten gigabytes a day is small for a warehouse, so the risk is not size. The risk is late and corrected trips rewriting history.',
    probe: {
      question: 'Why this grain?',
      answer:
        'At one row per trip the table stays under a terabyte a year compressed. An event-level grain would be twenty times larger for questions nobody asked.',
    },
  },
  {
    id: 'model',
    label: 'Data model',
    prompt: 'Write the fact table. What is one row, and what are the keys?',
    codeLabel: 'fct_trips.sql',
    code: `CREATE TABLE fct_trips (
  trip_id        STRING    NOT NULL,  -- one row per trip
  rider_key      INT64     NOT NULL,
  driver_key     INT64,
  city_key       INT64     NOT NULL,
  requested_at   TIMESTAMP NOT NULL,
  completed_at   TIMESTAMP,
  status         STRING    NOT NULL,  -- completed | cancelled
  fare_amount    NUMERIC,
  updated_at     TIMESTAMP NOT NULL
)
PARTITION BY DATE(requested_at)
CLUSTER BY city_key, status;`,
    model:
      'One row per trip, keyed by trip_id. Dimensions join by surrogate key. Partition on the request date, because every question filters on time, and cluster on city and status.',
    probe: {
      question: 'Why this grain?',
      answer:
        'One trip is the business event. Every metric in scope is a sum or a count over trips, and a correction replaces one row, so a MERGE on trip_id keeps the table exact.',
    },
  },
  {
    id: 'architecture',
    label: 'Architecture',
    prompt: 'How do trip events become rows in this table?',
    codeLabel: 'pipeline.txt',
    code: `trip service ──► Kafka (trip_events, keyed by trip_id)
                    │
                    ├─► stream job: latest state per trip ──► fct_trips_live
                    │
                    └─► hourly batch: MERGE on trip_id ─────► fct_trips`,
    model:
      'Key the topic by trip_id so one trip stays in order. A streaming path serves the dashboards; an hourly batch MERGE is the source of truth for finance.',
    probe: {
      question: 'Why this grain?',
      answer:
        'Events arrive many per trip. Collapsing them to the latest state per trip_id gives one row per trip in both paths, so the live and batch numbers can be reconciled.',
    },
  },
  {
    id: 'operate',
    label: 'Operate',
    prompt: 'It is live. What do you check every hour, and what pages someone?',
    codeLabel: 'checks.sql',
    code: `-- Freshness: page if the newest trip is over 2 hours old
SELECT TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(updated_at), MINUTE)
FROM fct_trips;

-- Uniqueness: must return zero rows
SELECT trip_id FROM fct_trips
GROUP BY trip_id HAVING COUNT(*) > 1;`,
    model:
      'Freshness and uniqueness page someone; volume against the same hour last week warns. Finance gets a daily reconciliation against the payments ledger.',
    probe: {
      question: 'Why this grain?',
      answer:
        'A declared grain is a testable promise. Because one row means one trip, a duplicate trip_id is a bug you can detect with one query.',
    },
  },
];

/**
 * The landing page's sample question: a data model design, answered in five
 * steps the way a senior candidate walks an interviewer through it. Each step
 * shows the working, and the model answer and the follow-up open on demand.
 *
 * A client component: it keeps the open step and what the visitor revealed.
 */
export function TryQuestion() {
  const [index, setIndex] = useState(2);
  const [shown, setShown] = useState<'model' | 'probe' | null>(null);
  const step = STEPS[index] ?? STEPS[0];
  if (step === undefined) return null;

  return (
    <section
      aria-labelledby="try-heading"
      className="bg-surface border-line rounded-sheet shadow-raised flex min-w-0 flex-col gap-4 border p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-brand-deep">Try a question</p>
        <span className="bg-medium-soft text-medium rounded-pill text-micro px-2.5 py-1 font-semibold">
          Medium · Data modeling
        </span>
      </div>
      <h2 id="try-heading" className="text-heading">
        Design the trips fact table for a ride-sharing marketplace.
      </h2>

      <div role="tablist" aria-label="Steps of the answer" className="flex flex-wrap gap-1.5">
        {STEPS.map((item, itemIndex) => {
          const active = itemIndex === index;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`try-tab-${item.id}`}
              aria-selected={active}
              aria-controls="try-panel"
              onClick={() => {
                setIndex(itemIndex);
                setShown(null);
              }}
              className={cn(
                'rounded-pill text-small inline-flex min-h-10 shrink-0 items-center gap-1.5 border px-3 font-medium transition-colors',
                active
                  ? 'bg-ink border-ink text-on-night'
                  : 'border-line text-ink-soft hover:text-ink hover:border-line-strong',
              )}
            >
              <span className={cn('font-mono', active ? 'text-gold' : 'text-ink-faint')}>
                {itemIndex + 1}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id="try-panel"
        role="tabpanel"
        aria-labelledby={`try-tab-${step.id}`}
        className="flex min-w-0 flex-col gap-3"
      >
        <p className="text-body text-ink-soft">{step.prompt}</p>
        <div className="bg-night-deep rounded-card min-w-0 overflow-hidden">
          <div className="border-night-line flex items-center gap-1.5 border-b px-4 py-2.5">
            <span aria-hidden="true" className="bg-hard-bar size-2.5 rounded-full" />
            <span aria-hidden="true" className="bg-medium-bar size-2.5 rounded-full" />
            <span aria-hidden="true" className="bg-easy-bar size-2.5 rounded-full" />
            <span className="text-micro text-on-night-soft ml-2 font-mono">{step.codeLabel}</span>
          </div>
          <pre className="text-on-night text-small overflow-x-auto p-4 font-mono leading-relaxed">
            <code>{step.code}</code>
          </pre>
        </div>

        {shown !== null && (
          <div
            role="status"
            className={cn(
              'rounded-card text-body border-l-4 p-4',
              shown === 'model' ? 'bg-easy-soft border-l-easy-bar' : 'bg-brand-soft border-l-brand',
            )}
          >
            <p className="text-small mb-1 font-semibold">
              {shown === 'model' ? 'Model answer' : step.probe.question}
            </p>
            <p>{shown === 'model' ? step.model : step.probe.answer}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShown(shown === 'model' ? null : 'model')}
            aria-pressed={shown === 'model'}
            className="squish bg-ink text-on-night rounded-pill text-small inline-flex min-h-11 items-center px-5 font-semibold"
          >
            {shown === 'model' ? 'Hide model' : 'Reveal model'}
          </button>
          <button
            type="button"
            onClick={() => setShown(shown === 'probe' ? null : 'probe')}
            aria-pressed={shown === 'probe'}
            className="squish border-line-strong bg-surface rounded-pill text-small inline-flex min-h-11 items-center border px-5 font-semibold"
          >
            {step.probe.question}
          </button>
        </div>
      </div>
    </section>
  );
}
