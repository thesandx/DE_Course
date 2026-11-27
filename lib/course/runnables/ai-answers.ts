import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/**
 * Other correct answers and the usual mistakes for the AI track's coding
 * problems, for `python-specs.test.ts`.
 */

/** The reference chunker with one line changed, for the mistakes below. */
const CHUNKER = `import hashlib


def chunk_document(doc_id, text, model_version, max_words=200, overlap=40):
    if not 0 <= overlap < max_words:
        raise ValueError("overlap must be >= 0 and < max_words")
    words = text.split()
    step = max_words - overlap
    position = 0
    for start in range(0, max(len(words) - overlap, 1), step):
        piece = " ".join(words[start : start + max_words])
        if not piece:
            break
        digest = hashlib.sha256(f"{model_version}\\n{piece}".encode()).hexdigest()
        yield Chunk(f"{doc_id}:{position}", doc_id, position, piece, digest)
        position += 1


def plan_upserts(doc_id, text, model_version, stored):
    chunks = list(chunk_document(doc_id, text, model_version))
    to_embed = [chunk for chunk in chunks if stored.get(chunk.chunk_id) != chunk.content_hash]
    current = {chunk.chunk_id for chunk in chunks}
    return to_embed, sorted(set(stored) - current)
`;

function changed(from: string, to: string): string {
  if (!CHUNKER.includes(from)) throw new Error(`The chunker has no "${from}".`);
  return CHUNKER.replace(from, to);
}

export const AI_ANSWERS: Record<string, SpecAnswers> = {
  'ai-incremental-chunking': {
    pass: [
      `import hashlib


def chunk_document(doc_id, text, model_version, max_words=200, overlap=40):
    if overlap < 0 or overlap >= max_words:
        raise ValueError("need 0 <= overlap < max_words")
    words = text.split()
    chunks = []
    start = 0
    while start < len(words) and (start == 0 or start < len(words) - overlap):
        piece = " ".join(words[start:start + max_words])
        digest = hashlib.blake2b((model_version + "|" + piece).encode(), digest_size=20).hexdigest()
        position = len(chunks)
        chunks.append(Chunk(f"{doc_id}:{position}", doc_id, position, piece, digest))
        start += max_words - overlap
    return chunks


def plan_upserts(doc_id, text, model_version, stored):
    chunks = chunk_document(doc_id, text, model_version)
    ids = {chunk.chunk_id for chunk in chunks}
    return ([chunk for chunk in chunks if stored.get(chunk.chunk_id) != chunk.content_hash],
            [chunk_id for chunk_id in stored if chunk_id not in ids])
`,
      changed(
        'hashlib.sha256(f"{model_version}\\n{piece}".encode()).hexdigest()',
        'hashlib.md5(repr((model_version, piece)).encode()).hexdigest()',
      ),
    ],
    fail: [
      // The last window can be only overlap.
      changed('range(0, max(len(words) - overlap, 1), step)', 'range(0, len(words), step)'),
      // The model version is not in the hash.
      changed('f"{model_version}\\n{piece}"', 'piece'),
      // Python's hash() changes between processes.
      changed(
        'hashlib.sha256(f"{model_version}\\n{piece}".encode()).hexdigest()',
        'str(hash((model_version, piece)))',
      ),
      // Never deletes.
      changed('return to_embed, sorted(set(stored) - current)', 'return to_embed, []'),
      // No check on the window sizes.
      changed(
        `    if not 0 <= overlap < max_words:
        raise ValueError("overlap must be >= 0 and < max_words")
`,
        '',
      ),
      // Embeds every chunk on every run.
      changed(
        'to_embed = [chunk for chunk in chunks if stored.get(chunk.chunk_id) != chunk.content_hash]',
        'to_embed = chunks',
      ),
    ],
  },
};
