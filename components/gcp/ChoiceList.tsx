import { InlineText } from '@/components/course/InlineText';
import { cn } from '@/lib/utils';

/**
 * - `idle`: not picked.
 * - `selected`: picked, not marked yet (a "choose two" question before Check).
 * - `right` / `wrong`: marked.
 * - `answer`: the correct option, revealed after a wrong pick in an exam.
 * - `muted`: out of play once the question is settled.
 */
export type ChoiceState = 'idle' | 'selected' | 'right' | 'wrong' | 'answer' | 'muted';

export interface ChoiceListProps {
  options: readonly string[];
  state: (index: number) => ChoiceState;
  onChoose: (index: number) => void;
  /** Wobble the list after a wrong pick. */
  wobble?: boolean;
  /** Letters (A, B, C…) instead of the round marker, as the exam shows. */
  lettered?: boolean;
}

const LETTERS = 'ABCDEFGH';

const WORDS: Partial<Record<ChoiceState, string>> = {
  right: 'Correct',
  wrong: 'Not quite',
  answer: 'Answer',
};

/**
 * Answer options as large tap targets. The state is never colour alone: a
 * marked option also says "Correct", "Not quite" or "Answer" in words.
 */
export function ChoiceList({
  options,
  state,
  onChoose,
  wobble = false,
  lettered = false,
}: ChoiceListProps) {
  return (
    <ul className={cn('flex flex-col gap-2', wobble && 'animate-wobble')}>
      {options.map((option, index) => {
        const current = state(index);
        const word = WORDS[current];
        return (
          <li key={option}>
            <button
              type="button"
              onClick={() => onChoose(index)}
              aria-pressed={current !== 'idle' && current !== 'muted'}
              disabled={current === 'muted'}
              className={cn(
                'rounded-input text-body flex min-h-12 w-full items-center gap-3 border px-4 py-2.5 text-left transition-colors',
                current === 'idle' && 'bg-surface border-line hover:border-line-strong',
                current === 'selected' && 'bg-brand-soft border-brand',
                current === 'right' && 'bg-easy-soft border-easy-bar',
                current === 'answer' && 'bg-surface border-easy-bar',
                current === 'wrong' && 'bg-hard-soft border-hard-bar',
                current === 'muted' && 'bg-surface border-line opacity-60',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'rounded-box text-micro inline-grid size-6 shrink-0 place-items-center border font-mono font-semibold',
                  (current === 'idle' || current === 'muted') && 'border-line-strong bg-surface',
                  current === 'selected' && 'bg-brand border-brand text-on-night',
                  (current === 'right' || current === 'answer') &&
                    'bg-easy-bar border-easy-bar text-on-night',
                  current === 'wrong' && 'bg-hard-bar border-hard-bar text-on-night',
                )}
              >
                {lettered
                  ? LETTERS[index]
                  : current === 'right'
                    ? '✓'
                    : current === 'wrong'
                      ? '✕'
                      : ''}
              </span>
              <span className="grow">
                <InlineText text={option} />
              </span>
              {word !== undefined && (
                <span
                  className={cn(
                    'text-small shrink-0 font-semibold',
                    current === 'wrong' ? 'text-hard' : 'text-easy',
                  )}
                >
                  {word}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
