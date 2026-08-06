import { useSyncExternalStore } from 'react';
import type { AnnotationAnchor, EntityId } from '@domain/index';

export type PendingIntentStatus = 'draft' | 'saving' | 'failed';

export interface PendingAnnotationIntent {
  sourceId: EntityId;
  assetId: EntityId;
  page: number;
  kind: 'highlight' | 'region';
  anchor: AnnotationAnchor;
  status: PendingIntentStatus;
  errorMessage?: string;
}

const intents = new Map<string, PendingAnnotationIntent>();
const listeners = new Set<() => void>();

export function pendingIntentKey(
  sourceId: EntityId,
  assetId: EntityId,
  page: number,
): string {
  return `${sourceId}:${assetId}:${page}`;
}

export function getPendingIntent(
  sourceId: EntityId,
  assetId: EntityId,
  page: number,
): PendingAnnotationIntent | null {
  return intents.get(pendingIntentKey(sourceId, assetId, page)) ?? null;
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function putPendingIntent(intent: PendingAnnotationIntent): void {
  intents.set(
    pendingIntentKey(intent.sourceId, intent.assetId, intent.page),
    { ...intent },
  );
  notifyListeners();
}

export function clearPendingIntent(
  sourceId: EntityId,
  assetId: EntityId,
  page: number,
): void {
  if (!intents.delete(pendingIntentKey(sourceId, assetId, page))) return;
  notifyListeners();
}

export function clearDraftIntentsForSource(sourceId: EntityId): void {
  let removed = false;
  for (const [key, intent] of intents) {
    if (intent.sourceId === sourceId && intent.status === 'draft') {
      intents.delete(key);
      removed = true;
    }
  }
  if (removed) notifyListeners();
}

export function subscribePendingIntents(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingIntent(
  sourceId: EntityId,
  assetId: EntityId,
  page: number,
): PendingAnnotationIntent | null {
  return useSyncExternalStore(
    subscribePendingIntents,
    () => getPendingIntent(sourceId, assetId, page),
    () => null,
  );
}
