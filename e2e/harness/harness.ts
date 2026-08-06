/**
 * Browser verification harness. Development only.
 *
 * The Phase 0C brief requires the browser suite to exercise CNTKNW's
 * PUBLIC composition boundaries rather than raw IndexedDB calls made
 * from the Playwright file. A test that opens `indexedDB` itself and
 * asserts a row came back proves the browser implements IndexedDB;
 * it proves nothing about the Dexie adapter, the storage-record
 * mappers, the unit of work or the concurrency guards. So this page
 * builds the same object graph the application will build and
 * exposes it — and nothing lower — on `window.__cntknw`.
 *
 * Two deliberate exceptions, both fixtures rather than the system
 * under test:
 *
 *   - `seedV1Database` writes a legacy `philosophy-journal` database
 *     directly. v1 is an external artefact of the old app; CNTKNW has
 *     no v1 writer and must never grow one, so a raw write is the
 *     only honest way to stage the fixture BV-005 needs.
 *   - `listDatabases` reads `indexedDB.databases()` to assert what
 *     v2 did and did not touch. Observation, not participation.
 *
 * The composition is NOT created on load. Each test calls `open`
 * explicitly, including after a reload, so "recreate the composition
 * and read back" is what the test actually performs.
 */
import { createIndexedDbRepositories } from '@data/adapters/indexeddb';
import { createTestDatabase } from '@data/db/database';
import type { CntknwDatabase } from '@data/db/database';
import { expectedRevision, unconditionally } from '@data/repositories/concurrency';
import { isStorageError } from '@data/errors';
import { importPdf } from '@application/import-pdf';
import { createPageLinkedBlock } from '@application/create-block';
import { resumeSource } from '@application/resume-source';
import { readV1Snapshot, v1DatabaseExists } from '../../src/legacy/v1/readers';
import { V1_DATABASE_NAME } from '@data/db/schemaVersions';
import type {
  Annotation,
  AnnotationAnchor,
  AnnotationKind,
  EntityId,
} from '@domain/index';

type Repositories = ReturnType<typeof createIndexedDbRepositories>;

interface Composition {
  db: CntknwDatabase;
  repos: Repositories;
}

let composition: Composition | null = null;

function active(): Composition {
  if (!composition) {
    throw new Error('Harness: call open(databaseName) first.');
  }
  return composition;
}

/** A failure shape the test can assert on without parsing prose. */
export interface HarnessFailure {
  ok: false;
  errorName: string;
  /** Present for CntknwStorageError; absent for anything else. */
  kind?: string;
  expectedRevision?: number;
  actualRevision?: number;
  message: string;
}

export interface HarnessSuccess<T> {
  ok: true;
  value: T;
}

export type HarnessResult<T> = HarnessSuccess<T> | HarnessFailure;

function describeFailure(error: unknown): HarnessFailure {
  if (isStorageError(error)) {
    const conflict = error as unknown as {
      expectedRevision?: number;
      actualRevision?: number;
    };
    return {
      ok: false,
      errorName: error.name,
      kind: error.kind,
      expectedRevision: conflict.expectedRevision,
      actualRevision: conflict.actualRevision,
      message: error.message,
    };
  }
  const asError = error instanceof Error ? error : new Error(String(error));
  return { ok: false, errorName: asError.name, message: asError.message };
}

async function attempt<T>(operation: () => Promise<T>): Promise<HarnessResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return describeFailure(error);
  }
}

// ─── Fixtures ────────────────────────────────────────────────────

function pdfFile(name: string, suppliedBytes?: readonly number[]): File {
  const bytes = suppliedBytes
    ? new Uint8Array(suppliedBytes)
    : new TextEncoder().encode('%PDF-1.7\nharness fixture body');
  return new File([bytes], name, { type: 'application/pdf' });
}

function locationAt(sourceId: EntityId, page: number) {
  return { sourceType: 'book' as const, sourceId, pdf: { page } };
}

// ─── The exposed surface ─────────────────────────────────────────

export interface ImportedIds {
  sourceId: EntityId;
  assetId: EntityId;
  journalId: EntityId;
  workspaceStateId: EntityId;
  workspaceRevision: number;
}

export interface ResumedSnapshot {
  sourceTitle: string;
  sourceRevision: number;
  journalId: EntityId;
  activePage: number | undefined;
  furthestPage: number | undefined;
  workspaceRevision: number;
  blockCount: number;
  firstBlockText: string | undefined;
  firstBlockPage: number | undefined;
  firstBlockRevision: number | undefined;
  primaryAssetId: EntityId | undefined;
  primaryAssetBytes: number | undefined;
}

export interface StoredCounts {
  sources: number;
  assets: number;
  journals: number;
  blocks: number;
  workspaceStates: number;
  sourceAssets: number;
  binaries: number;
}

export interface DatabaseListing {
  name: string;
  version: number;
}

function importedIds(result: Awaited<ReturnType<typeof importPdf>>): ImportedIds {
  return {
    sourceId: result.source.id,
    assetId: result.asset.id,
    journalId: result.journal.id,
    workspaceStateId: result.workspaceState.id,
    workspaceRevision: result.workspaceState.revision,
  };
}

const api = {
  /** Build the composition against an isolated v2 database. */
  async open(databaseName: string): Promise<void> {
    if (composition) await api.close();
    const db = createTestDatabase(databaseName);
    await db.open();
    composition = { db, repos: createIndexedDbRepositories(db) };
  },

  async close(): Promise<void> {
    composition?.db.close();
    composition = null;
  },

  async deleteDatabase(databaseName: string): Promise<void> {
    if (composition?.db.name === databaseName) await api.close();
    await indexedDB.deleteDatabase(databaseName);
  },

  /** BV-001 — write a full source through the import use case. */
  async importSource(title: string): Promise<ImportedIds> {
    const { repos } = active();
    const result = await importPdf(repos, {
      file: pdfFile(`${title}.pdf`),
      metadata: { title, author: 'Frantz Fanon', pageCount: 251 },
    });
    return importedIds(result);
  },

  /** Test-only real-byte import through the production application use case. */
  async importPdfSource(
    title: string,
    bytes: readonly number[],
    pageCount: number,
  ): Promise<ImportedIds> {
    const { repos } = active();
    const result = await importPdf(repos, {
      file: pdfFile(`${title}.pdf`, bytes),
      metadata: { title, pageCount },
    });
    return importedIds(result);
  },

  /** Phase 3A proof: write only through the real AnnotationRepository. */
  async createAnnotation(input: {
    sourceId: EntityId;
    assetId: EntityId;
    page: number;
    kind: AnnotationKind;
    anchor: AnnotationAnchor;
  }): Promise<Annotation> {
    return active().repos.annotations.create(input);
  },

  /** Phase 3A proof: read through validation, never from the Dexie table. */
  async getAnnotation(annotationId: EntityId): Promise<Annotation | null> {
    return active().repos.annotations.getById(annotationId);
  },

  /** BV-001 — a page-linked block, so INV-004 context survives too. */
  async addBlock(
    sourceId: EntityId,
    page: number,
    text: string,
  ): Promise<{ blockId: EntityId; revision: number }> {
    const { repos } = active();
    const block = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, page),
      kind: 'paragraph',
      content: { type: 'paragraph', text },
    });
    return { blockId: block.id, revision: block.revision };
  },

  async getFirstBlock(journalId: EntityId) {
    const { repos } = active();
    const blocks = await repos.journals.listBlocks(journalId);
    return blocks[0];
  },

  async updateBlockText(journalId: EntityId, blockId: EntityId, text: string, expectedRev: number): Promise<HarnessResult<{ revision: number }>> {
    const { repos } = active();
    try {
      const blocks = await repos.journals.listBlocks(journalId);
      const block = blocks.find(b => b.id === blockId);
      if (!block) throw new Error('not found');
      const saved = await repos.journals.updateBlock({
        ...block,
        content: { type: 'paragraph', doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, text }
      }, expectedRevision(expectedRev));
      return { ok: true, value: { revision: saved.revision } };
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (isStorageError(e)) return { ok: false, errorName: e.name, message: e.message, kind: (e as any).kind, expectedRevision: (e as any).expectedRevision, actualRevision: (e as any).actualRevision };
      throw e;
    }
  },

  async getJournalId(sourceId: EntityId): Promise<EntityId | undefined> {
    const { repos } = active();
    const journal = await repos.journals.getJournalForSource(sourceId);
    return journal?.id;
  },

  /** BV-001 — move the reading position, so there is state to resume. */
  async moveReadingPosition(
    sourceId: EntityId,
    page: number,
    revision: number,
  ): Promise<number> {
    const { repos } = active();
    const current = await repos.workspaceStates.getBySource(sourceId);
    if (!current) throw new Error(`No workspace state for ${sourceId}`);
    const saved = await repos.workspaceStates.update(
      {
        ...current,
        activeLocation: locationAt(sourceId, page),
        furthestLocation: locationAt(sourceId, page),
      },
      expectedRevision(revision),
    );
    return saved.revision;
  },

  /** BV-001 — read everything back through the resume use case. */
  async resume(sourceId: EntityId): Promise<ResumedSnapshot> {
    const { repos } = active();
    const context = await resumeSource(repos, sourceId);
    const blocks = await repos.journals.listBlocks(context.journal.id);
    const first = blocks[0];
    const binary = context.primaryAsset
      ? await repos.assets.getBinary(context.primaryAsset.id)
      : null;

    return {
      sourceTitle: context.source.title,
      sourceRevision: context.source.revision,
      journalId: context.journal.id,
      activePage: context.workspaceState?.activeLocation.pdf?.page,
      furthestPage: context.workspaceState?.furthestLocation?.pdf?.page,
      workspaceRevision: context.workspaceState?.revision ?? -1,
      blockCount: blocks.length,
      firstBlockText:
        first?.content.type === 'paragraph' ? first.content.text : undefined,
      firstBlockPage: first?.sourceLocation?.pdf?.page,
      firstBlockRevision: first?.revision,
      primaryAssetId: context.primaryAsset?.id,
      primaryAssetBytes: binary?.byteLength,
    };
  },

  /** Raw-ish counts, read through the repositories rather than Dexie. */
  async counts(): Promise<StoredCounts> {
    const { db, repos } = active();
    const sources = await repos.sources.getAll();
    let blocks = 0;
    let journals = 0;
    for (const source of sources) {
      const journal = await repos.journals.getJournalForSource(source.id);
      if (journal) {
        journals += 1;
        blocks += await repos.journals.getBlockCount(journal.id);
      }
    }
    return {
      sources: sources.length,
      // Assets and joins have no list-all repository method, so these
      // read the tables directly — counting, never writing.
      assets: await db.assets.count(),
      journals,
      blocks,
      workspaceStates: await db.workspaceStates.count(),
      sourceAssets: await db.sourceAssets.count(),
      binaries: await db.assetBinaries.count(),
    };
  },

  /**
   * BV-002 — a multi-store unit of work that throws after the third
   * write. Nothing it wrote may survive.
   */
  async failingMultiStoreTransaction(): Promise<HarnessResult<never>> {
    const { repos } = active();
    return attempt(async () =>
      repos.unitOfWork.run<never>(async () => {
        const asset = await repos.assets.create({
          kind: 'pdf',
          mimeType: 'application/pdf',
          originalName: 'rollback.pdf',
          sizeBytes: 32,
          storageKey: 'asset/rollback',
        });
        await repos.assets.storeBinary(
          asset.id,
          new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
        );
        const source = await repos.sources.create({
          type: 'book',
          title: 'Should not survive',
        });
        await repos.assets.linkToSource(source.id, asset.id, 'primary');
        await repos.journals.getOrCreateJournalForSource(source.id, 'Ghost');
        throw new Error('deliberate failure after five writes');
      }),
    );
  },

  /**
   * BV-004 — an inner unit of work must join the outer browser
   * transaction and roll back with it, not commit independently.
   */
  async failingNestedTransaction(): Promise<HarnessResult<never>> {
    const { repos } = active();
    return attempt(async () =>
      repos.unitOfWork.run<never>(async () => {
        await repos.unitOfWork.run(async () => {
          const source = await repos.sources.create({
            type: 'book',
            title: 'Inner write',
          });
          await repos.journals.getOrCreateJournalForSource(source.id, 'Inner');
          return source;
        });
        throw new Error('outer failed after the inner run returned');
      }),
    );
  },

  /** BV-003 — a valid update, then a stale one. */
  async updateTitle(
    sourceId: EntityId,
    title: string,
    revision: number,
  ): Promise<HarnessResult<{ title: string; revision: number }>> {
    const { repos } = active();
    return attempt(async () => {
      const updated = await repos.sources.update(
        sourceId,
        { title },
        expectedRevision(revision),
      );
      return { title: updated.title, revision: updated.revision };
    });
  },

  /** BV-003 — the explicit override, exercised end to end. */
  async updateTitleUnconditionally(
    sourceId: EntityId,
    title: string,
  ): Promise<HarnessResult<{ title: string; revision: number }>> {
    const { repos } = active();
    return attempt(async () => {
      const updated = await repos.sources.update(
        sourceId,
        { title },
        unconditionally('repair'),
      );
      return { title: updated.title, revision: updated.revision };
    });
  },

  async readSource(
    sourceId: EntityId,
  ): Promise<{ title: string; revision: number } | null> {
    const { repos } = active();
    const source = await repos.sources.getById(sourceId);
    return source ? { title: source.title, revision: source.revision } : null;
  },

  // ─── BV-005: legacy database separation ────────────────────────

  /**
   * Stage a v1-shaped `philosophy-journal` database at version 1.
   *
   * Written with the raw IndexedDB API on purpose: CNTKNW has no v1
   * writer, and must never acquire one. This is fixture setup for
   * the assertion that v2 leaves it alone.
   */
  async seedV1Database(): Promise<{ version: number }> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(V1_DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        // Mirrors legacy-v1/db.js: pdfAnnotations exists, the
        // `annotations` store PDFReader.jsx wrote to never did.
        db.createObjectStore('books', { keyPath: 'id' });
        db.createObjectStore('notes', { keyPath: 'id' });
        const annotations = db.createObjectStore('pdfAnnotations', {
          keyPath: 'id',
        });
        annotations.createIndex('pdfId', 'pdfId');
        annotations.createIndex('page', 'page');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('books', 'readwrite');
        tx.objectStore('books').put({
          id: 'v1-book-1',
          title: 'Legacy book that must survive',
          author: 'Anonymous',
          publicationYear: 'circa 1961',
          currentPage: 88,
        });
        tx.oncomplete = () => {
          const version = db.version;
          db.close();
          resolve({ version });
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  },

  /** Read v1 back through the only module permitted to touch it. */
  async readV1(): Promise<{
    exists: boolean;
    bookCount: number;
    firstTitle: string | undefined;
    firstCurrentPage: number | undefined;
    storesFound: string[];
    phantomAnnotationCount: number;
  }> {
    const exists = await v1DatabaseExists();
    if (!exists) {
      return {
        exists,
        bookCount: 0,
        firstTitle: undefined,
        firstCurrentPage: undefined,
        storesFound: [],
        phantomAnnotationCount: 0,
      };
    }
    const snapshot = await readV1Snapshot();
    return {
      exists,
      bookCount: snapshot.books.length,
      firstTitle: snapshot.books[0]?.title,
      firstCurrentPage: snapshot.books[0]?.currentPage,
      storesFound: snapshot.storesFound,
      phantomAnnotationCount: snapshot.phantomAnnotations.length,
    };
  },

  /** Observation only: what databases exist, and at what version. */
  async listDatabases(): Promise<DatabaseListing[]> {
    const listed = await indexedDB.databases();
    return listed
      .filter((entry): entry is { name: string; version: number } =>
        typeof entry.name === 'string' && typeof entry.version === 'number',
      )
      .map((entry) => ({ name: entry.name, version: entry.version }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};

export type CntknwHarness = typeof api;

declare global {
  interface Window {
    __cntknw: CntknwHarness;
  }
}

window.__cntknw = api;

const status = document.getElementById('status');
if (status) status.textContent = 'ready';
document.body.dataset.harness = 'ready';
