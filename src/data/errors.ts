/**
 * Typed storage and domain errors.
 *
 * Handoff §22: every durable command returns a typed result or
 * throws a typed domain error. `console.error` is never the only
 * failure handling, and a caller must be able to distinguish
 * "storage is full" from "somebody else edited this" without
 * parsing a message string.
 */

export type StorageErrorKind =
  | 'unavailable'
  | 'quota-exceeded'
  | 'not-found'
  | 'already-exists'
  | 'malformed-record'
  | 'revision-conflict'
  | 'transaction-failed'
  | 'legacy-read-failed';

export abstract class CntknwStorageError extends Error {
  abstract readonly kind: StorageErrorKind;
  /** Safe to show a user, unlike `message`. */
  abstract readonly userMessage: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The storage backend could not be opened or reached. */
export class StorageUnavailableError extends CntknwStorageError {
  readonly kind = 'unavailable' as const;
  readonly userMessage =
    'Your library could not be opened. Your work has not been lost — try reopening CNTKNW.';
}

/** The browser refused a write for lack of space. */
export class QuotaExceededError extends CntknwStorageError {
  readonly kind = 'quota-exceeded' as const;
  readonly userMessage =
    'There is not enough space to save this. Free some space, then try again.';
}

/** A record was expected and is absent. */
export class RecordNotFoundError extends CntknwStorageError {
  readonly kind = 'not-found' as const;
  readonly userMessage = 'That item could not be found.';

  constructor(
    readonly entity: string,
    readonly id: string,
  ) {
    super(`${entity} ${id} not found`);
  }
}

/**
 * A create was rejected because the record is already stored.
 *
 * Repositories that separate `create` from `update` throw this
 * rather than quietly turning the create into an update: an insert
 * that silently becomes an overwrite is last-write-wins wearing a
 * different name (ADR-0003).
 */
export class RecordAlreadyExistsError extends CntknwStorageError {
  readonly kind = 'already-exists' as const;
  readonly userMessage = 'That item already exists.';

  constructor(
    readonly entity: string,
    readonly id: string,
  ) {
    super(`${entity} ${id} already exists`);
  }
}

/**
 * A stored record failed validation on the way out of storage.
 *
 * Reading is validated as well as writing: IndexedDB returns
 * whatever was written, including records from an older version, a
 * partial migration, or a bug. Trusting them because they came from
 * our own database is how corruption spreads quietly.
 */
export class MalformedRecordError extends CntknwStorageError {
  readonly kind = 'malformed-record' as const;
  readonly userMessage =
    'A stored item could not be read. It may have been written by an older version.';

  constructor(
    readonly store: string,
    readonly id: string | undefined,
    readonly issues: string[],
    options?: { cause?: unknown },
  ) {
    super(
      `Malformed record in "${store}"${id ? ` (id ${id})` : ''}: ${issues.join('; ')}`,
      options,
    );
  }
}

/**
 * A write was rejected because the stored revision had moved on.
 *
 * Never silently overwrite a newer revision (handoff §13.3). The
 * caller gets both revisions so it can offer a real choice rather
 * than guessing.
 */
export class RevisionConflictError extends CntknwStorageError {
  readonly kind = 'revision-conflict' as const;
  readonly userMessage =
    'This was changed somewhere else while you were editing. Your version has not been saved over it.';

  constructor(
    readonly entity: string,
    readonly id: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `${entity} ${id}: expected revision ${expectedRevision}, found ${actualRevision}`,
    );
  }
}

/** A transaction was rolled back. Its cause carries the original failure. */
export class TransactionFailedError extends CntknwStorageError {
  readonly kind = 'transaction-failed' as const;
  readonly userMessage =
    'That change could not be completed and has been undone. Nothing was partly saved.';
}

/** The legacy v1 database could not be read. Never a write failure. */
export class LegacyReadError extends CntknwStorageError {
  readonly kind = 'legacy-read-failed' as const;
  readonly userMessage =
    'Your older library could not be read. Its data has not been altered.';
}

export function isStorageError(value: unknown): value is CntknwStorageError {
  return value instanceof CntknwStorageError;
}

/**
 * Classify a raw exception from IndexedDB or Dexie.
 *
 * Quota and unavailability arrive as `DOMException`s with names
 * rather than types, so they need mapping at the boundary before a
 * caller can act on them.
 */
export function classifyStorageFailure(
  error: unknown,
  context: string,
): CntknwStorageError {
  if (isStorageError(error)) return error;

  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : '';

  switch (name) {
    case 'QuotaExceededError':
    case 'NS_ERROR_DOM_QUOTA_REACHED':
      return new QuotaExceededError(`${context}: storage quota exceeded`, {
        cause: error,
      });
    case 'InvalidStateError':
    case 'UnknownError':
    case 'VersionError':
      return new StorageUnavailableError(`${context}: ${name}`, { cause: error });
    default:
      return new TransactionFailedError(`${context}: ${String(error)}`, {
        cause: error,
      });
  }
}
