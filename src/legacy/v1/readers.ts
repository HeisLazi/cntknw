/**
 * Read-only v1 database access.
 *
 * This module is the ONLY code permitted to touch
 * `philosophy-journal`, and it can only read. There is no write
 * method, no upgrade, no delete — handoff §6.2 and §26 prohibit
 * mutating or removing v1 before a verified migration, and making
 * that structurally impossible is stronger than a convention a
 * future agent might not read (ADR-0002 §6).
 *
 * The database is opened at its EXISTING version. Opening it at a
 * higher version would trigger an irreversible IndexedDB upgrade
 * and permanently break the v1 app.
 */
import Dexie from 'dexie';
import { V1_DATABASE_NAME } from '../../data/db/schemaVersions';
import { LegacyReadError } from '../../data/errors';
import {
  V1_STORES,
  V1_PHANTOM_ANNOTATION_STORE,
  type V1Snapshot,
  type V1Book,
  type V1Note,
  type V1Session,
  type V1Pdf,
  type V1PdfAnnotation,
  type V1PhantomAnnotation,
  type V1Artwork,
  type V1Drawing,
  type V1AppState,
} from './types';

/** True when a v1 database exists on this machine. */
export async function v1DatabaseExists(
  databaseName: string = V1_DATABASE_NAME,
): Promise<boolean> {
  try {
    return await Dexie.exists(databaseName);
  } catch (error) {
    throw new LegacyReadError('Checking for the v1 database', { cause: error });
  }
}

/**
 * Open v1 read-only, at whatever version it already is.
 *
 * Dexie's dynamic mode — no `.version()` call — attaches to the
 * existing schema rather than declaring one, so no upgrade
 * transaction can fire.
 */
async function openV1(databaseName: string): Promise<Dexie> {
  const db = new Dexie(databaseName);
  try {
    await db.open();
    return db;
  } catch (error) {
    db.close();
    throw new LegacyReadError(`Opening the v1 database "${databaseName}"`, {
      cause: error,
    });
  }
}

async function readStore<T>(db: Dexie, name: string): Promise<T[]> {
  if (!db.tables.some((table) => table.name === name)) return [];
  try {
    return (await db.table(name).toArray()) as T[];
  } catch (error) {
    throw new LegacyReadError(`Reading the v1 store "${name}"`, { cause: error });
  }
}

/**
 * Read everything from v1 into memory.
 *
 * Binary payloads in `pdfs` are included, so callers should treat
 * the result as large. The dry run uses it once and discards it.
 */
export async function readV1Snapshot(
  databaseName: string = V1_DATABASE_NAME,
): Promise<V1Snapshot> {
  const db = await openV1(databaseName);
  try {
    const present = new Set(db.tables.map((table) => table.name));
    const storesFound: string[] = V1_STORES.filter((name) => present.has(name));
    const storesMissing: string[] = V1_STORES.filter((name) => !present.has(name));

    // Scanned deliberately. `db.js` never creates this store, so it
    // should be absent — its presence would mean a v1 variant we
    // have not seen (ADR-0002 §8.1).
    if (present.has(V1_PHANTOM_ANNOTATION_STORE)) {
      storesFound.push(V1_PHANTOM_ANNOTATION_STORE);
    }

    return {
      books: await readStore<V1Book>(db, 'books'),
      notes: await readStore<V1Note>(db, 'notes'),
      sessions: await readStore<V1Session>(db, 'sessions'),
      pdfs: await readStore<V1Pdf>(db, 'pdfs'),
      pdfAnnotations: await readStore<V1PdfAnnotation>(db, 'pdfAnnotations'),
      phantomAnnotations: await readStore<V1PhantomAnnotation>(
        db,
        V1_PHANTOM_ANNOTATION_STORE,
      ),
      artworks: await readStore<V1Artwork>(db, 'artworks'),
      drawings: await readStore<V1Drawing>(db, 'drawings'),
      appState: await readStore<V1AppState>(db, 'appState'),
      storesFound,
      storesMissing,
    };
  } finally {
    db.close();
  }
}

/** An empty snapshot, for the no-v1-database case. */
export function emptyV1Snapshot(): V1Snapshot {
  return {
    books: [],
    notes: [],
    sessions: [],
    pdfs: [],
    pdfAnnotations: [],
    phantomAnnotations: [],
    artworks: [],
    drawings: [],
    appState: [],
    storesFound: [],
    storesMissing: [...V1_STORES],
  };
}
