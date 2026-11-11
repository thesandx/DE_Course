// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  hostOf,
  MAX_SOURCES,
  mergeSources,
  SOURCES_MARKER,
  sourcesFromAnnotations,
  sourcesTrailer,
  splitSources,
  type WebSource,
} from '@/lib/assistant/sources';

const DBT: WebSource = {
  url: 'https://docs.getdbt.com/docs/build/incremental-models',
  title: 'dbt',
};

describe('sourcesFromAnnotations', () => {
  it('reads url citations and drops everything else', () => {
    const sources = sourcesFromAnnotations([
      { type: 'url_citation', url_citation: { url: DBT.url, title: 'Incremental models' } },
      { type: 'url_citation', url_citation: { url: 'https://www.kafka.apache.org/', title: ' ' } },
      { type: 'url_citation', url_citation: { url: 'javascript:alert(1)', title: 'x' } },
      { type: 'file_citation' },
      null,
    ]);
    expect(sources).toEqual([
      { url: DBT.url, title: 'Incremental models' },
      { url: 'https://www.kafka.apache.org/', title: 'kafka.apache.org' },
    ]);
    expect(sourcesFromAnnotations('nope')).toEqual([]);
  });
});

describe('mergeSources', () => {
  it('keeps one entry per URL, up to the cap', () => {
    const into: WebSource[] = [];
    mergeSources(into, [DBT, DBT]);
    expect(into).toHaveLength(1);
    mergeSources(
      into,
      Array.from({ length: 20 }, (_, index) => ({ url: `https://a.dev/${index}`, title: 'a' })),
    );
    expect(into).toHaveLength(MAX_SOURCES);
  });
});

describe('the sources trailer', () => {
  it('round-trips through splitSources', () => {
    const raw = `Use **merge**.${sourcesTrailer([DBT])}`;
    expect(splitSources(raw)).toEqual({ text: 'Use **merge**.', sources: [DBT] });
  });

  it('is empty without sources, and a half-read trailer shows no sources yet', () => {
    expect(sourcesTrailer([])).toBe('');
    expect(splitSources('Plain answer')).toEqual({ text: 'Plain answer', sources: [] });
    expect(splitSources(`Answer${SOURCES_MARKER}[{"url":"https://a`)).toEqual({
      text: 'Answer',
      sources: [],
    });
  });

  it('drops a source that is not a web link', () => {
    const raw = `A${SOURCES_MARKER}${JSON.stringify([{ url: 'data:text/html,hi', title: 'x' }, DBT])}`;
    expect(splitSources(raw).sources).toEqual([DBT]);
  });
});

describe('hostOf', () => {
  it('shows the host without www', () => {
    expect(hostOf('https://www.snowflake.com/en/')).toBe('snowflake.com');
    expect(hostOf('not a url')).toBe('not a url');
  });
});
