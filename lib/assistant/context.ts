/**
 * Works out what the learner is looking at, from the page's path, so the AI
 * doubt assistant can answer about THIS lesson, problem or lab.
 *
 * The browser sends only the path. The text comes from the catalogue here, on
 * the server, so a caller cannot stuff a long prompt into the context and the
 * request stays small. An unknown path still gets the course-level context.
 *
 * Pure: no I/O. It imports the whole catalogue, so only the route handler uses it.
 */

import {
  getCompany,
  getLesson,
  getProblem,
  getTrack,
  problemsForTrack,
} from '@/lib/course/catalog';
import { getLab, getLine, getStation } from '@/lib/course/gcp/catalog';

export interface PageContext {
  /** A few words for the panel's "Asking about" line, such as "Lesson: Window functions". */
  label: string;
  /** The page's text for the model, capped at `MAX_CONTEXT_CHARS`. */
  text: string;
}

/** About 3,000 tokens: enough for a full lesson, small enough to keep a question cheap. */
export const MAX_CONTEXT_CHARS = 12_000;

function cap(text: string): string {
  return text.length <= MAX_CONTEXT_CHARS
    ? text
    : `${text.slice(0, MAX_CONTEXT_CHARS)}\n\n[The page continues; the rest is cut to keep the question small.]`;
}

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

const DE_COURSE = 'the Data Engineering interview course (senior and staff loops)';
const GCP_COURSE = 'the GCP Professional Data Engineer exam course';

function deContext(segments: readonly string[]): PageContext {
  const [section, first, second] = segments;

  if (section === 'tracks' && first !== undefined && second !== undefined) {
    const found = getLesson(first, second);
    if (found !== undefined) {
      const { track, lesson } = found;
      const checks = lesson.checks.map(
        (check) => `Q: ${check.question}\nA: ${check.options[check.answer] ?? ''} (${check.why})`,
      );
      return {
        label: `Lesson: ${lesson.title}`,
        text: cap(
          `The learner is reading a lesson in ${DE_COURSE}.\n` +
            `Track: ${track.title}. Lesson: ${lesson.title}.\nGoal: ${lesson.summary}\n\n` +
            `LESSON TEXT (inline code is written «like this», code blocks are fenced with ~~~):\n${lesson.body}\n\n` +
            `QUICK CHECKS AT THE END OF THE LESSON:\n${checks.join('\n\n')}`,
        ),
      };
    }
  }

  if (section === 'tracks' && first !== undefined) {
    const track = getTrack(first);
    if (track !== undefined) {
      const problems = problemsForTrack(track.slug).map((problem) => problem.title);
      return {
        label: `Track: ${track.title}`,
        text: cap(
          `The learner is on a track page in ${DE_COURSE}.\nTrack: ${track.title}. ${track.summary}\n` +
            `Why it matters: ${track.why}\n\nLessons:\n${bullets(
              track.lessons.map((lesson) => `${lesson.title}: ${lesson.summary}`),
            )}\n\nPractice problems:\n${bullets(problems)}`,
        ),
      };
    }
  }

  if (section === 'problems' && first !== undefined) {
    const problem = getProblem(first);
    if (problem !== undefined) {
      return {
        label: `Problem: ${problem.title}`,
        text: cap(
          `The learner is working on an interview problem in ${DE_COURSE}.\n` +
            `Problem: ${problem.title} (${problem.kind}, ${problem.difficulty}).\n\n` +
            `QUESTION:\n${problem.prompt}\n\nHINTS (weakest first):\n${bullets(problem.hints)}\n\n` +
            `MODEL ANSWER (hidden until the learner reveals it; do not paste it unless they ask for the answer):\n${problem.answer}\n\n` +
            `SENIOR SIGNALS:\n${bullets(problem.signals)}\n\nFOLLOW-UPS:\n${bullets(problem.followUps)}`,
        ),
      };
    }
  }

  if (section === 'companies' && first !== undefined) {
    const company = getCompany(first);
    if (company !== undefined) {
      const rounds = company.rounds.map(
        (round) => `${round.name} (${round.minutes} min): ${round.focus}`,
      );
      return {
        label: `Loop guide: ${company.name}`,
        text: cap(
          `The learner is reading the ${company.name} interview loop guide in ${DE_COURSE}.\n` +
            `${company.summary}\n\n${company.overview}\n\nROUNDS:\n${bullets(rounds)}`,
        ),
      };
    }
  }

  return {
    label: 'DE course',
    text: `The learner is in ${DE_COURSE}, on a list or dashboard page. It covers SQL, data modeling, Spark, streaming, orchestration, system design, cloud and behavioral rounds.`,
  };
}

function gcpContext(segments: readonly string[]): PageContext {
  const [section, first, second] = segments;

  if (section === 'labs' && first !== undefined) {
    const lab = getLab(first);
    if (lab !== undefined) {
      const steps = [...lab.steps, ...lab.cleanup].map((step, index) =>
        [
          `Step ${index + 1}: ${step.title}`,
          step.body,
          step.console === undefined ? '' : `Console: ${step.console}`,
          step.sql === undefined ? '' : `SQL:\n${step.sql}`,
          step.shell === undefined ? '' : `Cloud Shell:\n${step.shell}`,
          step.check === undefined ? '' : `Check: ${step.check}`,
        ]
          .filter((part) => part !== '')
          .join('\n'),
      );
      return {
        label: `Lab: ${lab.title}`,
        text: cap(
          `The learner is doing a hands-on lab in their own Google Cloud project, in ${GCP_COURSE}.\n` +
            `Lab: ${lab.title}. Scenario: ${lab.scenario}\nCreates: ${lab.creates.join(', ')}\n\n${steps.join('\n\n')}`,
        ),
      };
    }
  }

  if (section === 'lines' && first !== undefined && second !== undefined && second !== 'boss') {
    const found = getStation(first, second);
    if (found !== undefined) {
      const { line, station } = found;
      const concepts = station.concepts.map((concept) => `### ${concept.title}\n${concept.body}`);
      const points = station.keyPoints.map(
        (point) => `${point.point}${point.more === undefined ? '' : ` ${point.more}`}`,
      );
      return {
        label: `Station ${station.code}: ${station.title}`,
        text: cap(
          `The learner is studying a station in ${GCP_COURSE}.\nDomain: ${line.title}. ` +
            `Station ${station.code}: ${station.title}.\nMission: ${station.mission}\n\n` +
            `CONCEPTS:\n${concepts.join('\n\n')}\n\nKEY POINTS:\n${bullets(points)}`,
        ),
      };
    }
  }

  if (section === 'lines' && first !== undefined) {
    const line = getLine(first);
    if (line !== undefined) {
      return {
        label: `Domain: ${line.title}`,
        text: cap(
          `The learner is on exam domain ${line.number} (${line.weight}% of the exam) in ${GCP_COURSE}: ${line.title}.\n` +
            `${line.intro}\n\nStations:\n${bullets(
              line.stations.map(
                (station) => `${station.code} ${station.title}: ${station.mission}`,
              ),
            )}`,
        ),
      };
    }
  }

  return {
    label: 'GCP course',
    text: `The learner is in ${GCP_COURSE}, on a list, practice or dashboard page. It covers designing, ingesting, storing, analysing and operating data on Google Cloud.`,
  };
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A malformed escape such as "%E0" names no page; keep it as typed.
    return segment;
  }
}

/** The context for a page path such as `/de/tracks/sql/window-functions`. */
export function contextForPath(path: string): PageContext {
  const segments = (path.split(/[?#]/)[0] ?? '')
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => decode(segment).slice(0, 120));
  const [course, ...rest] = segments;
  if (course === 'de') return deContext(rest);
  if (course === 'gcp') return gcpContext(rest);
  return {
    label: 'Loop Ready',
    text: 'The learner is on the course hub or their profile. The courses are data engineering interview prep and the GCP Professional Data Engineer exam.',
  };
}
