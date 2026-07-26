/**
 * Shared entity ID generator for all CNTKNW domain records.
 *
 * Wraps crypto.randomUUID() so the generation strategy can be
 * changed (e.g. to UUIDv7 or ULID) in one place without touching
 * every call site.
 */
export function createEntityId(): string {
  return crypto.randomUUID();
}
