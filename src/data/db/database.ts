/**
 * CNTKNW v2 Dexie database.
 *
 * The schema is derived from `schemaVersions.ts` rather than
 * declared here, so the documentation cannot drift from the code.
 *
 * This module opens a database. It never migrates v1 data — there
 * is no apply path in this phase, so importing it cannot trigger a
 * destructive migration (ADR-0002 §7).
 */
import Dexie, { type Table } from 'dexie';
import {
  V2_DATABASE_NAME,
  SCHEMA_VERSIONS,
  CURRENT_SCHEMA_VERSION,
  STORES,
  dexieStores,
  META_KEYS,
} from './schemaVersions';
import type {
  StoredSource,
  StoredBookDetails,
  StoredArtworkDetails,
  StoredAsset,
  StoredAssetBinary,
  StoredSourceAsset,
  StoredJournal,
  StoredJournalBlock,
  StoredAnnotation,
  StoredConnection,
  StoredConcept,
  StoredGlossaryEntry,
  StoredEpistemicClaim,
  StoredStudySession,
  StoredWorkspaceState,
  StoredMeta,
} from './storageRecords';
import { classifyStorageFailure } from '../errors';

export class CntknwDatabase extends Dexie {
  declare sources: Table<StoredSource, string>;
  declare bookDetails: Table<StoredBookDetails, string>;
  declare artworkDetails: Table<StoredArtworkDetails, string>;
  declare assets: Table<StoredAsset, string>;
  declare assetBinaries: Table<StoredAssetBinary, string>;
  declare sourceAssets: Table<StoredSourceAsset, [string, string]>;
  declare journals: Table<StoredJournal, string>;
  declare journalBlocks: Table<StoredJournalBlock, string>;
  declare annotations: Table<StoredAnnotation, string>;
  declare connections: Table<StoredConnection, string>;
  declare concepts: Table<StoredConcept, string>;
  declare glossaryEntries: Table<StoredGlossaryEntry, string>;
  declare epistemicClaims: Table<StoredEpistemicClaim, string>;
  declare studySessions: Table<StoredStudySession, string>;
  declare workspaceStates: Table<StoredWorkspaceState, string>;
  declare meta: Table<StoredMeta, string>;

  constructor(name: string = V2_DATABASE_NAME) {
    super(name);

    // Every declared version is applied in order, so a database
    // created today and one upgraded from an older version end up
    // structurally identical.
    for (const declared of SCHEMA_VERSIONS) {
      this.version(declared.version).stores(dexieStores(declared.version));
    }

    this.on('populate', () => {
      // Runs once, inside the creating transaction.
      void this.meta.bulkPut([
        { key: META_KEYS.schemaVersion, value: CURRENT_SCHEMA_VERSION },
        { key: META_KEYS.createdAt, value: new Date().toISOString() },
        { key: META_KEYS.v1MigrationStatus, value: 'not-started' },
      ]);
    });
  }
}

let instance: CntknwDatabase | null = null;

/** The shared database. Opened lazily. */
export function getDatabase(): CntknwDatabase {
  if (!instance) instance = new CntknwDatabase();
  return instance;
}

/** Open explicitly, so failure surfaces as a typed error at a known point. */
export async function openDatabase(
  db: CntknwDatabase = getDatabase(),
): Promise<CntknwDatabase> {
  try {
    if (!db.isOpen()) await db.open();
    return db;
  } catch (error) {
    throw classifyStorageFailure(error, 'Opening the CNTKNW database');
  }
}

/**
 * A separate database instance, for tests that need isolation.
 * Never used by application code.
 */
export function createTestDatabase(name: string): CntknwDatabase {
  return new CntknwDatabase(name);
}

/** Reset the shared instance. Tests only. */
export function resetDatabaseInstance(): void {
  instance = null;
}

export { STORES };
