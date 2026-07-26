/**
 * The composition root.
 *
 * This is the ONLY module in the application that names a concrete
 * storage adapter. Everything above it — providers, routes,
 * components, hooks — depends on the `Repositories` interface and
 * cannot reach IndexedDB, Dexie, or a table name even by accident.
 *
 * That is what makes INV-014 ("UI components do not directly write
 * arbitrary database records") a structural property rather than a
 * rule someone has to remember. `architecture.test.ts` fails if a
 * second module imports an adapter.
 *
 * Tests do not use this file. They construct the memory adapter and
 * pass it to `RepositoryProvider` directly, which is why the provider
 * takes its repositories as a prop rather than reaching for a global.
 */
import { createIndexedDbRepositories } from '@data/adapters/indexeddb';
import { getDatabase, openDatabase } from '@data/db/database';
import type { Repositories } from '@data/repositories';

/**
 * Build the production object graph and open the database.
 *
 * Opening explicitly, here, means a storage failure surfaces as a
 * typed error at a known point during start-up rather than as an
 * unhandled rejection from whichever component happened to read
 * first.
 */
export async function createProductionRepositories(): Promise<Repositories> {
  const db = await openDatabase(getDatabase());
  return createIndexedDbRepositories(db);
}
