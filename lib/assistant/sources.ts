/**
 * Web sources for the AI doubt assistant. Pure, so the server stream, the
 * browser panel and the tests share one definition.
 *
 * When the learner turns on web search, OpenRouter runs a search before the
 * model answers and reports the pages it used as `url_citation` annotations.
 * The answer still streams to the browser as plain text. After the last
 * piece of text, the server adds one trailer: `SOURCES_MARKER` and then a
 * JSON array of `WebSource`. The panel splits the trailer off with
 * `splitSources` and shows the list under the answer.
 */

/** ASCII "record separator". A model never writes it, so it cannot appear in an answer. */
export const SOURCES_MARKER = '\u001e';

/** The most sources the panel lists under one answer. */
export const MAX_SOURCES = 8;

export interface WebSource {
  url: string;
  title: string;
}

/** Only plain web links. A `javascript:` or `data:` URL never becomes a link. */
export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** The host without `www.`, which reads better than a full URL in a short list. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** The `url_citation` annotations in one parsed stream chunk or message. */
export function sourcesFromAnnotations(annotations: unknown): WebSource[] {
  if (!Array.isArray(annotations)) return [];
  const sources: WebSource[] = [];
  for (const annotation of annotations) {
    if (typeof annotation !== 'object' || annotation === null) continue;
    if (!('url_citation' in annotation)) continue;
    const citation: unknown = annotation.url_citation;
    if (typeof citation !== 'object' || citation === null || !('url' in citation)) continue;
    const url = citation.url;
    if (typeof url !== 'string' || !isWebUrl(url)) continue;
    const title =
      'title' in citation && typeof citation.title === 'string' && citation.title.trim() !== ''
        ? citation.title.trim().slice(0, 200)
        : hostOf(url);
    sources.push({ url, title });
  }
  return sources;
}

/** Adds sources to a list, once per URL, up to `MAX_SOURCES`. */
export function mergeSources(into: WebSource[], more: readonly WebSource[]): void {
  for (const source of more) {
    if (into.length >= MAX_SOURCES) return;
    if (!into.some((known) => known.url === source.url)) into.push(source);
  }
}

/** The trailer the server adds after the answer. Empty when there are no sources. */
export function sourcesTrailer(sources: readonly WebSource[]): string {
  return sources.length === 0 ? '' : SOURCES_MARKER + JSON.stringify(sources);
}

/**
 * Splits what the browser has read so far into the answer text and its
 * sources. While the trailer is still arriving, the text is complete and the
 * sources are empty, so the panel never shows half a JSON array.
 */
export function splitSources(raw: string): { text: string; sources: WebSource[] } {
  const at = raw.indexOf(SOURCES_MARKER);
  if (at === -1) return { text: raw, sources: [] };
  const text = raw.slice(0, at);
  try {
    const parsed: unknown = JSON.parse(raw.slice(at + SOURCES_MARKER.length));
    if (!Array.isArray(parsed)) return { text, sources: [] };
    const sources = parsed.filter(
      (item): item is WebSource =>
        typeof item === 'object' &&
        item !== null &&
        'url' in item &&
        typeof item.url === 'string' &&
        isWebUrl(item.url) &&
        'title' in item &&
        typeof item.title === 'string',
    );
    return { text, sources: sources.slice(0, MAX_SOURCES) };
  } catch {
    return { text, sources: [] };
  }
}
