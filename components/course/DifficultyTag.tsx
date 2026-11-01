import { DIFFICULTY_LABELS } from '@/lib/course/catalog';
import { cn } from '@/lib/utils';
import type { Difficulty } from '@/types/course';

export interface DifficultyTagProps {
  difficulty: Difficulty;
  className?: string;
}

const TONE: Record<Difficulty, string> = {
  easy: 'bg-easy-soft text-easy',
  medium: 'bg-medium-soft text-medium',
  hard: 'bg-hard-soft text-hard',
};

/** Easy, Medium or Hard, as a soft pill. The word carries the meaning; the colour repeats it. */
export function DifficultyTag({ difficulty, className }: DifficultyTagProps) {
  return (
    <span
      className={cn(
        'rounded-pill text-small inline-flex items-center px-2.5 py-0.5 font-semibold whitespace-nowrap',
        TONE[difficulty],
        className,
      )}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}
