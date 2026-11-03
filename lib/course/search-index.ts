/**
 * Builds the search index of each course from its catalogue. Server side
 * only in practice: it imports every lesson, and the search page sends the
 * page the compact entries, not the lesson text.
 *
 * An entry carries the terms inside its item (headings, bold terms, code and
 * table headers), so a search for "QUALIFY" or "watermark" finds the lesson
 * that teaches it, and a `##` section of a lesson is an entry of its own that
 * opens the lesson at that section.
 *
 * To add a course: add a case to `searchIndex` and a builder below.
 */

import { COMPANIES, DIFFICULTY_LABELS, KIND_LABELS, PROBLEMS, TRACKS } from '@/lib/course/catalog';
import type { CourseSlug } from '@/lib/course/courses';
import { LINES } from '@/lib/course/gcp/catalog';
import { hueStyle } from '@/lib/course/hue';
import { type Block, parseMarkdown, stripInline } from '@/lib/course/markdown';
import { sectionAnchor } from '@/lib/course/search';
import { trackStyle } from '@/lib/course/track-style';
import type { SearchEntry } from '@/types/search';

/** The marked terms of one line: «code» and **bold** runs. */
function markedTerms(text: string): string[] {
  const terms: string[] = [];
  for (const match of text.matchAll(/«([^»]+)»|\*\*([^*]+)\*\*/g)) {
    const term = match[1] ?? match[2];
    if (term !== undefined) terms.push(term);
  }
  return terms;
}

function blockTerms(block: Block): string[] {
  switch (block.kind) {
    case 'heading':
      return [stripInline(block.text)];
    case 'paragraph':
      return markedTerms(block.text);
    case 'list':
      return block.items.flatMap(markedTerms);
    case 'table':
      return [...block.head.map(stripInline), ...block.rows.flat().flatMap(markedTerms)];
    case 'callout':
      return [stripInline(block.title), ...block.body.flatMap(markedTerms)];
    case 'code':
      return [];
  }
}

/** The searchable terms of a text in the course dialect, without duplicates. */
export function termsOf(...sources: readonly string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const source of sources) {
    for (const term of parseMarkdown(source).flatMap(blockTerms)) {
      const clean = term.trim();
      const key = clean.toLowerCase();
      if (clean.length < 2 || clean.length > 80 || seen.has(key)) continue;
      seen.add(key);
      terms.push(clean);
    }
  }
  return terms;
}

/** The `##` sections of a body, with the terms inside each one. */
function sectionsOf(body: string): { title: string; terms: string[] }[] {
  const sections: { title: string; terms: string[] }[] = [];
  for (const block of parseMarkdown(body)) {
    if (block.kind === 'heading' && block.level === 2) {
      sections.push({ title: stripInline(block.text), terms: [] });
    } else {
      sections[sections.length - 1]?.terms.push(...blockTerms(block));
    }
  }
  return sections;
}

function deIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const track of TRACKS) {
    const dot = trackStyle(track.slug).fill;
    entries.push({
      id: `track:${track.slug}`,
      kind: 'track',
      title: track.title,
      context: 'Track',
      href: `/de/tracks/${track.slug}`,
      dot,
      detail: track.summary,
      keywords: [],
    });
    for (const lesson of track.lessons) {
      const href = `/de/tracks/${track.slug}/${lesson.slug}`;
      entries.push({
        id: `lesson:${track.slug}:${lesson.slug}`,
        kind: 'lesson',
        title: lesson.title,
        context: track.title,
        href,
        dot,
        detail: `${lesson.minutes} min · ${lesson.summary}`,
        keywords: termsOf(lesson.body),
      });
      sectionsOf(lesson.body).forEach((section, index) => {
        entries.push({
          id: `topic:${track.slug}:${lesson.slug}:${index + 1}`,
          kind: 'topic',
          title: section.title,
          context: lesson.title,
          href: `${href}#${sectionAnchor(index + 1)}`,
          dot,
          detail: `Section ${index + 1} of ${lesson.title}`,
          keywords: [...new Set(section.terms.map((term) => term.trim()))],
        });
      });
    }
  }
  for (const problem of PROBLEMS) {
    const trackTitle = TRACKS.find((track) => track.slug === problem.track)?.title ?? '';
    entries.push({
      id: `problem:${problem.slug}`,
      kind: 'problem',
      title: problem.title,
      context: trackTitle,
      href: `/de/problems/${problem.slug}`,
      dot: trackStyle(problem.track).fill,
      detail: `${DIFFICULTY_LABELS[problem.difficulty]} · ${KIND_LABELS[problem.kind]}`,
      keywords: [
        ...termsOf(problem.prompt, problem.answer),
        ...problem.companies,
        ...problem.signals,
      ],
    });
  }
  for (const company of COMPANIES) {
    entries.push({
      id: `guide:${company.slug}`,
      kind: 'guide',
      title: `${company.name} loop guide`,
      context: 'Loop guides',
      href: `/de/companies/${company.slug}`,
      dot: 'bg-brand',
      detail: company.summary,
      keywords: [
        ...company.highlights,
        ...company.rounds.map((round) => round.name),
        ...termsOf(company.overview),
      ],
    });
  }
  return entries;
}

function gcpIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const line of LINES) {
    const dot = hueStyle(line.hue).fill;
    const lineHref = `/gcp/lines/${line.slug}`;
    entries.push({
      id: `line:${line.slug}`,
      kind: 'line',
      title: line.title,
      context: `Line ${line.number} · ${line.weight}% of the exam`,
      href: lineHref,
      dot,
      detail: line.intro,
      keywords: [line.short],
    });
    for (const station of line.stations) {
      const href = `${lineHref}/${station.slug}`;
      entries.push({
        id: `station:${station.slug}`,
        kind: 'station',
        title: `${station.code} ${station.title}`,
        context: line.title,
        href,
        dot,
        detail: `${station.concepts.length} concepts · ${station.keyPoints.length} key points`,
        keywords: [
          ...station.concepts.map((concept) => concept.title),
          ...station.keyPoints.map((keyPoint) => stripInline(keyPoint.point)),
        ],
      });
      station.concepts.forEach((concept, index) => {
        entries.push({
          id: `concept:${station.slug}:${index + 1}`,
          kind: 'concept',
          title: concept.title,
          context: `${station.code} ${station.title}`,
          href: `${href}#concept-${index + 1}`,
          dot,
          detail: `Concept ${index + 1} of station ${station.code}`,
          keywords: termsOf(concept.body),
        });
      });
    }
    entries.push({
      id: `boss:${line.slug}`,
      kind: 'drill',
      title: `Boss round: ${line.boss.title}`,
      context: line.title,
      href: `${lineHref}/boss`,
      dot,
      detail: line.boss.story,
      keywords: ['boss', 'quiz', line.short],
    });
  }
  const drills: readonly { slug: string; title: string; href: string; detail: string }[] = [
    {
      slug: 'flashcards',
      title: 'Flashcards',
      href: '/gcp/practice/flashcards',
      detail: 'Flashcards for every exam domain.',
    },
    {
      slug: 'sprint',
      title: 'Service sprint',
      href: '/gcp/practice/sprint',
      detail: 'A 60-second drill: match each requirement to the service that fits.',
    },
    {
      slug: 'mock',
      title: 'Mock exam',
      href: '/gcp/practice/mock',
      detail: '50 questions, weighted by exam domain, with a review of every miss.',
    },
  ];
  for (const drill of drills) {
    entries.push({
      id: `drill:${drill.slug}`,
      kind: 'drill',
      title: drill.title,
      context: 'Drills',
      href: drill.href,
      dot: 'bg-brand',
      detail: drill.detail,
      keywords: ['practice', 'drill'],
    });
  }
  return entries;
}

const cache = new Map<CourseSlug, readonly SearchEntry[]>();

/** Every searchable item of a course. Built once per server process. */
export function searchIndex(course: CourseSlug): readonly SearchEntry[] {
  const cached = cache.get(course);
  if (cached !== undefined) return cached;
  const built = course === 'gcp' ? gcpIndex() : deIndex();
  cache.set(course, built);
  return built;
}

/** The top-level entries to browse before the learner types: tracks or lines. */
export function browseEntries(course: CourseSlug): readonly SearchEntry[] {
  return searchIndex(course).filter((entry) => entry.kind === 'track' || entry.kind === 'line');
}

/** Example searches for each course. Each one must find something; a test checks it. */
export const SEARCH_EXAMPLES: Readonly<Record<CourseSlug, readonly string[]>> = {
  de: ['window functions', 'SCD type 2', 'dbt incremental', 'watermarks', 'RAG', 'Prefect'],
  gcp: [
    'Bigtable row key',
    'CMEK',
    'Pub/Sub',
    'Dataflow',
    'BigQuery slots',
    'VPC Service Controls',
  ],
};

/** What a course's search finds, for the heading and the placeholder. */
export const SEARCH_SCOPE: Readonly<Record<CourseSlug, string>> = {
  de: 'topic, lesson or problem',
  gcp: 'service, station or concept',
};
