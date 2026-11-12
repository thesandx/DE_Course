import { InlineText } from '@/components/course/InlineText';
import { cn } from '@/lib/utils';
import type {
  DiagramBox,
  DiagramColumn,
  DiagramLane,
  DiagramShape,
  DiagramTone,
  GcpDiagram,
} from '@/types/gcp';

export interface ConceptDiagramProps {
  diagram: GcpDiagram;
  /** Makes the heading id unique when a page shows several diagrams. */
  id: string;
}

interface ToneStyle {
  /** The top edge of a box. */
  edge: string;
  /** A dot, a swatch or a solid bar. */
  fill: string;
  /** A see-through stretch on a timeline, with its outline. */
  span: string;
}

/**
 * The tones as literal class names, so Tailwind can read them. Every value is
 * a design token, so a diagram follows light and dark mode by itself.
 */
const TONES: Readonly<Record<DiagramTone, ToneStyle>> = {
  plain: {
    edge: 'border-t-line-strong',
    fill: 'bg-ink-faint',
    span: 'bg-ink-faint/15 border-ink-faint',
  },
  brand: { edge: 'border-t-brand', fill: 'bg-brand', span: 'bg-brand/15 border-brand' },
  iris: { edge: 'border-t-iris', fill: 'bg-iris', span: 'bg-iris/15 border-iris' },
  gold: { edge: 'border-t-gold', fill: 'bg-gold', span: 'bg-gold/20 border-gold-deep' },
  easy: { edge: 'border-t-easy-bar', fill: 'bg-easy-bar', span: 'bg-easy-bar/20 border-easy' },
  medium: {
    edge: 'border-t-medium-bar',
    fill: 'bg-medium-bar',
    span: 'bg-medium-bar/20 border-medium',
  },
  hard: { edge: 'border-t-hard-bar', fill: 'bg-hard-bar', span: 'bg-hard-bar/20 border-hard' },
  sky: { edge: 'border-t-track-2', fill: 'bg-track-2', span: 'bg-track-2/15 border-track-2' },
  teal: { edge: 'border-t-track-5', fill: 'bg-track-5', span: 'bg-track-5/15 border-track-5' },
};

const tone = (value: DiagramTone | undefined): ToneStyle => TONES[value ?? 'plain'];

/** Column counts as literal classes. A phone always gets one column. */
const COLUMNS: Readonly<Record<number, string>> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-2 lg:grid-cols-5',
  6: 'sm:grid-cols-2 lg:grid-cols-3',
};

const columns = (count: number): string => COLUMNS[count] ?? 'sm:grid-cols-2 lg:grid-cols-3';

/** How far each band of a nested stack steps in. */
const INDENT: readonly string[] = ['', 'ml-3 sm:ml-6', 'ml-6 sm:ml-12', 'ml-9 sm:ml-18'];

type Direction = 'down' | 'right' | 'flow' | 'flow-wide';

/**
 * An arrow. `flow` points down on a phone and right from `md` up; `flow-wide`
 * waits for `lg`, for a flow with five or more steps.
 */
function Arrow({ direction, className }: { direction: Direction; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        'text-ink-faint size-5 shrink-0',
        direction === 'down' && 'rotate-90',
        direction === 'flow' && 'rotate-90 md:rotate-0',
        direction === 'flow-wide' && 'rotate-90 lg:rotate-0',
        className,
      )}
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

function Chips({ chips }: { chips: readonly string[] | undefined }) {
  if (chips === undefined || chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <li
          key={chip}
          className="bg-sunken text-ink-soft rounded-pill text-micro px-2 py-0.5 font-mono break-all"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}

/** One box: a coloured top edge, a label, a note and chips. */
function Box({ box, className }: { box: DiagramBox; className?: string }) {
  return (
    <div
      className={cn(
        'bg-surface border-line rounded-input shadow-card flex min-w-0 flex-col gap-1.5 border border-t-4 p-3',
        tone(box.tone).edge,
        className,
      )}
    >
      <p className="text-small text-ink font-semibold break-words">
        <InlineText text={box.label} />
      </p>
      {box.note !== undefined && (
        <p className="text-micro text-ink-soft break-words">
          <InlineText text={box.note} />
        </p>
      )}
      <Chips chips={box.chips} />
    </div>
  );
}

function Flow({ shape }: { shape: Extract<DiagramShape, { kind: 'flow' }> }) {
  const wide = shape.steps.length >= 5;
  const direction: Direction = wide ? 'flow-wide' : 'flow';
  return (
    <div className="flex flex-col gap-2">
      <ol
        className={cn(
          'flex flex-col items-stretch gap-1',
          wide ? 'lg:flex-row lg:items-center' : 'md:flex-row md:items-center',
        )}
      >
        {shape.steps.map((step, index) => {
          const edge = shape.edges?.[index];
          return (
            <li
              key={`${step.label}-${index}`}
              className={cn(
                'flex min-w-0 flex-col items-stretch gap-1',
                wide
                  ? 'lg:flex-1 lg:flex-row lg:items-center'
                  : 'md:flex-1 md:flex-row md:items-center',
              )}
            >
              <Box
                box={step}
                className={wide ? 'lg:flex-1 lg:self-stretch' : 'md:flex-1 md:self-stretch'}
              />
              {index < shape.steps.length - 1 && (
                <div
                  className={cn(
                    'flex items-center gap-2 py-1 pl-4',
                    wide
                      ? 'lg:w-14 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:px-0 lg:py-0'
                      : 'md:w-14 md:shrink-0 md:flex-col md:gap-0.5 md:px-0 md:py-0',
                  )}
                >
                  <Arrow direction={direction} />
                  {edge !== undefined && (
                    <span className="text-micro text-ink-soft font-mono lg:text-center">
                      {edge}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {shape.fork !== undefined && (
        <div className="flex flex-col gap-2">
          <p className="text-micro text-ink-soft flex items-center gap-2 pl-4 font-mono">
            <Arrow direction="down" />
            {shape.fork.label}
          </p>
          <ul className={cn('grid grid-cols-1 gap-2', columns(shape.fork.boxes.length))}>
            {shape.fork.boxes.map((box) => (
              <li key={box.label} className="flex">
                <Box box={box} className="flex-1" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Decision({ shape }: { shape: Extract<DiagramShape, { kind: 'decision' }> }) {
  return (
    <ol className="flex flex-col">
      {shape.questions.map((question, index) => (
        <li key={question.ask} className="flex flex-col">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <p className="bg-surface border-line-strong rounded-input text-small text-ink flex min-w-0 items-start gap-2 border border-dashed p-3 md:flex-1">
              <span className="bg-ink text-on-ink rounded-box text-micro shrink-0 px-1.5 py-0.5 font-mono">
                Q{index + 1}
              </span>
              <span className="min-w-0 break-words">
                <InlineText text={question.ask} />
              </span>
            </p>
            <span className="text-micro text-easy flex items-center gap-1 pl-4 font-mono font-semibold md:flex-col md:gap-0 md:pl-0">
              <Arrow direction="flow" className="text-easy" />
              Yes
            </span>
            <Box box={question.yes} className="md:w-2/5 md:shrink-0" />
          </div>
          <p className="text-micro text-hard flex items-center gap-1 py-1.5 pl-4 font-mono font-semibold">
            <Arrow direction="down" className="text-hard" />
            No
          </p>
        </li>
      ))}
      <li className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
        <p className="text-micro text-ink-soft font-mono md:flex-1 md:text-right">
          None of the above
        </p>
        <Box box={shape.otherwise} className="md:w-2/5 md:shrink-0" />
      </li>
    </ol>
  );
}

function Layers({ shape }: { shape: Extract<DiagramShape, { kind: 'layers' }> }) {
  return (
    <div className="flex flex-col gap-2">
      {shape.rail !== undefined && (
        <p className="text-micro text-ink-soft flex items-center gap-1 font-mono">
          <Arrow direction="down" />
          {shape.rail}
        </p>
      )}
      <div className="flex gap-3">
        {shape.rail !== undefined && (
          <div aria-hidden="true" className="flex flex-col items-center pt-2">
            <span className="bg-line-strong w-px flex-1" />
            <Arrow direction="down" className="-mt-1" />
          </div>
        )}
        <ol className="flex min-w-0 flex-1 flex-col gap-2">
          {shape.layers.map((layer, index) => (
            <li
              key={layer.label}
              className={cn('flex', shape.nested === true && INDENT[Math.min(index, 3)])}
            >
              <Box box={layer} className="flex-1" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Spectrum({ shape }: { shape: Extract<DiagramShape, { kind: 'spectrum' }> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-micro text-ink-soft hidden items-center gap-2 font-mono md:flex">
        <span className="shrink-0">{shape.from}</span>
        <span aria-hidden="true" className="bg-line-strong h-px flex-1" />
        <Arrow direction="right" className="-ml-3" />
        <span className="shrink-0">{shape.to}</span>
      </p>
      <p className="text-micro text-ink-soft font-mono md:hidden">{shape.from}</p>
      <div className="flex gap-3">
        <div aria-hidden="true" className="flex flex-col items-center md:hidden">
          <span className="bg-line-strong w-px flex-1" />
          <Arrow direction="down" className="-mt-1" />
        </div>
        <ol className={cn('grid min-w-0 flex-1 grid-cols-1 gap-2', columns(shape.stops.length))}>
          {shape.stops.map((stop) => (
            <li key={stop.label} className="flex">
              <Box box={stop} className="flex-1" />
            </li>
          ))}
        </ol>
      </div>
      <p className="text-micro text-ink-soft font-mono md:hidden">{shape.to}</p>
    </div>
  );
}

function Column({ column }: { column: DiagramColumn }) {
  return (
    <div
      className={cn(
        'bg-surface border-line rounded-input shadow-card flex min-w-0 flex-1 flex-col gap-2 border border-t-4 p-3',
        tone(column.tone).edge,
      )}
    >
      <p className="text-small text-ink font-semibold">
        <InlineText text={column.label} />
      </p>
      {column.note !== undefined && (
        <p className="text-micro text-ink-soft">
          <InlineText text={column.note} />
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {column.points.map((point) => (
          <li key={point} className="text-small text-ink-soft flex gap-2">
            <span
              aria-hidden="true"
              className={cn('mt-2 size-1.5 shrink-0 rounded-full', tone(column.tone).fill)}
            />
            <span className="min-w-0 break-words">
              <InlineText text={point} />
            </span>
          </li>
        ))}
      </ul>
      <Chips chips={column.chips} />
    </div>
  );
}

function Compare({ shape }: { shape: Extract<DiagramShape, { kind: 'compare' }> }) {
  return (
    <ul className={cn('grid grid-cols-1 gap-2', columns(shape.columns.length))}>
      {shape.columns.map((column) => (
        <li key={column.label} className="flex">
          <Column column={column} />
        </li>
      ))}
    </ul>
  );
}

function Spoke({ box, side }: { box: DiagramBox; side: 'left' | 'right' }) {
  return (
    <li className={cn('flex items-center', side === 'left' && 'md:flex-row-reverse')}>
      <span aria-hidden="true" className="bg-line-strong hidden h-px w-4 shrink-0 md:block" />
      <Box box={box} className="flex-1" />
    </li>
  );
}

function Hub({ shape }: { shape: Extract<DiagramShape, { kind: 'hub' }> }) {
  const half = Math.ceil(shape.spokes.length / 2);
  const left = shape.spokes.slice(0, half);
  const right = shape.spokes.slice(half);
  return (
    <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:items-center md:gap-0">
      <ul className="order-3 flex flex-col gap-2 md:order-1">
        {left.map((box) => (
          <Spoke key={box.label} box={box} side="left" />
        ))}
      </ul>
      <div className="order-1 flex flex-col items-stretch gap-1 md:order-2">
        <div className="bg-night text-on-night border-night-line rounded-card shadow-raised flex flex-col gap-1.5 border p-4 md:mx-0">
          <p className="text-small font-semibold">
            <InlineText text={shape.center.label} />
          </p>
          {shape.center.note !== undefined && (
            <p className="text-micro text-on-night-soft">
              <InlineText text={shape.center.note} />
            </p>
          )}
        </div>
        <span aria-hidden="true" className="flex justify-center md:hidden">
          <Arrow direction="down" />
        </span>
      </div>
      <ul className="order-4 flex flex-col gap-2 md:order-3">
        {right.map((box) => (
          <Spoke key={box.label} box={box} side="right" />
        ))}
      </ul>
    </div>
  );
}

function Lane({ lane, marks }: { lane: DiagramLane; marks: readonly { at: number }[] }) {
  const twoRows = lane.spans?.some((span) => span.row === 1) ?? false;
  return (
    <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <p className="text-micro text-ink-soft font-mono sm:w-28 sm:shrink-0">{lane.label}</p>
      <div
        className={cn(
          'bg-surface border-line rounded-input relative w-full shrink-0 overflow-hidden border sm:w-auto sm:flex-1',
          twoRows ? 'h-16' : 'h-10',
        )}
      >
        {marks.map((mark) => (
          <span
            key={mark.at}
            aria-hidden="true"
            className="border-hard absolute inset-y-0 border-l border-dashed"
            style={{ left: `${mark.at}%` }}
          />
        ))}
        {(lane.spans ?? []).map((span, index) => (
          <span
            key={`${span.start}-${index}`}
            className={cn(
              'rounded-box text-micro text-ink absolute flex items-center overflow-hidden border px-1.5 font-mono whitespace-nowrap',
              tone(span.tone).span,
              twoRows ? (span.row === 1 ? 'bottom-1 h-6' : 'top-1 h-6') : 'inset-y-1',
            )}
            style={{ left: `${span.start}%`, width: `${span.end - span.start}%` }}
          >
            {span.label}
          </span>
        ))}
        {(lane.dots ?? []).map((dot, index) => (
          <span
            key={`${dot.at}-${index}`}
            aria-hidden="true"
            className={cn(
              'ring-surface absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2',
              tone(dot.tone).fill,
            )}
            style={{ left: `${dot.at}%` }}
          />
        ))}
      </div>
    </li>
  );
}

function Timeline({ shape }: { shape: Extract<DiagramShape, { kind: 'timeline' }> }) {
  const marks = shape.marks ?? [];
  return (
    <div className="flex flex-col gap-2">
      {marks.length > 0 && (
        <div className="flex sm:gap-3">
          <span aria-hidden="true" className="hidden sm:block sm:w-28 sm:shrink-0" />
          <p className="text-micro text-hard relative h-4 flex-1 font-mono">
            {marks.map((mark) => (
              <span
                key={mark.at}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${Math.min(Math.max(mark.at, 12), 88)}%` }}
              >
                {mark.label}
              </span>
            ))}
          </p>
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {shape.lanes.map((lane) => (
          <Lane key={lane.label} lane={lane} marks={marks} />
        ))}
      </ol>
      <div className="flex sm:gap-3">
        <span aria-hidden="true" className="hidden sm:block sm:w-28 sm:shrink-0" />
        <p className="text-micro text-ink-soft flex flex-1 items-center gap-2 font-mono">
          <span>{shape.axis.start}</span>
          <span aria-hidden="true" className="bg-line-strong h-px flex-1" />
          <Arrow direction="right" className="-ml-3" />
          <span>{shape.axis.end}</span>
        </p>
      </div>
    </div>
  );
}

function Grid({ shape }: { shape: Extract<DiagramShape, { kind: 'grid' }> }) {
  const read = new Set(shape.read.map(([row, column]) => `${row}:${column}`));
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            <th scope="col" className="w-20 sm:w-28">
              <span className="sr-only">Block</span>
            </th>
            {shape.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="text-micro text-ink-soft truncate pb-1 text-center font-mono font-normal"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shape.rows.map((row, rowIndex) => (
            <tr key={row}>
              <th
                scope="row"
                className="text-micro text-ink-soft pr-1 text-left font-mono font-normal"
              >
                {row}
              </th>
              {shape.columns.map((column, columnIndex) => {
                const hit = read.has(`${rowIndex}:${columnIndex}`);
                return (
                  <td
                    key={column}
                    className={cn(
                      'rounded-box text-micro h-8 border text-center font-mono',
                      hit
                        ? 'bg-brand border-brand text-on-night font-semibold'
                        : 'bg-surface border-line text-ink-faint',
                    )}
                  >
                    {hit ? 'read' : <span aria-hidden="true">·</span>}
                    {!hit && <span className="sr-only">skipped</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="text-micro text-ink-soft flex flex-wrap gap-x-4 gap-y-1 font-mono">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-brand rounded-dot size-3" />
          {shape.legend.read}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-surface border-line rounded-dot size-3 border" />
          {shape.legend.skipped}
        </li>
      </ul>
    </div>
  );
}

function Boundary({ shape }: { shape: Extract<DiagramShape, { kind: 'boundary' }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-center">
      <div className="border-brand rounded-card flex flex-col gap-2 border border-dashed p-3">
        <p className="eyebrow text-brand-deep">{shape.inside.label}</p>
        <ul className="grid grid-cols-1 gap-2">
          {shape.inside.boxes.map((box) => (
            <li key={box.label} className="flex">
              <Box box={box} className="flex-1" />
            </li>
          ))}
        </ul>
      </div>
      <ul className="flex flex-col gap-2">
        {shape.outside.map((box) => (
          <li key={box.label} className="flex flex-col gap-1">
            <span
              className={cn(
                'rounded-pill text-micro flex items-center gap-1 self-start px-2 py-0.5 font-mono font-semibold',
                box.verdict === 'blocked' ? 'bg-hard-soft text-hard' : 'bg-easy-soft text-easy',
              )}
            >
              <Arrow direction="right" className="size-3.5 rotate-180 text-current" />
              {box.verdict === 'blocked' ? 'Blocked' : 'Allowed'}
            </span>
            <Box box={box} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pairs({ shape }: { shape: Extract<DiagramShape, { kind: 'pairs' }> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow text-ink-faint flex gap-2">
        <span className="flex-1">{shape.left}</span>
        <span aria-hidden="true" className="w-5 shrink-0" />
        <span className="flex-1">{shape.right}</span>
      </p>
      <ul className="flex flex-col gap-2">
        {shape.pairs.map(([from, to]) => (
          <li key={from} className="flex items-center gap-2">
            <span className="bg-surface border-line rounded-input text-small text-ink-soft min-w-0 flex-1 border p-2.5 break-words">
              <InlineText text={from} />
            </span>
            <Arrow direction="right" />
            <span className="bg-surface border-line border-t-track-5 rounded-input text-small text-ink min-w-0 flex-1 border border-t-4 p-2.5 font-semibold break-words">
              <InlineText text={to} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Shape({ diagram }: { diagram: GcpDiagram }) {
  switch (diagram.kind) {
    case 'flow':
      return <Flow shape={diagram} />;
    case 'decision':
      return <Decision shape={diagram} />;
    case 'layers':
      return <Layers shape={diagram} />;
    case 'spectrum':
      return <Spectrum shape={diagram} />;
    case 'compare':
      return <Compare shape={diagram} />;
    case 'hub':
      return <Hub shape={diagram} />;
    case 'timeline':
      return <Timeline shape={diagram} />;
    case 'grid':
      return <Grid shape={diagram} />;
    case 'boundary':
      return <Boundary shape={diagram} />;
    case 'pairs':
      return <Pairs shape={diagram} />;
  }
}

/**
 * A picture of one concept, drawn from data in `lib/course/gcp/diagrams/`.
 * The boxes are HTML, not an image, so the text stays readable on a phone,
 * follows light and dark mode, and reaches a screen reader. Every shape reads
 * top to bottom on a phone and spreads out from `md` up.
 */
export function ConceptDiagram({ diagram, id }: ConceptDiagramProps) {
  const headingId = `${id}-title`;
  return (
    <figure
      aria-labelledby={headingId}
      className="bg-sunken border-line rounded-card flex min-w-0 flex-col gap-4 border p-4 sm:p-5"
    >
      <p className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <span className="bg-ink text-on-ink rounded-pill eyebrow shrink-0 px-2.5 py-0.5">
          Diagram
        </span>
        <span id={headingId} className="text-heading text-ink min-w-0">
          {diagram.title}
        </span>
      </p>
      <Shape diagram={diagram} />
      <figcaption className="text-small text-ink-soft border-line border-t pt-3">
        <InlineText text={diagram.caption} />
      </figcaption>
    </figure>
  );
}
