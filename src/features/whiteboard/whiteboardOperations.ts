import type { EntityId, WhiteboardPosition } from '@domain/index';

export interface CanonicalDeleteDependencies {
  deleteBlock: (blockId: EntityId) => Promise<void>;
  commitLayout: (layout: Record<EntityId, WhiteboardPosition>) => void;
}

/**
 * The block is soft-deleted first. Only after that guarded operation succeeds
 * may its presentation entry disappear, so no UI path silently deletes only
 * the projection while leaving the canonical object behind.
 */
export async function deleteCanonicalBoardObject(
  dependencies: CanonicalDeleteDependencies,
  blockId: EntityId,
  layout: Record<EntityId, WhiteboardPosition>,
): Promise<Record<EntityId, WhiteboardPosition>> {
  await dependencies.deleteBlock(blockId);
  const next = { ...layout };
  delete next[blockId];
  dependencies.commitLayout(next);
  return next;
}

export function withoutLayoutEntry(
  layout: Record<EntityId, WhiteboardPosition>,
  blockId: EntityId,
): Record<EntityId, WhiteboardPosition> {
  const next = { ...layout };
  delete next[blockId];
  return next;
}
