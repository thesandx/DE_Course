import { describe, expect, it } from 'vitest';

import { parseInline, parseMarkdown } from '@/lib/course/markdown';

import {
  allStations,
  BOSS_XP,
  bossId,
  CARD_XP,
  CARDS,
  cardsFor,
  examReadiness,
  gcpTotalXp,
  gcpXpForItem,
  getLine,
  getStation,
  isKnownGcpItem,
  lineOfStation,
  lineProgress,
  LINES,
  MOCK_PASS_ID,
  MOCK_XP,
  nextStation,
  QUESTIONS,
  questionsForLine,
  rankFor,
  SPRINT,
  sprintId,
  stationId,
  stationXp,
} from './catalog';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** True when the text has no HTML tag left over from the source module. */
function clean(text: string): boolean {
  return (
    !/<\/?(p|b|i|code|ul|ol|li|h4|table|tr|td|th|div|span)[\s>]/.test(text) &&
    !text.includes('`') &&
    !text.includes('${')
  );
}

describe('GCP catalogue integrity', () => {
  it('has five lines whose exam weights add up to 100', () => {
    expect(LINES).toHaveLength(5);
    expect(LINES.reduce((sum, line) => sum + line.weight, 0)).toBe(100);
    expect(LINES.map((line) => line.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('has 19 stations with unique, URL-safe slugs, none named "boss"', () => {
    const slugs = allStations().map((ref) => ref.station.slug);
    expect(slugs).toHaveLength(19);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(SLUG);
      expect(slug).not.toBe('boss');
    }
  });

  it('gives every station concepts and at least one checkpoint', () => {
    for (const { station } of allStations()) {
      expect(station.concepts.length, station.slug).toBeGreaterThan(0);
      expect(station.keyPoints.length, station.slug).toBeGreaterThan(0);
    }
  });

  it('has checkpoints whose answers point at real options', () => {
    for (const { station } of allStations()) {
      for (const { check } of station.keyPoints) {
        if (check.type === 'choice') {
          expect(check.answers.length, check.prompt).toBeGreaterThan(0);
          for (const answer of check.answers) {
            expect(check.options[answer], check.prompt).toBeDefined();
          }
        } else if (check.type === 'match') {
          expect(check.pairs.length, check.prompt).toBeGreaterThan(1);
          const rights = check.pairs.map(([, right]) => right);
          expect(new Set(rights).size, check.prompt).toBe(rights.length);
        } else {
          expect(check.steps.length, check.prompt).toBeGreaterThan(1);
        }
      }
    }
  });

  it('has bank questions that name a real station and a real answer', () => {
    expect(QUESTIONS.length).toBe(139);
    for (const question of QUESTIONS) {
      expect(lineOfStation(question.station), question.prompt).toBeDefined();
      expect(question.answers.length).toBeGreaterThan(0);
      for (const answer of question.answers) expect(question.options[answer]).toBeDefined();
      expect(new Set(question.options).size, question.prompt).toBe(question.options.length);
    }
  });

  it('has enough bank questions on every line for a ten-question boss round', () => {
    for (const line of LINES) expect(questionsForLine(line.slug).length).toBeGreaterThanOrEqual(10);
  });

  it('has flashcards and sprint rounds for real lines with distinct options', () => {
    expect(CARDS.length).toBe(79);
    for (const card of CARDS) expect(getLine(card.line), card.front).toBeDefined();
    for (const round of SPRINT) {
      const options = [round.answer, ...round.distractors];
      expect(new Set(options).size, round.scenario).toBe(4);
    }
  });

  it('carries no HTML, backtick or template marker over from the source', () => {
    const texts: string[] = [];
    for (const line of LINES) {
      texts.push(line.intro, line.boss.story);
      for (const station of line.stations) {
        texts.push(station.mission, station.title);
        for (const concept of station.concepts) texts.push(concept.title, concept.body);
        for (const point of station.keyPoints) {
          texts.push(point.point, point.more ?? '', point.check.prompt, point.check.why);
        }
      }
    }
    for (const question of QUESTIONS)
      texts.push(question.prompt, question.why, ...question.options);
    for (const card of CARDS) texts.push(card.front, card.back);
    for (const text of texts) expect(clean(text), text.slice(0, 80)).toBe(true);
  });

  it('parses every concept body into blocks with closed inline markers', () => {
    for (const { station } of allStations()) {
      for (const concept of station.concepts) {
        const blocks = parseMarkdown(concept.body);
        expect(blocks.length, concept.title).toBeGreaterThan(0);
        for (const block of blocks) {
          if (block.kind !== 'paragraph') continue;
          const plain = parseInline(block.text)
            .filter((run) => run.kind === 'text')
            .map((run) => run.text)
            .join('');
          expect(plain.includes('**'), `${concept.title}: ${block.text.slice(0, 60)}`).toBe(false);
        }
      }
    }
  });
});

describe('GCP item ids and XP', () => {
  const station = allStations()[0]?.station;
  if (station === undefined) throw new Error('no station');

  it('prices each kind of item from the catalogue', () => {
    expect(gcpXpForItem(stationId(station.slug))).toBe(stationXp(station));
    expect(gcpXpForItem(bossId('design'))).toBe(BOSS_XP);
    expect(gcpXpForItem('card:design:0')).toBe(CARD_XP);
    expect(gcpXpForItem(sprintId(10))).toBeGreaterThan(0);
    expect(gcpXpForItem(MOCK_PASS_ID)).toBe(MOCK_XP);
  });

  it('knows nothing the catalogue does not have', () => {
    for (const id of [
      'station:nope',
      'station:security-compliance:extra',
      'boss:nope',
      'card:design:999',
      'card:design:01',
      'card:design:-1',
      'sprint:15',
      'mock:fail',
      'lesson:sql:window-functions',
      '',
    ]) {
      expect(isKnownGcpItem(id), id).toBe(false);
    }
  });

  it('gives each card a stable id inside its line', () => {
    const design = cardsFor('design');
    expect(design[0]?.id).toBe('card:design:0');
    expect(new Set(cardsFor().map((card) => card.id)).size).toBe(CARDS.length);
  });

  it('adds XP only for known items', () => {
    const done = { [stationId(station.slug)]: '2026-11-01', 'station:gone': '2026-11-01' };
    expect(gcpTotalXp(done)).toBe(stationXp(station));
  });
});

describe('GCP progress', () => {
  const design = getLine('design');
  if (design === undefined) throw new Error('no design line');
  const allDesign = Object.fromEntries(
    design.stations.map((station) => [stationId(station.slug), '2026-11-01']),
  );

  it('opens the boss when every station on the line is done', () => {
    expect(lineProgress(design, {}).bossOpen).toBe(false);
    const stats = lineProgress(design, allDesign);
    expect(stats.bossOpen).toBe(true);
    expect(stats.ratio).toBeCloseTo(design.stations.length / (design.stations.length + 1));
    expect(lineProgress(design, { ...allDesign, [bossId('design')]: '2026-11-01' }).ratio).toBe(1);
  });

  it('weights readiness by exam share', () => {
    expect(examReadiness({})).toBe(0);
    const full = { ...allDesign, [bossId('design')]: '2026-11-01' };
    expect(examReadiness(full)).toBeCloseTo(design.weight / 100);
  });

  it('points at the first unfinished station in study order', () => {
    expect(nextStation({})?.station.code).toBe('1.1');
    expect(nextStation(allDesign)?.station.code).toBe('2.1');
  });

  it('finds a station inside its own line only', () => {
    expect(getStation('design', 'security-compliance')?.index).toBe(0);
    expect(getStation('ingest', 'security-compliance')).toBeUndefined();
  });

  it('climbs the rank ladder and stops at the top', () => {
    expect(rankFor(0)).toMatchObject({ number: 1, title: 'Trainee', to: 150 });
    expect(rankFor(150).title).toBe('Junior DE');
    expect(rankFor(100_000)).toMatchObject({ title: 'Exam-ready', to: null });
  });

  it('lets the whole course reach the top rank', () => {
    const everything: Record<string, string> = {};
    for (const { station } of allStations()) everything[stationId(station.slug)] = '2026-11-01';
    for (const line of LINES) everything[bossId(line.slug)] = '2026-11-01';
    for (const card of cardsFor()) everything[card.id] = '2026-11-01';
    everything[sprintId(10)] = '2026-11-01';
    everything[sprintId(20)] = '2026-11-01';
    everything[MOCK_PASS_ID] = '2026-11-01';
    expect(rankFor(gcpTotalXp(everything)).to).toBeNull();
  });
});
