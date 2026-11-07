import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '@/lib/course/markdown';

import {
  allStations,
  gcpXpForItem,
  getLab,
  isKnownGcpItem,
  LAB_XP,
  labId,
  labProgress,
  LABS,
} from './catalog';
import { dataStep, fileCommand, labPlan, setupStep, tickIds } from './labs';

/** Names a lab's shell code reads as `$NAME`, which something must set first. */
function readVars(code: string): string[] {
  return [...code.matchAll(/\$([A-Z][A-Z0-9_]*)/g)].map((match) => match[1] ?? '');
}

/** Names the shell code sets itself, with `export NAME=` or `NAME=`. */
function setVars(code: string): string[] {
  return [...code.matchAll(/(?:^|\s)(?:export\s+)?([A-Z][A-Z0-9_]*)=/gm)].map(
    (match) => match[1] ?? '',
  );
}

const prose = (lab: (typeof LABS)[number]): string[] =>
  [...lab.steps, ...lab.cleanup].flatMap((step) => [
    step.body,
    step.console ?? '',
    step.check ?? '',
    step.see ?? '',
  ]);

describe('the GCP labs', () => {
  it('has exactly one lab for every station, in study order', () => {
    expect(LABS.map((lab) => lab.station)).toEqual(allStations().map((ref) => ref.station.slug));
  });

  for (const ref of allStations()) {
    const lab = getLab(ref.station.slug);

    describe(`lab ${ref.station.code}`, () => {
      it('exists', () => {
        expect(lab).toBeDefined();
      });
      if (lab === undefined) return;

      it('practises every concept of its station', () => {
        const practised = new Set(lab.steps.flatMap((step) => step.concepts));
        const all = ref.station.concepts.map((_, index) => index + 1);
        expect(all.filter((number) => !practised.has(number))).toEqual([]);
        expect([...practised].filter((number) => !all.includes(number))).toEqual([]);
      });

      it('ends with a cleanup and a way to prove nothing is left', () => {
        expect(lab.cleanup.length).toBeGreaterThan(0);
        expect(lab.cleanup.every((step) => step.concepts.length === 0)).toBe(true);
        expect(lab.verify).toMatch(/left/);
      });

      it('gives each step a way to do it or a question to answer', () => {
        for (const step of lab.steps) {
          const doable = step.console ?? step.shell ?? step.sql;
          expect(doable !== undefined || step.check !== undefined).toBe(true);
        }
      });

      it('gives every step that uses Cloud Shell or SQL a console path too', () => {
        const plan = labPlan(lab);
        const missing = [...plan.steps, ...plan.cleanup]
          .filter((step) => (step.shell ?? step.sql) !== undefined && step.console === undefined)
          .map((step) => step.title);
        expect(missing).toEqual([]);
      });

      it('says where in the console to see the result of every step', () => {
        const plan = labPlan(lab);
        const missing = [...plan.steps, ...plan.cleanup]
          .filter((step) => step.console !== undefined && step.see === undefined)
          .map((step) => step.title);
        expect(missing).toEqual([]);
      });

      it('gives every cleanup step a console path', () => {
        expect(lab.cleanup.filter((step) => step.console === undefined)).toEqual([]);
      });

      it('proves the cleanup in the console as well as in Cloud Shell', () => {
        expect(lab.verifyConsole).toMatch(/^1\. /);
        expect(() => parseMarkdown(lab.verifyConsole)).not.toThrow();
        expect(lab.verifyConsole).not.toContain('`');
      });

      it('names every resource with its lab prefix', () => {
        const prefix = `lab${ref.station.code.replace('.', '')}`;
        const marked = lab.creates.filter((item) => item.includes(prefix));
        expect(marked.length).toBeGreaterThan(0);
        expect(lab.verify).toContain(prefix);
      });

      it('sets every shell variable before it reads it', () => {
        const setup = setupStep(lab).shell ?? '';
        const code = [...lab.steps, ...lab.cleanup].map((step) => step.shell ?? '').join('\n');
        const known = new Set([...setVars(setup), ...setVars(code), 'HOME']);
        const unknown = readVars(`${code}\n${lab.verify}`).filter((name) => !known.has(name));
        expect([...new Set(unknown)]).toEqual([]);
      });

      it('has sample files with safe, unique names', () => {
        const names = lab.files.map((file) => file.name);
        expect(new Set(names).size).toBe(names.length);
        for (const file of lab.files) {
          expect(file.name).toMatch(/^[A-Za-z0-9._-]+$/);
          expect(file.content.split('\n')).not.toContain('EOF');
        }
      });

      it('writes its prose in the course dialect', () => {
        for (const text of [...prose(lab), lab.cost]) {
          expect(() => parseMarkdown(text)).not.toThrow();
          expect(text).not.toContain('`');
        }
      });
    });
  }
});

describe('lab rules', () => {
  it('values a lab at LAB_XP and refuses unknown ids', () => {
    expect(gcpXpForItem(labId('security-compliance'))).toBe(LAB_XP);
    expect(isKnownGcpItem('lab:no-such-station')).toBe(false);
    expect(isKnownGcpItem('lab:security-compliance:extra')).toBe(false);
  });

  it('counts labs done on the course and on a line', () => {
    const done = { [labId('security-compliance')]: '2026-11-07' };
    expect(labProgress(done)).toEqual({ done: 1, total: LABS.length });
    expect(labProgress(done, 'design')).toEqual({ done: 1, total: 4 });
    expect(labProgress(done, 'ingest')).toEqual({ done: 0, total: 3 });
  });

  it('starts each plan with the setup, then the data, then the lab steps', () => {
    const lab = getLab('security-compliance');
    if (lab === undefined) throw new Error('missing lab');
    const plan = labPlan(lab);
    expect(plan.steps[0]?.shell).toContain('gcloud services enable bigquery.googleapis.com');
    expect(plan.steps[0]?.shell).toContain('export SA=lab11-analyst@$PROJECT_ID');
    expect(plan.steps[1]?.title).toBe('Create the sample data');
    expect(plan.steps).toHaveLength(lab.steps.length + 2);
    expect(tickIds(plan).cleanup).toEqual(['cleanup-1', 'cleanup-2']);
  });

  it('skips the data step for a lab that makes its data in SQL', () => {
    const lab = getLab('data-warehouse');
    if (lab === undefined) throw new Error('missing lab');
    expect(dataStep(lab)).toBeUndefined();
  });

  it('writes a file with a quoted heredoc, so the shell expands nothing', () => {
    expect(fileCommand({ name: 'a.csv', about: '', content: 'x,$HOME' })).toBe(
      "cat > a.csv <<'EOF'\nx,$HOME\nEOF",
    );
  });
});
