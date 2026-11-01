import { DIFFICULTY_LABELS } from '@/lib/course/catalog';
import { cn } from '@/lib/utils';
import type { Difficulty } from '@/types/course';

/**
 * A problem's difficulty in words. Each level keeps one candy tone across the
 * site, so the tone is identity and the word carries the meaning.
 */
const TONE: Record<Difficulty, string> = {
  easy: 'bg-soda',
  medium: 'bg-butter',
  hard: 'bg-peach',
};

export interface DifficultyTagProps {
  difficulty: Difficulty;
  className?: string;
}

export function DifficultyTag({ difficulty, className }: DifficultyTagProps) {
  return (
    <span
      className={cn(
        'border-line rounded-pill inline-flex items-center border-2 px-2.5 py-0.5 text-small font-bold whitespace-nowrap',
        TONE[difficulty],
        className,
      )}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}
