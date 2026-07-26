/**
 * Optimistic concurrency control.
 *
 * Handoff §13.3: never silently overwrite a newer revision.
 *
 * The guard is MANDATORY on every mutating call that touches a
 * revisioned record. ADR-0002 §4 made it optional and let omission
 * mean last-write-wins; ADR-0003 supersedes that. An opt-in
 * guarantee is not a guarantee — a forgotten argument at any one of
 * dozens of call sites silently reopened the exact overwrite path
 * handoff §13.3 forbids, and nothing in the type system or the test
 * suite would have said so.
 *
 * There is no way to express "I do not care" by omission. A caller
 * that genuinely must write regardless has to say so out loud, and
 * name a reason drawn from a closed set:
 *
 *   expectedRevision(n)          — ordinary application code
 *   unconditionally('migration') — migration tooling only
 *   unconditionally('repair')    — recovery tooling only
 *
 * See ADR-0003.
 */
import type { Revision } from '@domain/index';
import { RevisionConflictError } from '../errors';

/**
 * Why a write is permitted to land.
 *
 * `expected` carries the revision the caller believes is current and
 * is what application code uses. `unconditional` skips the check and
 * is confined to migration and repair paths, which legitimately
 * rewrite records they did not read.
 */
export type ConcurrencyGuard =
  | { mode: 'expected'; revision: Revision }
  | { mode: 'unconditional'; reason: 'migration' | 'repair' };

/** Ordinary application guard: the revision the caller read. */
export function expectedRevision(revision: Revision): ConcurrencyGuard {
  return { mode: 'expected', revision };
}

/**
 * Deliberate override. Migration and repair rewrite records they
 * never read, so there is no revision they could honestly claim.
 * Every other caller uses {@link expectedRevision}.
 */
export function unconditionally(
  reason: 'migration' | 'repair',
): ConcurrencyGuard {
  return { mode: 'unconditional', reason };
}

/**
 * Reject a guard that is absent or malformed.
 *
 * TypeScript already makes the parameter required, but the type
 * system is not the guarantee — it is erased at runtime, and the
 * contract has to hold for a JavaScript caller, a bad cast, or a
 * value that arrived through `JSON.parse`. Treating a missing guard
 * as "proceed" is precisely the behaviour ADR-0003 removes, so it
 * fails loudly instead.
 */
function assertWellFormed(
  entity: string,
  id: string,
  guard: ConcurrencyGuard,
): void {
  if (guard === null || typeof guard !== 'object' || !('mode' in guard)) {
    throw new TypeError(
      `${entity} ${id}: a ConcurrencyGuard is required. Omission must never ` +
        `mean last-write-wins — pass expectedRevision(n), or ` +
        `unconditionally('migration' | 'repair') if the override is intended.`,
    );
  }
}

/**
 * Throw if the stored revision has moved on.
 *
 * Nothing is written when this throws: every caller runs it before
 * the `put`, so the stored record is left exactly as it was.
 *
 * @throws RevisionConflictError when the guard expects a revision
 *   that is no longer current.
 * @throws TypeError when no well-formed guard was supplied.
 */
export function assertRevision(
  entity: string,
  id: string,
  actualRevision: Revision,
  guard: ConcurrencyGuard,
): void {
  assertWellFormed(entity, id, guard);
  if (guard.mode === 'unconditional') return;
  if (guard.revision !== actualRevision) {
    throw new RevisionConflictError(entity, id, guard.revision, actualRevision);
  }
}
