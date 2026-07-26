/**
 * Optimistic concurrency control.
 *
 * Handoff §13.3: never silently overwrite a newer revision.
 *
 * The check is OPT-IN rather than mandatory, and that is deliberate.
 * A use case that reads and writes inside one transaction has no
 * stale-read window, so requiring a revision at every call site
 * would be ceremony without safety. The paths that need it are the
 * ones where a read and its write are separated by user time — the
 * debounced autosave in Phase 2 above all — and those can pass it.
 *
 * Making it an explicit parameter rather than an options-bag field
 * means its absence is visible when reading a call site.
 *
 * See ADR-0002 §4.
 */
import { RevisionConflictError } from '../errors';

/**
 * Revision a caller believes is current. Omit to accept
 * last-write-wins.
 */
export type ExpectedRevision = number | undefined;

/**
 * Throw if the stored revision has moved on.
 *
 * @throws RevisionConflictError when they differ.
 */
export function assertRevision(
  entity: string,
  id: string,
  actualRevision: number,
  expectedRevision: ExpectedRevision,
): void {
  if (expectedRevision === undefined) return;
  if (expectedRevision !== actualRevision) {
    throw new RevisionConflictError(entity, id, expectedRevision, actualRevision);
  }
}
