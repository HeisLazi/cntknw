/**
 * A crash-recovery buffer for in-flight journal text.
 *
 * **This is not a second source of truth, and must never become one.**
 * IndexedDB holds the journal. This holds only the handful of
 * keystrokes that have not reached IndexedDB yet, and every entry is
 * deleted the moment its durable write succeeds. If the buffer is
 * empty — the normal state — nothing here matters.
 *
 * Why it exists. Text must be debounced: a repository write per
 * keystroke would be absurd. But that leaves a window in which typed
 * words exist only in memory, and closing a tab or reloading inside
 * that window loses them. An IndexedDB write started during
 * `pagehide` is *asynchronous* and the browser may discard the page
 * before it completes — measured, not assumed: a reload immediately
 * after typing lost the sentence.
 *
 * `localStorage` is the one storage API that is **synchronous**, so a
 * write during `pagehide` has either happened or not by the time the
 * handler returns. That is the entire reason it is used here, and the
 * only reason it is acceptable to write anything outside the
 * repositories. The never-throwing access itself lives in
 * `@lib/safeStore`, shared with the reading-position buffer, so the
 * defensive handling cannot drift between the two.
 */
import { readJson, remove, writeJson } from '@lib/safeStore';

const KEY = 'cntknw:journal-drafts:v1';

export interface JournalDraft {
  blockId: string;
  doc: unknown;
  text: string;
  /** Epoch millis, for discarding anything implausibly stale. */
  savedAt: number;
}

/** Drafts older than this are discarded rather than replayed. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

const isRecord = (value: unknown): value is Record<string, JournalDraft> =>
  typeof value === 'object' && value !== null;

function readAll(): Record<string, JournalDraft> {
  return readJson(KEY, isRecord) ?? {};
}

function writeAll(drafts: Record<string, JournalDraft>): void {
  if (Object.keys(drafts).length === 0) remove(KEY);
  else writeJson(KEY, drafts);
}

/** Record an edit that has not yet reached the repository. Synchronous. */
export function stashDraft(draft: Omit<JournalDraft, 'savedAt'>): void {
  const drafts = readAll();
  drafts[draft.blockId] = { ...draft, savedAt: Date.now() };
  writeAll(drafts);
}

/** Forget an edit, because its durable write succeeded. */
export function clearDraft(blockId: string): void {
  const drafts = readAll();
  if (!(blockId in drafts)) return;
  delete drafts[blockId];
  writeAll(drafts);
}

/**
 * Every draft that survived a crash, keyed by block.
 *
 * Does **not** clear them: a draft is cleared when its content is
 * durably stored, not when it is read. Clearing on read would lose
 * the words a second time if the recovery write also failed.
 */
export function recoverDrafts(): Map<string, JournalDraft> {
  const drafts = readAll();
  const now = Date.now();
  const recovered = new Map<string, JournalDraft>();
  let pruned = false;

  for (const [blockId, draft] of Object.entries(drafts)) {
    if (
      typeof draft?.blockId !== 'string' ||
      typeof draft.text !== 'string' ||
      typeof draft.savedAt !== 'number'
    ) {
      pruned = true;
      continue;
    }
    if (now - draft.savedAt > MAX_AGE_MS) {
      pruned = true;
      continue;
    }
    recovered.set(blockId, draft);
  }

  if (pruned) {
    writeAll(Object.fromEntries([...recovered].map(([id, d]) => [id, d])));
  }
  return recovered;
}
