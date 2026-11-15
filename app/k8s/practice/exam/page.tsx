import type { Metadata } from 'next';

import { QuizRun } from '@/components/gcp/QuizRun';
import { AppShell } from '@/components/layout/AppShell';
import {
  EXAM_PASS_ID,
  EXAM_PASS_RATIO,
  EXAM_QUESTIONS,
  EXAM_XP,
  examQuestionsFor,
  PORTS,
} from '@/lib/course/k8s/catalog';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Final exam',
  description:
    'The Kubernetes final exam: 25 questions from every port, lesson checks and incidents, with a review of every miss.',
};

export const dynamic = 'force-dynamic';

export default async function K8sExamPage() {
  const { progress, shell } = await requireK8sLearner('/k8s/practice/exam');
  // A port's share of the exam follows the size of its question bank.
  const groups = PORTS.map((port) => {
    const questions = examQuestionsFor(port.slug);
    return {
      line: { slug: port.slug, short: port.title, weight: questions.length },
      questions,
    };
  }).filter((group) => group.questions.length > 0);

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'Kubernetes course', href: '/k8s' },
        { label: 'Drills', href: '/k8s/practice' },
        { label: 'Final exam' },
      ]}
      back={{ fallbackHref: '/k8s/practice', label: 'Back to drills' }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <QuizRun
            course="k8s"
            mode="mock"
            words={{
              kind: 'Final exam',
              start: 'Start the final exam',
              passed: 'Final exam passed',
              breakdown: 'Score by port',
              code: 'Terminal',
            }}
            title="Final exam"
            story="Twenty-five questions from every port: the checks of the lessons and the incidents of the drills. Read the terminal output before you read the options."
            groups={groups}
            count={EXAM_QUESTIONS}
            passRatio={EXAM_PASS_RATIO}
            itemId={EXAM_PASS_ID}
            xp={EXAM_XP}
            done={progress.done[EXAM_PASS_ID] !== undefined}
            backHref="/k8s"
            backLabel="Back to the course"
          />
        </div>
      </main>
    </AppShell>
  );
}
