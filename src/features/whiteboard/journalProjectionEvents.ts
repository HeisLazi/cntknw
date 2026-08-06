const EVENT_NAME = 'cntknw:journal-projection-changed';

export interface JournalProjectionChange {
  journalId: string;
  blockId?: string;
  source: 'journal' | 'whiteboard';
}

export function announceJournalProjectionChange(detail: JournalProjectionChange): void {
  globalThis.window?.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function listenForJournalProjectionChanges(
  journalId: string,
  listener: (change: JournalProjectionChange) => void,
): () => void {
  const handler = (event: Event) => {
    const change = (event as CustomEvent<JournalProjectionChange>).detail;
    if (change?.journalId === journalId) {
      listener(change);
    }
  };
  globalThis.window?.addEventListener(EVENT_NAME, handler);
  return () => globalThis.window?.removeEventListener(EVENT_NAME, handler);
}
