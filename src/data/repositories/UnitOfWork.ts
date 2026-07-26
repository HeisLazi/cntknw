/**
 * Cross-repository transaction boundary.
 *
 * Several use cases write to more than one repository. importPdf
 * touches assets, sources, book details, source-asset links,
 * journals and workspace state — six writes that must either all
 * land or all roll back. Handoff §10 requires transactions to cross
 * related records through a unit-of-work boundary, and §11.1
 * requires a failure after binary storage to roll back or record a
 * recovery entry.
 *
 * The memory adapter implements this as a pass-through, so the
 * boundary is invisible until the Dexie adapter arrives. Declaring
 * it now means use cases are written against it from the start
 * rather than retrofitted. See ADR-0001 §10.
 */
export interface UnitOfWork {
  /**
   * Run `operation` inside a single transaction across every
   * repository in the unit. Throwing rolls back the whole thing.
   */
  run<T>(operation: () => Promise<T>): Promise<T>;
}
