/**
 * CNTKNW v2 database schema — single source of truth.
 *
 * Every store, key and index is declared here, and `database.ts`
 * derives its Dexie declaration from this table. Nothing may exist
 * only inside a `.version().stores()` call: NFR-005 requires
 * deterministic migrations with recovery instructions, and a schema
 * that lives only in a Dexie call is undocumented by construction.
 *
 * See ADR-0002 §1 and §2.
 */

/**
 * The v2 database. Deliberately NOT `philosophy-journal`.
 *
 * Opening the v1 database at a higher version would irreversibly
 * upgrade it and permanently break the v1 app, which must keep
 * running as a reference until migration is verified (handoff
 * §6.1). Two databases also make it structurally impossible for v2
 * code to reach a v1 store.
 */
export const V2_DATABASE_NAME = 'cntknw';

/** The v1 database. Read-only, for migration. Never opened for writing. */
export const V1_DATABASE_NAME = 'philosophy-journal';
export const V1_DATABASE_VERSION = 1;

/** Current v2 schema version. Bump only alongside a migration entry. */
export const CURRENT_SCHEMA_VERSION = 2;

// ─── Store names ─────────────────────────────────────────────────

export const STORES = {
  sources: 'sources',
  bookDetails: 'bookDetails',
  artworkDetails: 'artworkDetails',
  assets: 'assets',
  assetBinaries: 'assetBinaries',
  sourceAssets: 'sourceAssets',
  journals: 'journals',
  journalBlocks: 'journalBlocks',
  annotations: 'annotations',
  connections: 'connections',
  concepts: 'concepts',
  glossaryEntries: 'glossaryEntries',
  epistemicClaims: 'epistemicClaims',
  studySessions: 'studySessions',
  workspaceStates: 'workspaceStates',
  meta: 'meta',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** Every store, for transactions that must span the whole database. */
export const ALL_STORES: readonly StoreName[] = Object.values(STORES);

// ─── Schema declaration ──────────────────────────────────────────

export interface StoreDefinition {
  /** Dexie index string: primary key first, then indexes. */
  readonly indexes: string;
  /** Why the store exists and what its non-obvious indexes are for. */
  readonly purpose: string;
}

export interface SchemaVersion {
  readonly version: number;
  readonly introduced: string;
  readonly stores: Readonly<Record<string, StoreDefinition>>;
  /** What changes on upgrade. Empty for the initial version. */
  readonly migration: string;
  /** How to recover if the upgrade fails. */
  readonly recovery: string;
}

/**
 * Dexie index syntax, for reference when reading the table below:
 *   `id`        primary key
 *   `field`     plain index
 *   `&field`    unique index
 *   `*field`    multi-entry index (array members indexed separately)
 *   `[a+b]`     compound index
 */
const CNTKNW_STORES: Readonly<Record<string, StoreDefinition>> = {
  [STORES.sources]: {
        indexes: 'id, type, archivedAt, updatedAt',
        purpose:
          'Books and artworks. `archivedAt` indexed so the active-source ' +
          'query is an index scan rather than a full-table filter.',
      },
      [STORES.bookDetails]: {
        indexes: 'sourceId, currentStatus',
        purpose:
          'Book metadata, keyed by source. Carries no reading position — ' +
          'that lives on workspaceStates (ADR-0001 §3).',
      },
      [STORES.artworkDetails]: {
        indexes: 'sourceId, period, movement',
        purpose: 'Artwork metadata, keyed by source.',
      },
      [STORES.assets]: {
        indexes: 'id, kind, checksum',
        purpose:
          'Binary metadata only. `checksum` indexed for future ' +
          'deduplication of re-imported files.',
      },
      [STORES.assetBinaries]: {
        indexes: 'assetId',
        purpose:
          'Blob payloads, split from metadata so listing assets never ' +
          'loads PDF bytes into memory (PDD §19.1, NFR-003).',
      },
      [STORES.sourceAssets]: {
        indexes: '[sourceId+assetId], sourceId, assetId, [sourceId+role]',
        purpose:
          'Join records. Compound primary key because the pair is the ' +
          'identity; `[sourceId+role]` serves the primary-asset lookup.',
      },
      [STORES.journals]: {
        indexes: 'id, sourceId, kind',
        purpose: 'One journal per source, plus standalone journals.',
      },
      [STORES.journalBlocks]: {
        indexes:
          'id, journalId, [journalId+rank], [journalId+pdfPage], deletedAt, epistemicClaimId',
        purpose:
          'The atomic unit. `[journalId+rank]` returns a journal in order ' +
          'without sorting in memory; `[journalId+pdfPage]` serves page ' +
          'grouping (PDD §22.3). `pdfPage` is a flattened copy of ' +
          'sourceLocation.pdf.page — IndexedDB cannot index through an ' +
          'optional nested path.',
      },
      [STORES.annotations]: {
        indexes: 'id, sourceId, assetId, [sourceId+page]',
        purpose:
          'Canonical source markup addressed by source, exact asset and ' +
          '1-based page, with ADR-0007 normalized anchor geometry.',
      },
      [STORES.connections]: {
        indexes: 'id, fromKey, toKey, relationship',
        purpose:
          'Typed links. `fromKey`/`toKey` are flattened reference keys, ' +
          'because a discriminated union cannot be indexed directly. ' +
          'Backlinks are queried from here, never stored (INV-007).',
      },
      [STORES.concepts]: {
        indexes: 'id, title, *aliases',
        purpose:
          'Multi-entry index on aliases so a lookup by any alias is a ' +
          'single index hit.',
      },
      [STORES.glossaryEntries]: {
        indexes: 'id, [term+language], preferredPronunciation',
        purpose:
          'Terms with three layers of meaning. The pronunciation index ' +
          'serves the future Read Aloud substitution pass (RA-014).',
      },
      [STORES.epistemicClaims]: {
        indexes:
          'id, status, confidence, interpretationThread, *originBlockIds, deletedAt',
        purpose:
          'Formal claims shared by journal, argument maps and Atlas. ' +
          'Multi-entry `originBlockIds` because one claim may be asserted ' +
          'at several passages (ADR-0001 §4).',
      },
      [STORES.studySessions]: {
        indexes: 'id, sourceId, startedAt, activityMode',
        purpose:
          '`activityMode` indexed so listening time can be reported ' +
          'separately from reading time (RA-INV-008).',
      },
      [STORES.workspaceStates]: {
        indexes: 'sourceId, updatedAt',
        purpose:
          'Resume state, keyed by source — one per source. Canonical ' +
          'holder of visual, listening and furthest positions.',
      },
  [STORES.meta]: {
        indexes: 'key',
        purpose:
          'Database-level bookkeeping: schema version, creation time, ' +
          'migration status. Key-value.',
  },
};

export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    introduced: '2026-07-25',
    migration:
      'Initial v2 schema. Creates a new database; touches no v1 data. ' +
      'Nothing is migrated automatically — see the Phase 0C dry run.',
    recovery:
      'The database is new and empty on creation, so failure loses nothing. ' +
      'Delete the "cntknw" database and reopen. The v1 database ' +
      '"philosophy-journal" is never modified and remains intact.',
    stores: CNTKNW_STORES,
  },
  {
    version: 2,
    introduced: '2026-08-06',
    migration:
      'Transactionally converts every annotation from opaque geometry plus ' +
      'optional textAnchor fields to the ADR-0007 canonical anchor union. ' +
      'The annotations store and all indexes are reused.',
    recovery:
      'Close other tabs and reopen so Dexie can retry the atomic upgrade. ' +
      'If recovery is impossible, export or back up the cntknw IndexedDB ' +
      'before deleting it. Never delete or upgrade philosophy-journal.',
    stores: CNTKNW_STORES,
  },
];

export function schemaVersion(version: number): SchemaVersion {
  const found = SCHEMA_VERSIONS.find((v) => v.version === version);
  if (!found) throw new Error(`No schema declared for version ${version}`);
  return found;
}

/** Dexie's `.stores()` argument for a version. */
export function dexieStores(version: number): Record<string, string> {
  const entries = Object.entries(schemaVersion(version).stores);
  return Object.fromEntries(entries.map(([name, def]) => [name, def.indexes]));
}

// ─── Meta keys ───────────────────────────────────────────────────

export const META_KEYS = {
  schemaVersion: 'schemaVersion',
  createdAt: 'createdAt',
  v1MigrationStatus: 'v1MigrationStatus',
} as const;

export type V1MigrationStatus =
  | 'not-started'
  | 'dry-run-complete'
  | 'applied'
  | 'failed';
