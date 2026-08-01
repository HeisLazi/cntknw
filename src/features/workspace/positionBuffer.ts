/**
 * A crash buffer for the reading position.
 *
 * The same reasoning as the journal's draft buffer, applied to the
 * other thing a reader would hate to lose. Splitting `drift` from
 * `commit` (ADR-0005) made a page turn write *promptly* rather than
 * after a debounce — but "promptly" is still an asynchronous
 * IndexedDB write, and a reload in the same tick can still outrun it.
 * Measured: reloading 0ms after a page turn still lost it.
 *
 * So the position is also stashed synchronously, and replayed on the
 * next load. As with the journal, this is **not** a second source of
 * truth: it is emptied the instant the durable write lands, and its
 * normal state is empty.
 */
import { readJson, remove, writeJson } from '@lib/safeStore';

const KEY = 'cntknw:reading-position:v1';

export interface BufferedPosition {
  sourceId: string;
  page: number;
  zoom: number;
  savedAt: number;
}

/** Older than this and the position is not worth restoring. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function isBuffered(value: unknown): value is BufferedPosition {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BufferedPosition>;
  return (
    typeof candidate.sourceId === 'string' &&
    typeof candidate.page === 'number' &&
    typeof candidate.zoom === 'number' &&
    typeof candidate.savedAt === 'number'
  );
}

/** Record a position that may not have reached IndexedDB. Synchronous. */
export function stashPosition(sourceId: string, page: number, zoom: number): void {
  writeJson(KEY, { sourceId, page, zoom, savedAt: Date.now() });
}

/** Forget it, because the durable write succeeded. */
export function clearPosition(): void {
  remove(KEY);
}

/**
 * A position that survived a crash, for this source.
 *
 * Scoped to the source deliberately: a buffered position for a
 * different book is not merely useless, it would drop the reader into
 * the wrong page of the right book.
 */
export function recoverPosition(sourceId: string): BufferedPosition | null {
  const buffered = readJson(KEY, isBuffered);
  if (!buffered) return null;
  if (buffered.sourceId !== sourceId) return null;
  if (Date.now() - buffered.savedAt > MAX_AGE_MS) {
    clearPosition();
    return null;
  }
  return buffered;
}
