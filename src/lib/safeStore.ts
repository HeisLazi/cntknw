/**
 * A synchronous, never-throwing key/value store.
 *
 * The **only** reason `localStorage` appears anywhere in CNTKNW: it
 * is the one storage API that is synchronous, so a write during
 * `pagehide` has either happened or not by the time the handler
 * returns. An IndexedDB write started at that moment is asynchronous
 * and the browser may discard the page first — measured, not assumed
 * (ADR-0005).
 *
 * Everything here swallows its errors. Private browsing, a storage
 * quota, a disabled API, a corrupt value written by an older build:
 * every one of them degrades to "no crash recovery", never to "the
 * application will not start". Recovery is a safety net, and a safety
 * net that can bring down the thing it protects is worse than none.
 */

export function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do and nothing to say. The durable write is still
    // on its way; this was only the belt to its braces.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above.
  }
}
