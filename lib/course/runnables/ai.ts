import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the coding problems of the AI for data engineers track.
 * Each runs on Python 3.14 in the browser.
 */
export const AI_RUNNABLES: Record<string, RunnableSpec> = {
  'ai-incremental-chunking': {
    language: 'python',
    task: `Write «chunk_document(doc_id, text, model_version, max_words=200, overlap=40)», which returns or yields «Chunk» objects, and «plan_upserts(doc_id, text, model_version, stored)». Split the words of «text» into windows of at most «max_words» words. Each window starts «max_words - overlap» words after the one before. The last window must not be only overlap: no window starts at or after «len(words) - overlap», except the first window of a short text. An empty text gives no chunks. Raise «ValueError» unless «0 <= overlap < max_words». «chunk_id» is «"{doc_id}:{position}"», counted from 0. «content_hash» is a hex digest, such as SHA-256, of the model version and the text, so it changes when either one changes. «plan_upserts» gets «stored», a dict of «chunk_id -> content_hash» already in the index, and uses the default window sizes. It returns «(to_embed, to_delete)»: the chunks that are new or whose hash changed, and the ids in «stored» that the text no longer has.`,
    setup: `from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    doc_id: str
    position: int
    text: str
    content_hash: str


text = ("Riders can cancel a trip for free within two minutes of booking. "
        "After that a fee applies unless the driver is more than ten minutes late.")
long_text = " ".join("w%d" % n for n in range(700))`,
    helpers: `def chunk_view(chunks):
    return [(chunk.chunk_id, chunk.position, chunk.text) for chunk in chunks]


def plan_view(plan):
    to_embed, to_delete = plan
    return [sorted(chunk.chunk_id for chunk in to_embed), sorted(to_delete)]


def stored_from(fn, doc_id, text, model_version):
    return {chunk.chunk_id: chunk.content_hash for chunk in fn(doc_id, text, model_version)}


def check_hashes(fn):
    first = list(fn("doc-1", text, "emb-v1", max_words=8, overlap=3))
    again = list(fn("doc-1", text, "emb-v1", max_words=8, overlap=3))
    if [chunk.content_hash for chunk in first] != [chunk.content_hash for chunk in again]:
        return verdict(False, "The same text and model must give the same hash every time, or every rerun embeds everything again.")
    for chunk in first:
        if not isinstance(chunk.content_hash, str) or len(chunk.content_hash) < 32:
            return verdict(False, "Use a hex digest from hashlib, such as sha256(...).hexdigest(). %r is too short to trust, and Python's hash() changes from one process to the next." % (chunk.content_hash,))
    newer = list(fn("doc-1", text, "emb-v2", max_words=8, overlap=3))
    kept = [old.chunk_id for old, new in zip(first, newer) if old.content_hash == new.content_hash]
    if kept:
        return verdict(False, "A new model version must change every hash, so every chunk is embedded again with the new model. These kept their hash: %s." % ", ".join(kept))
    edited = list(fn("doc-1", text.replace("free", "nothing"), "emb-v1", max_words=8, overlap=3))
    for old, new in zip(first, edited):
        if (old.text != new.text) != (old.content_hash != new.content_hash):
            return verdict(False, "Chunk %s: its hash must change when its text changes, and only then." % old.chunk_id)
    return verdict(True)


def check_bad_overlap(fn):
    for max_words, overlap in ((5, 5), (5, 7), (5, -1)):
        try:
            list(fn("doc-x", "a b c d e f g h", "emb-v1", max_words=max_words, overlap=overlap))
        except ValueError:
            continue
        except Exception as error:
            return verdict(False, "overlap=%d with max_words=%d should raise ValueError, not %s." % (overlap, max_words, type(error).__name__))
        return verdict(False, "overlap=%d with max_words=%d must raise ValueError: those windows would never move forward or would skip words." % (overlap, max_words))
    return verdict(True)`,
    starter: `import hashlib


def chunk_document(doc_id, text, model_version, max_words=200, overlap=40):
    # Yield Chunk(chunk_id, doc_id, position, text, content_hash) for each window.
    ...


def plan_upserts(doc_id, text, model_version, stored):
    # Return (chunks to embed, chunk ids to delete).
    ...


for chunk in chunk_document("doc-1", text, "emb-v1", max_words=8, overlap=3) or []:
    print(chunk.position, chunk.text)
`,
    solution: `import hashlib


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
        yield Chunk(
            chunk_id=f"{doc_id}:{position}",
            doc_id=doc_id,
            position=position,
            text=piece,
            content_hash=digest,
        )
        position += 1


def plan_upserts(doc_id, text, model_version, stored):
    chunks = list(chunk_document(doc_id, text, model_version))
    to_embed = [chunk for chunk in chunks if stored.get(chunk.chunk_id) != chunk.content_hash]
    current = {chunk.chunk_id for chunk in chunks}
    to_delete = sorted(set(stored) - current)
    return to_embed, to_delete
`,
    cases: [
      {
        name: 'Sample',
        note: '26 words in windows of 8 that start 5 words apart. The last window starts at word 20.',
        check: 'chunk_view(chunk_document("doc-1", text, "emb-v1", max_words=8, overlap=3))',
      },
      {
        name: 'A document of exactly max_words is one chunk',
        note: 'A second window would hold only the 40 words of overlap.',
        setup: 'text = " ".join("t%d" % n for n in range(200))',
        check: 'chunk_view(chunk_document("doc-2", text, "emb-v1"))',
      },
      {
        name: 'A rerun embeds nothing',
        check:
          'plan_view(plan_upserts("doc-9", long_text, "emb-v1", stored_from(chunk_document, "doc-9", long_text, "emb-v1")))',
      },
      {
        name: 'An empty text has no chunks',
        hidden: true,
        check: 'chunk_view(chunk_document("doc-3", "", "emb-v1"))',
      },
      {
        name: 'A text shorter than the overlap',
        hidden: true,
        setup: 'text = "Refunds take five to seven working days."',
        check: 'chunk_view(chunk_document("doc-4", text, "emb-v1"))',
      },
      {
        name: 'Hashes follow the text and the model',
        hidden: true,
        check: 'check_hashes(chunk_document)',
      },
      {
        name: 'Overlap must be smaller than max_words',
        hidden: true,
        check: 'check_bad_overlap(chunk_document)',
      },
      {
        name: 'A new model embeds every chunk',
        hidden: true,
        check:
          'plan_view(plan_upserts("doc-9", long_text, "emb-v2", stored_from(chunk_document, "doc-9", long_text, "emb-v1")))',
      },
      {
        name: 'A shorter document deletes the old tail',
        hidden: true,
        note: 'The first 400 words make 3 windows. The third one changed, and the old fourth and fifth are gone.',
        setup: 'shorter = " ".join(long_text.split()[:400])',
        check:
          'plan_view(plan_upserts("doc-9", shorter, "emb-v1", stored_from(chunk_document, "doc-9", long_text, "emb-v1")))',
      },
      {
        name: 'An edit embeds only the windows that hold it',
        hidden: true,
        note: 'Word 330 is in the windows that start at 160 and at 320.',
        setup: 'edited = long_text.replace("w330 ", "changed ")',
        check:
          'plan_view(plan_upserts("doc-9", edited, "emb-v1", stored_from(chunk_document, "doc-9", long_text, "emb-v1")))',
      },
    ],
  },
};
