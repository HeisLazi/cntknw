/**
 * Repository contract suite.
 *
 * Adapter-agnostic on purpose. Handoff §20.2 requires the same
 * suite to run against the in-memory adapter and, later, the
 * IndexedDB adapter. When the Dexie adapter arrives it should be
 * added to `adapters` below and pass unchanged — if it does not,
 * the two adapters have diverged and that is exactly the defect
 * this suite exists to catch.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEntityId } from '@lib/id';
import { createMemoryRepositories } from './memory';
import type { MemoryRepositories } from './memory';
import { createIndexedDbRepositories } from './indexeddb';
import type { UpdateBlockInput } from '@domain/index';
import { createTestDatabase } from '../db/database';
import type { CntknwDatabase } from '../db/database';
import {
  RevisionConflictError,
  RecordNotFoundError,
  RecordAlreadyExistsError,
} from '../errors';
import { expectedRevision, unconditionally } from '../repositories/concurrency';
import type { ConcurrencyGuard } from '../repositories/concurrency';

/**
 * The memory adapter defines the contract shape; the Dexie adapter
 * must satisfy the same one. Typing against `MemoryRepositories`
 * means a signature drift in either adapter is a compile error, not
 * a runtime surprise.
 */
type Repositories = MemoryRepositories;

interface AdapterUnderTest {
  name: string;
  create: () => Promise<Repositories> | Repositories;
  teardown?: () => Promise<void>;
}

let openDatabases: CntknwDatabase[] = [];

const adapters: AdapterUnderTest[] = [
  {
    name: 'memory',
    create: createMemoryRepositories,
  },
  {
    name: 'indexeddb',
    // A fresh database per test: IndexedDB is process-global, and
    // leaking state between cases would make failures order-dependent.
    create: async () => {
      const db = createTestDatabase(`cntknw-test-${createEntityId()}`);
      await db.open();
      openDatabases.push(db);
      return createIndexedDbRepositories(db) as unknown as Repositories;
    },
    teardown: async () => {
      for (const db of openDatabases) {
        db.close();
        await db.delete();
      }
      openDatabases = [];
    },
  },
];

const id = createEntityId;

function locationAt(sourceId: string, page: number) {
  return { sourceType: 'book' as const, sourceId, pdf: { page } };
}

for (const adapter of adapters) {
  describe(`${adapter.name} adapter`, () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await adapter.create();
    });

    afterEach(async () => {
      await adapter.teardown?.();
    });

    // ─── Sources ─────────────────────────────────────────────────

    describe('SourceRepository', () => {
      it('creates a source applying schema defaults', async () => {
        // creatorIds/collectionIds/tagIds are omitted by the caller:
        // create inputs are z.input, so defaults stay optional.
        const source = await repos.sources.create({
          type: 'book',
          title: 'The Wretched of the Earth',
        });
        expect(source.id).toBeTruthy();
        expect(source.revision).toBe(0);
        expect(source.creatorIds).toEqual([]);
        expect(source.collectionIds).toEqual([]);
        expect(source.tagIds).toEqual([]);
      });

      it('increments revision on update and preserves identity', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        const updated = await repos.sources.update(
          source.id,
          { title: 'B' },
          expectedRevision(source.revision),
        );
        expect(updated.id).toBe(source.id);
        expect(updated.createdAt).toBe(source.createdAt);
        expect(updated.title).toBe('B');
        expect(updated.revision).toBe(1);
      });

      it('archives and unarchives without deleting', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.archive(source.id, expectedRevision(0));
        expect(await repos.sources.getActive()).toHaveLength(0);
        expect(await repos.sources.getById(source.id)).not.toBeNull();

        await repos.sources.unarchive(source.id, expectedRevision(1));
        expect(await repos.sources.getActive()).toHaveLength(1);
        const restored = await repos.sources.getById(source.id);
        expect(restored?.archivedAt).toBeUndefined();
      });

      it('upserts book details without a reading position', async () => {
        // BookDetails must not carry currentPage: WorkspaceState
        // owns reading position (ADR-0001 §3).
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        const details = await repos.sources.upsertBookDetails(source.id, {
          authorText: 'Frantz Fanon',
        });
        expect(details.currentStatus).toBe('unread');
        expect('currentPage' in details).toBe(false);
      });

      it('merges repeated book-detail upserts', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.upsertBookDetails(source.id, { authorText: 'X' });
        const merged = await repos.sources.upsertBookDetails(source.id, {
          pageCount: 251,
        });
        expect(merged.authorText).toBe('X');
        expect(merged.pageCount).toBe(251);
      });

      it('rejects an invalid source input', async () => {
        await expect(
          repos.sources.create({ type: 'book', title: '' }),
        ).rejects.toThrow();
      });
    });

    // ─── Journals and blocks ─────────────────────────────────────

    describe('JournalRepository', () => {
      it('creates one journal per source and reuses it', async () => {
        const sourceId = id();
        const a = await repos.journals.getOrCreateJournalForSource(sourceId, 'J');
        const b = await repos.journals.getOrCreateJournalForSource(sourceId, 'J');
        expect(b.id).toBe(a.id);
      });

      it('returns blocks in rank order', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        for (const rank of ['c', 'a', 'b']) {
          await repos.journals.createBlock({
            journalId: journal.id,
            kind: 'paragraph',
            rank,
            content: { type: 'paragraph', text: rank },
          });
        }
        const blocks = await repos.journals.listBlocks(journal.id);
        expect(blocks.map((b) => b.rank)).toEqual(['a', 'b', 'c']);
      });

      it('filters blocks by page', async () => {
        const sourceId = id();
        const journal = await repos.journals.getOrCreateJournalForSource(sourceId, 'J');
        await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          sourceLocation: locationAt(sourceId, 5),
          content: { type: 'paragraph', text: 'page five' },
        });
        await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'b',
          sourceLocation: locationAt(sourceId, 6),
          content: { type: 'paragraph', text: 'page six' },
        });
        const page5 = await repos.journals.listBlocksByPage(journal.id, 5);
        expect(page5).toHaveLength(1);
        expect(page5[0]!.sourceLocation?.pdf?.page).toBe(5);
      });

      it('soft-deletes without destroying the record', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const block = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'paragraph', text: 'keep me' },
        });

        await repos.journals.softDeleteBlock(block.id, expectedRevision(0));

        expect(await repos.journals.listBlocks(journal.id)).toHaveLength(0);
        expect(await repos.journals.getBlockCount(journal.id)).toBe(0);

        // The record survives — NFR-008 requires a recovery path.
        const stored = await repos.journals.getBlockById(block.id);
        expect(stored).not.toBeNull();
        expect(stored?.deletedAt).toBeTruthy();
        expect(await repos.journals.listDeletedBlocks(journal.id)).toHaveLength(1);
      });

      it('restores a soft-deleted block', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const block = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'paragraph', text: 'x' },
        });
        await repos.journals.softDeleteBlock(block.id, expectedRevision(0));
        await repos.journals.restoreBlock(block.id, expectedRevision(1));

        expect(await repos.journals.listBlocks(journal.id)).toHaveLength(1);
        const restored = await repos.journals.getBlockById(block.id);
        expect(restored?.deletedAt).toBeUndefined();
      });

      it('clears parentBlockId when explicitly set to null', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const parent = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'paragraph', text: 'parent' },
        });
        const child = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'b',
          parentBlockId: parent.id,
          content: { type: 'paragraph', text: 'child' },
        });
        const detached = await repos.journals.updateBlock(
          {
            id: child.id,
            parentBlockId: null,
          },
          expectedRevision(child.revision),
        );
        expect(detached.parentBlockId).toBeUndefined();
      });

      it('moves a block to another page', async () => {
        const sourceId = id();
        const journal = await repos.journals.getOrCreateJournalForSource(sourceId, 'J');
        const block = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          sourceLocation: locationAt(sourceId, 5),
          content: { type: 'paragraph', text: 'x' },
        });
        await repos.journals.moveBlock(
          {
            blockId: block.id,
            newRank: 'b',
            newSourceLocation: locationAt(sourceId, 6),
          },
          expectedRevision(block.revision),
        );
        const moved = await repos.journals.getBlockById(block.id);
        expect(moved?.sourceLocation?.pdf?.page).toBe(6);
        expect(moved?.rank).toBe('b');
        expect(moved?.revision).toBe(1);
      });

      it('rejects content that is not a known block type', async () => {
        // Validation happens at the repository boundary, so an
        // invalid payload is rejected even when it arrives untyped
        // (as it would from an import or a migration).
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const invalid = {
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'not-a-real-kind', text: 'x' },
        } as unknown as Parameters<typeof repos.journals.createBlock>[0];

        await expect(repos.journals.createBlock(invalid)).rejects.toThrow();
      });

      it('rejects updateBlock if a content patch creates a kind mismatch', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const block = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'paragraph', text: 'original' },
        });

        // Patching with mismatched content type should fail validation
        await expect(
          repos.journals.updateBlock({
            id: block.id,
            content: { type: 'question', text: 'new text' } as unknown as UpdateBlockInput['content']
          }, expectedRevision(block.revision))
        ).rejects.toThrow();
      });

      it('rejects updateBlock if a kind patch creates a content mismatch', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const block = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'paragraph', text: 'original' },
        });

        // Patching with mismatched kind should fail validation
        await expect(
          repos.journals.updateBlock({
            id: block.id,
            kind: 'question'
          }, expectedRevision(block.revision))
        ).rejects.toThrow();
      });
    });

    // ─── Assets ──────────────────────────────────────────────────

    describe('AssetRepository', () => {
      it('creates an asset with createdAt but no revision', async () => {
        const asset = await repos.assets.create({
          kind: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          storageKey: 'asset/x',
        });
        expect(asset.createdAt).toBeTruthy();
        expect('revision' in asset).toBe(false);
        expect('updatedAt' in asset).toBe(false);
      });

      it('stores and retrieves binary data', async () => {
        const asset = await repos.assets.create({
          kind: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4,
          storageKey: 'asset/x',
        });
        const data = new Uint8Array([1, 2, 3, 4]).buffer;
        await repos.assets.storeBinary(asset.id, data);
        const loaded = await repos.assets.getBinary(asset.id);
        expect(loaded?.byteLength).toBe(4);
      });

      it('links an asset to a source as a pure join record', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        const asset = await repos.assets.create({
          kind: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          storageKey: 'k',
        });
        const link = await repos.assets.linkToSource(source.id, asset.id, 'primary');
        expect(link).toEqual({
          sourceId: source.id,
          assetId: asset.id,
          role: 'primary',
        });

        const primary = await repos.assets.getPrimaryAsset(source.id);
        expect(primary?.id).toBe(asset.id);
      });

      it('removes links when the asset is deleted', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        const asset = await repos.assets.create({
          kind: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          storageKey: 'k',
        });
        await repos.assets.linkToSource(source.id, asset.id, 'primary');
        await repos.assets.delete(asset.id);
        expect(await repos.assets.getAssetsForSource(source.id)).toHaveLength(0);
        expect(await repos.assets.getBinary(asset.id)).toBeNull();
      });
    });

    // ─── Annotations ─────────────────────────────────────────────

    describe('AnnotationRepository', () => {
      it('retrieves annotations by exact source, asset, and page', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        const assetA = await repos.assets.create({
          kind: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          storageKey: 'asset/a',
        });
        const assetB = await repos.assets.create({
          kind: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          storageKey: 'asset/b',
        });
        await repos.assets.linkToSource(source.id, assetA.id, 'primary');
        await repos.assets.linkToSource(source.id, assetB.id, 'supplement');

        const anchor = {
          kind: 'text' as const,
          quote: 'passage',
          rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
          boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
        };
        const annotationA1 = await repos.annotations.create({
          sourceId: source.id,
          assetId: assetA.id,
          page: 7,
          kind: 'highlight',
          anchor,
        });
        const annotationB1 = await repos.annotations.create({
          sourceId: source.id,
          assetId: assetB.id,
          page: 7,
          kind: 'highlight',
          anchor,
        });
        const annotationA2 = await repos.annotations.create({
          sourceId: source.id,
          assetId: assetA.id,
          page: 8,
          kind: 'highlight',
          anchor,
        });

        expect(
          (await repos.annotations.getBySourceAssetAndPage(source.id, assetA.id, 7))
            .map((annotation) => annotation.id),
        ).toEqual([annotationA1.id]);
        expect(
          (await repos.annotations.getBySourceAssetAndPage(source.id, assetB.id, 7))
            .map((annotation) => annotation.id),
        ).toEqual([annotationB1.id]);
        expect(
          (await repos.annotations.getBySourceAssetAndPage(source.id, assetA.id, 8))
            .map((annotation) => annotation.id),
        ).toEqual([annotationA2.id]);
        expect(
          await repos.annotations.getBySourceAssetAndPage(source.id, assetA.id, 9),
        ).toEqual([]);

        const sourceAnnotations = await repos.annotations.getBySource(source.id);
        expect(sourceAnnotations).toHaveLength(3);
        expect(sourceAnnotations.map((annotation) => annotation.id)).toEqual(
          expect.arrayContaining([annotationA1.id, annotationB1.id, annotationA2.id]),
        );
      });

      it('rejects a non-positive page', async () => {
        await expect(
          repos.annotations.create({
            sourceId: id(),
            assetId: id(),
            page: 0,
            kind: 'highlight',
            anchor: {
              kind: 'text',
              quote: 'passage',
              rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
              boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
            },
          }),
        ).rejects.toThrow();
      });
    });

    // ─── Connections and backlinks ───────────────────────────────

    describe('ConnectionRepository', () => {
      it('derives backlinks from connection records', async () => {
        const from = { type: 'block' as const, id: id() };
        const to = { type: 'block' as const, id: id() };
        await repos.connections.create({ from, to, relationship: 'supports' });

        expect(await repos.connections.getConnectionsFrom(from)).toHaveLength(1);
        expect(await repos.connections.getBacklinks(to)).toHaveLength(1);
        expect(await repos.connections.getBacklinks(from)).toHaveLength(0);
      });

      it('backlinks from either side of an undirected connection', async () => {
        const from = { type: 'block' as const, id: id() };
        const to = { type: 'block' as const, id: id() };
        await repos.connections.create({
          from,
          to,
          relationship: 'same-theme',
          direction: 'undirected',
        });
        expect(await repos.connections.getBacklinks(from)).toHaveLength(1);
        expect(await repos.connections.getBacklinks(to)).toHaveLength(1);
      });

      it('connects a page to a distant page (AC-005)', async () => {
        const sourceId = id();
        const from = {
          type: 'location' as const,
          location: locationAt(sourceId, 5),
        };
        const to = {
          type: 'location' as const,
          location: locationAt(sourceId, 100),
        };
        await repos.connections.create({ from, to, relationship: 'develops' });

        expect(await repos.connections.getConnectionsFrom(from)).toHaveLength(1);
        expect(await repos.connections.getBacklinks(to)).toHaveLength(1);
      });

      it('connects an Atlas entity to a source page', async () => {
        const sourceId = id();
        const entity = {
          type: 'knowledge-entity' as const,
          ref: { kind: 'event' as const, id: id() },
        };
        const page = {
          type: 'location' as const,
          location: locationAt(sourceId, 42),
        };
        await repos.connections.create({
          from: entity,
          to: page,
          relationship: 'example-of',
        });
        expect(await repos.connections.getConnectionsFrom(entity)).toHaveLength(1);
        expect(await repos.connections.getBacklinks(page)).toHaveLength(1);
      });

      it('does not confuse endpoints that share an id', async () => {
        const shared = id();
        await repos.connections.create({
          from: { type: 'block', id: shared },
          to: { type: 'concept', id: id() },
          relationship: 'same-theme',
        });
        expect(
          await repos.connections.getConnectionsFrom({ type: 'concept', id: shared }),
        ).toHaveLength(0);
      });
    });

    // ─── Concepts and glossary ───────────────────────────────────

    describe('ConceptRepository', () => {
      it('finds a concept by title or alias, case-insensitively', async () => {
        await repos.concepts.create({
          title: 'Negritude',
          aliases: ['Négritude'],
        });
        expect(await repos.concepts.findByTitle('negritude')).not.toBeNull();
        expect(await repos.concepts.findByTitle('Négritude')).not.toBeNull();
        expect(await repos.concepts.findByTitle('nothing')).toBeNull();
      });
    });

    describe('GlossaryRepository', () => {
      it('finds a term and lists stored pronunciations', async () => {
        await repos.glossary.create({ term: 'eudaimonia' });
        await repos.glossary.create({
          term: 'Kwame Nkrumah',
          preferredPronunciation: 'KWAH-meh en-KROO-mah',
        });
        expect(await repos.glossary.findByTerm('eudaimonia')).not.toBeNull();
        const pronunciations = await repos.glossary.listPronunciations();
        expect(pronunciations).toHaveLength(1);
        expect(pronunciations[0]!.term).toBe('Kwame Nkrumah');
      });
    });

    // ─── Epistemic claims ────────────────────────────────────────

    describe('EpistemicClaimRepository', () => {
      it('finds claims by origin block', async () => {
        const blockId = id();
        await repos.claims.create({
          statement: 'x',
          originBlockIds: [blockId],
        });
        expect(await repos.claims.getByOriginBlock(blockId)).toHaveLength(1);
        expect(await repos.claims.getByOriginBlock(id())).toHaveLength(0);
      });

      it('groups rival claims by interpretation thread', async () => {
        await repos.claims.create({ statement: 'a', interpretationThread: 't' });
        await repos.claims.create({ statement: 'b', interpretationThread: 't' });
        await repos.claims.create({ statement: 'c' });
        expect(await repos.claims.getByInterpretationThread('t')).toHaveLength(2);
      });

      it('soft-deletes and restores', async () => {
        const claim = await repos.claims.create({ statement: 'x' });
        await repos.claims.softDelete(claim.id, expectedRevision(0));
        expect(await repos.claims.getAll()).toHaveLength(0);
        expect(await repos.claims.getById(claim.id)).not.toBeNull();

        await repos.claims.restore(claim.id, expectedRevision(1));
        expect(await repos.claims.getAll()).toHaveLength(1);
      });

      it('filters by knowledge status', async () => {
        await repos.claims.create({ statement: 'a', status: 'contested' });
        await repos.claims.create({ statement: 'b' });
        expect(await repos.claims.getByStatus('contested')).toHaveLength(1);
        expect(await repos.claims.getByStatus('open')).toHaveLength(1);
      });
    });

    // ─── Sessions ────────────────────────────────────────────────

    describe('SessionRepository', () => {
      it('creates a session with zeroed accounting fields', async () => {
        const sourceId = id();
        const session = await repos.sessions.create({
          sourceId,
          startedAt: new Date().toISOString(),
          startLocation: locationAt(sourceId, 1),
        });
        expect(session.focusedSeconds).toBe(0);
        expect(session.listenedSeconds).toBe(0);
        expect(session.activityMode).toBe('reading');
        // startedAt/endedAt describe the lifetime; no extra timestamps.
        expect('createdAt' in session).toBe(false);
        expect('updatedAt' in session).toBe(false);
      });

      it('tracks listening time separately from focused time', async () => {
        const sourceId = id();
        const session = await repos.sessions.create({
          sourceId,
          startedAt: new Date().toISOString(),
          startLocation: locationAt(sourceId, 1),
          activityMode: 'mixed',
        });
        const updated = await repos.sessions.update(
          session.id,
          {
            focusedSeconds: 3600,
            listenedSeconds: 1200,
          },
          expectedRevision(session.revision),
        );
        expect(updated.focusedSeconds).toBe(3600);
        expect(updated.listenedSeconds).toBe(1200);
        expect(updated.revision).toBe(1);
      });
    });

    // ─── Workspace state ─────────────────────────────────────────

    describe('WorkspaceStateRepository', () => {
      const makeState = (sourceId: string) => ({
        id: id(),
        sourceId,
        activeLocation: locationAt(sourceId, 1),
        sourceView: {
          mode: 'continuous' as const,
          zoom: 1,
          scrollOffset: 0,
          annotationTool: 'select' as const,
        },
        journalView: { scrollOffset: 0 },
        layout: {
          mode: 'split' as const,
          splitRatio: 0.5,
          sourceCollapsed: false,
          journalCollapsed: false,
        },
        awayMode: false,
        playbackCapability: 'unknown' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: 0,
      });

      it('creates at revision 0 and increments on subsequent writes', async () => {
        const sourceId = id();
        const first = await repos.workspaceStates.create(makeState(sourceId));
        expect(first.revision).toBe(0);

        const second = await repos.workspaceStates.update(
          { ...first, activeLocation: locationAt(sourceId, 42) },
          expectedRevision(first.revision),
        );
        expect(second.revision).toBe(1);
        expect(second.id).toBe(first.id);
        expect(second.createdAt).toBe(first.createdAt);
        expect(second.activeLocation.pdf?.page).toBe(42);
      });

      it('refuses a second create rather than silently overwriting', async () => {
        // The upsert this replaced would have turned an accidental
        // re-create into an overwrite of an existing workspace —
        // last-write-wins under a different name (ADR-0003).
        const sourceId = id();
        await repos.workspaceStates.create(makeState(sourceId));
        await expect(
          repos.workspaceStates.create(makeState(sourceId)),
        ).rejects.toBeInstanceOf(RecordAlreadyExistsError);
      });

      it('refuses an update before any state exists', async () => {
        const sourceId = id();
        await expect(
          repos.workspaceStates.update(
            makeState(sourceId),
            expectedRevision(0),
          ),
        ).rejects.toBeInstanceOf(RecordNotFoundError);
      });

      it('keeps reading and listening positions independent', async () => {
        const sourceId = id();
        const saved = await repos.workspaceStates.create({
          ...makeState(sourceId),
          activeLocation: locationAt(sourceId, 67),
          listenLocation: locationAt(sourceId, 82),
        });
        const reloaded = await repos.workspaceStates.getBySource(sourceId);
        expect(reloaded?.activeLocation.pdf?.page).toBe(67);
        expect(reloaded?.listenLocation?.pdf?.page).toBe(82);
        expect(saved.sourceId).toBe(sourceId);
      });
    });

    // ─── Unit of work ────────────────────────────────────────────

    describe('UnitOfWork', () => {
      it('returns the operation result', async () => {
        const result = await repos.unitOfWork.run(async () => 'done');
        expect(result).toBe('done');
      });

      it('propagates errors to the caller', async () => {
        await expect(
          repos.unitOfWork.run(async () => {
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');
      });

      it('commits every write when the operation succeeds', async () => {
        const sourceId = await repos.unitOfWork.run(async () => {
          const source = await repos.sources.create({ type: 'book', title: 'A' });
          await repos.journals.getOrCreateJournalForSource(source.id, 'A');
          return source.id;
        });

        expect(await repos.sources.getById(sourceId)).not.toBeNull();
        expect(await repos.journals.getJournalForSource(sourceId)).not.toBeNull();
      });

      it('rolls back the FIRST write when a later one fails', async () => {
        // The defect a pass-through unit of work hides: without a
        // real transaction the source survives and the journal does
        // not, leaving an orphan.
        await expect(
          repos.unitOfWork.run(async () => {
            await repos.sources.create({ type: 'book', title: 'orphan' });
            throw new Error('failed after the first write');
          }),
        ).rejects.toThrow('failed after the first write');

        expect(await repos.sources.getAll()).toHaveLength(0);
      });

      it('rolls back a write in the MIDDLE of a sequence', async () => {
        await expect(
          repos.unitOfWork.run(async () => {
            const source = await repos.sources.create({ type: 'book', title: 'A' });
            await repos.assets.create({
              kind: 'pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1,
              storageKey: 'k',
            });
            await repos.journals.getOrCreateJournalForSource(source.id, 'A');
            throw new Error('failed after three writes');
          }),
        ).rejects.toThrow('failed after three writes');

        expect(await repos.sources.getAll()).toHaveLength(0);
        expect(await repos.journals.getJournalForSource(id())).toBeNull();
      });

      it('leaves no partial record after a rolled-back import', async () => {
        const before = await repos.sources.getAll();
        await expect(
          repos.unitOfWork.run(async () => {
            const asset = await repos.assets.create({
              kind: 'pdf',
              mimeType: 'application/pdf',
              sizeBytes: 4,
              storageKey: 'asset/x',
            });
            await repos.assets.storeBinary(
              asset.id,
              new Uint8Array([1, 2, 3, 4]).buffer,
            );
            const source = await repos.sources.create({ type: 'book', title: 'B' });
            await repos.assets.linkToSource(source.id, asset.id, 'primary');
            throw new Error('import failed at the end');
          }),
        ).rejects.toThrow();

        expect(await repos.sources.getAll()).toHaveLength(before.length);
      });

      it('does not roll back an already-committed transaction', async () => {
        const source = await repos.unitOfWork.run(() =>
          repos.sources.create({ type: 'book', title: 'kept' }),
        );
        await expect(
          repos.unitOfWork.run(async () => {
            throw new Error('later failure');
          }),
        ).rejects.toThrow();

        expect(await repos.sources.getById(source.id)).not.toBeNull();
      });

      it('joins a nested run to the outer transaction', async () => {
        // A nested unit of work must not open an independent
        // transaction that could commit while the outer rolls back.
        await expect(
          repos.unitOfWork.run(async () => {
            await repos.unitOfWork.run(() =>
              repos.sources.create({ type: 'book', title: 'nested' }),
            );
            throw new Error('outer failed');
          }),
        ).rejects.toThrow('outer failed');

        expect(await repos.sources.getAll()).toHaveLength(0);
      });
    });

    // ─── Optimistic concurrency ──────────────────────────────────

    describe('optimistic concurrency', () => {
      it('starts every entity at revision 0', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        expect(source.revision).toBe(0);
      });

      it('increments by exactly one per successful update', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        const first = await repos.sources.update(
          source.id,
          { title: 'B' },
          expectedRevision(0),
        );
        const second = await repos.sources.update(
          first.id,
          { title: 'C' },
          expectedRevision(1),
        );
        expect(first.revision).toBe(1);
        expect(second.revision).toBe(2);
      });

      it('accepts a matching expected revision', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        const updated = await repos.sources.update(
          source.id,
          { title: 'B' },
          expectedRevision(0),
        );
        expect(updated.title).toBe('B');
      });

      it('rejects a stale expected revision', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.update(source.id, { title: 'B' }, expectedRevision(0));

        await expect(
          repos.sources.update(source.id, { title: 'C' }, expectedRevision(0)),
        ).rejects.toBeInstanceOf(RevisionConflictError);
      });

      it('leaves stored data untouched after a conflict', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.update(source.id, { title: 'B' }, expectedRevision(0));
        await expect(
          repos.sources.update(source.id, { title: 'C' }, expectedRevision(0)),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        const stored = await repos.sources.getById(source.id);
        expect(stored?.title).toBe('B');
        expect(stored?.revision).toBe(1);
      });

      it('reports both revisions on conflict', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.update(source.id, { title: 'B' }, expectedRevision(0));
        try {
          await repos.sources.update(source.id, { title: 'C' }, expectedRevision(0));
          expect.unreachable('should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(RevisionConflictError);
          const conflict = error as RevisionConflictError;
          expect(conflict.expectedRevision).toBe(0);
          expect(conflict.actualRevision).toBe(1);
        }
      });

      // ─── ADR-0003: omission is not last-write-wins ─────────────

      it('rejects a write with no guard rather than overwriting', async () => {
        // TypeScript already makes the argument required. This
        // asserts the runtime half of the same rule: an untyped
        // caller — JavaScript, a bad cast, a value off the wire —
        // must not be quietly granted last-write-wins, which is what
        // ADR-0002 §4 permitted and ADR-0003 removes.
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.update(source.id, { title: 'B' }, expectedRevision(0));

        // Called through the repository so `this` is still bound —
        // the point is a missing argument, not a detached method.
        const untyped = repos.sources as unknown as {
          update(id: string, updates: { title: string }): Promise<unknown>;
        };

        await expect(untyped.update(source.id, { title: 'C' })).rejects.toThrow(
          /ConcurrencyGuard is required/,
        );

        const stored = await repos.sources.getById(source.id);
        expect(stored?.title).toBe('B');
        expect(stored?.revision).toBe(1);
      });

      it('honours an explicit unconditional override', async () => {
        // Migration and repair rewrite records they never read, so
        // they have no revision to claim honestly. The override is
        // available — but it has to be said out loud and named.
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.update(source.id, { title: 'B' }, expectedRevision(0));

        const forced = await repos.sources.update(
          source.id,
          { title: 'C' },
          unconditionally('migration'),
        );
        expect(forced.title).toBe('C');
        expect(forced.revision).toBe(2);
      });

      it('detects a conflict on a journal block', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const block = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'paragraph', text: 'first' },
        });
        await repos.journals.updateBlock(
          { id: block.id, content: { type: 'paragraph', text: 'second' } },
          expectedRevision(0),
        );

        await expect(
          repos.journals.updateBlock(
            { id: block.id, content: { type: 'paragraph', text: 'third' } },
            expectedRevision(0),
          ),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        const stored = await repos.journals.getBlockById(block.id);
        expect(stored?.content).toMatchObject({ text: 'second' });
      });

      it('detects a conflict on workspace state', async () => {
        const sourceId = id();
        const base = {
          id: id(),
          sourceId,
          activeLocation: locationAt(sourceId, 1),
          sourceView: {
            mode: 'continuous' as const,
            zoom: 1,
            scrollOffset: 0,
            annotationTool: 'select' as const,
          },
          journalView: { scrollOffset: 0 },
          layout: {
            mode: 'split' as const,
            splitRatio: 0.5,
            sourceCollapsed: false,
            journalCollapsed: false,
          },
          awayMode: false,
          playbackCapability: 'unknown' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revision: 0,
        };
        const first = await repos.workspaceStates.create(base);
        await repos.workspaceStates.update(
          { ...first, activeLocation: locationAt(sourceId, 5) },
          expectedRevision(0),
        );

        await expect(
          repos.workspaceStates.update(
            { ...first, activeLocation: locationAt(sourceId, 9) },
            expectedRevision(0),
          ),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        // The newer write survives the rejected one.
        const stored = await repos.workspaceStates.getBySource(sourceId);
        expect(stored?.activeLocation.pdf?.page).toBe(5);
      });

      // ─── Stale destructive operations ──────────────────────────

      it('rejects a stale hard delete and keeps the record', async () => {
        const source = await repos.sources.create({ type: 'book', title: 'A' });
        await repos.sources.update(source.id, { title: 'B' }, expectedRevision(0));

        await expect(
          repos.sources.delete(source.id, expectedRevision(0)),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        const stored = await repos.sources.getById(source.id);
        expect(stored?.title).toBe('B');
        expect(stored?.revision).toBe(1);
      });

      it('rejects a stale soft delete and leaves the block live', async () => {
        const journal = await repos.journals.getOrCreateJournalForSource(id(), 'J');
        const block = await repos.journals.createBlock({
          journalId: journal.id,
          kind: 'paragraph',
          rank: 'a',
          content: { type: 'paragraph', text: 'first' },
        });
        await repos.journals.updateBlock(
          { id: block.id, content: { type: 'paragraph', text: 'second' } },
          expectedRevision(0),
        );

        await expect(
          repos.journals.softDeleteBlock(block.id, expectedRevision(0)),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        const stored = await repos.journals.getBlockById(block.id);
        expect(stored?.deletedAt).toBeUndefined();
        expect(stored?.content).toMatchObject({ text: 'second' });
        expect(await repos.journals.listBlocks(journal.id)).toHaveLength(1);
      });

      it('rejects a stale restore and leaves the claim deleted', async () => {
        const claim = await repos.claims.create({ statement: 'x' });
        await repos.claims.softDelete(claim.id, expectedRevision(0));
        // Someone else touches the deleted claim before we restore.
        await repos.claims.update(
          claim.id,
          { statement: 'y' },
          expectedRevision(1),
        );

        await expect(
          repos.claims.restore(claim.id, expectedRevision(1)),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        const stored = await repos.claims.getById(claim.id);
        expect(stored?.deletedAt).toBeTruthy();
        expect(stored?.statement).toBe('y');
        expect(await repos.claims.getAll()).toHaveLength(0);
      });

      it('treats a delete of an absent record as a no-op', async () => {
        // Nothing stored means no newer revision to destroy, so the
        // guard has nothing to protect and the call stays idempotent.
        await expect(
          repos.sources.delete(id(), expectedRevision(7)),
        ).resolves.toBeUndefined();
      });

      it('guards every revisioned entity, not merely sources', async () => {
        // Parity check: each of these has its own adapter code path,
        // and a guard missed on any one of them reopens the overwrite.
        const staleWrites: Array<[string, () => Promise<unknown>]> = [];

        const annotation = await repos.annotations.create({
          sourceId: id(),
          assetId: id(),
          page: 1,
          kind: 'highlight',
          anchor: {
            kind: 'text',
            quote: 'passage',
            rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
            boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
          },
        });
        await repos.annotations.update(
          annotation.id,
          { page: 2 },
          expectedRevision(0),
        );
        staleWrites.push([
          'annotation.update',
          () => repos.annotations.update(annotation.id, { page: 3 }, expectedRevision(0)),
        ]);
        staleWrites.push([
          'annotation.delete',
          () => repos.annotations.delete(annotation.id, expectedRevision(0)),
        ]);

        const concept = await repos.concepts.create({ title: 'Alienation' });
        await repos.concepts.update(
          concept.id,
          { title: 'Entfremdung' },
          expectedRevision(0),
        );
        staleWrites.push([
          'concept.update',
          () => repos.concepts.update(concept.id, { title: 'X' }, expectedRevision(0)),
        ]);
        staleWrites.push([
          'concept.delete',
          () => repos.concepts.delete(concept.id, expectedRevision(0)),
        ]);

        const entry = await repos.glossary.create({ term: 'phronesis' });
        await repos.glossary.update(
          entry.id,
          { term: 'phronēsis' },
          expectedRevision(0),
        );
        staleWrites.push([
          'glossary.update',
          () => repos.glossary.update(entry.id, { term: 'X' }, expectedRevision(0)),
        ]);
        staleWrites.push([
          'glossary.delete',
          () => repos.glossary.delete(entry.id, expectedRevision(0)),
        ]);

        const sourceId = id();
        const session = await repos.sessions.create({
          sourceId,
          startedAt: new Date().toISOString(),
          startLocation: locationAt(sourceId, 1),
        });
        await repos.sessions.update(
          session.id,
          { focusedSeconds: 10 },
          expectedRevision(0),
        );
        staleWrites.push([
          'session.update',
          () =>
            repos.sessions.update(
              session.id,
              { focusedSeconds: 20 },
              expectedRevision(0),
            ),
        ]);
        staleWrites.push([
          'session.delete',
          () => repos.sessions.delete(session.id, expectedRevision(0)),
        ]);

        const connection = await repos.connections.create({
          from: { type: 'block', id: id() },
          to: { type: 'block', id: id() },
          relationship: 'supports',
        });
        staleWrites.push([
          'connection.delete',
          () => repos.connections.delete(connection.id, expectedRevision(9)),
        ]);

        for (const [label, write] of staleWrites) {
          await expect(write(), label).rejects.toBeInstanceOf(
            RevisionConflictError,
          );
        }

        // Everything above survived its stale write.
        expect(await repos.annotations.getById(annotation.id)).not.toBeNull();
        expect(await repos.concepts.getById(concept.id)).not.toBeNull();
        expect(await repos.glossary.getById(entry.id)).not.toBeNull();
        expect(await repos.sessions.getById(session.id)).not.toBeNull();
        expect(await repos.connections.getById(connection.id)).not.toBeNull();
      });

      it('throws a typed not-found error rather than a bare Error', async () => {
        await expect(
          repos.sources.update(id(), { title: 'x' }, expectedRevision(0)),
        ).rejects.toBeInstanceOf(RecordNotFoundError);
      });

      it('exposes the guard as a discriminated union', async () => {
        const guards: ConcurrencyGuard[] = [
          expectedRevision(3),
          unconditionally('migration'),
          unconditionally('repair'),
        ];
        expect(guards.map((g) => g.mode)).toEqual([
          'expected',
          'unconditional',
          'unconditional',
        ]);
      });
    });
  });
}
