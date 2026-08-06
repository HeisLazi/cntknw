/**
 * Use-case tests.
 *
 * These cover the behaviours the product is defined by: page
 * context inheritance (INV-004, AC-003), exact resume (WS-001,
 * AC-002), and claim promotion.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEntityId } from '@lib/id';
import { compareRank } from '@lib/rank';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import { expectedRevision } from '@data/repositories/concurrency';
import { importPdf, UnsupportedFileError } from './import-pdf';
import { createPageLinkedBlock } from './create-block';
import { resumeSource } from './resume-source';
import {
  promoteBlockToClaim,
  linkBlockToExistingClaim,
  BlockNotPromotableError,
} from './promote-block-to-claim';

const id = createEntityId;

function locationAt(sourceId: string, page: number) {
  return { sourceType: 'book' as const, sourceId, pdf: { page } };
}

function pdfFile(name = 'meditations.pdf'): File {
  const bytes = new TextEncoder().encode('%PDF-1.7\nfake body');
  return new File([bytes], name, { type: 'application/pdf' });
}

function notAPdf(name = 'notes.txt'): File {
  return new File([new TextEncoder().encode('hello')], name, {
    type: 'text/plain',
  });
}

let repos: MemoryRepositories;
beforeEach(() => {
  repos = createMemoryRepositories();
});

// ─── importPdf ───────────────────────────────────────────────────

describe('importPdf', () => {
  it('duplicate-read probe: reuses inspected bytes for a large import', async () => {
    const bytes = new Uint8Array(8 * 1024 * 1024);
    bytes.set(new TextEncoder().encode('%PDF-1.7\n'));
    const file = new File([bytes], 'large-probe.pdf', { type: 'application/pdf' });
    const read = vi.spyOn(file, 'arrayBuffer');

    await importPdf(repos, { file, bytes: bytes.buffer });

    expect(read).not.toHaveBeenCalled();
  });

  it('still validates the signature of caller-supplied bytes', async () => {
    await expect(
      importPdf(repos, {
        file: pdfFile(),
        bytes: new TextEncoder().encode('not a pdf').buffer,
      }),
    ).rejects.toBeInstanceOf(UnsupportedFileError);
    expect(await repos.sources.getAll()).toHaveLength(0);
  });

  it('creates source, asset, journal and workspace state', async () => {
    const result = await importPdf(repos, { file: pdfFile() });

    expect(result.source.type).toBe('book');
    expect(result.asset.kind).toBe('pdf');
    expect(result.journal.sourceId).toBe(result.source.id);
    expect(result.workspaceState.activeLocation.pdf?.page).toBe(1);
  });

  it('derives a title from the filename when metadata is absent', async () => {
    const result = await importPdf(repos, {
      file: pdfFile('the_wretched-of_the-earth.pdf'),
    });
    expect(result.source.title).toBe('the wretched of the earth');
  });

  it('prefers supplied metadata over the filename', async () => {
    const result = await importPdf(repos, {
      file: pdfFile('scan001.pdf'),
      metadata: { title: 'Black Skin, White Masks', author: 'Frantz Fanon' },
    });
    expect(result.source.title).toBe('Black Skin, White Masks');
    const details = await repos.sources.getBookDetails(result.source.id);
    expect(details?.authorText).toBe('Frantz Fanon');
  });

  it('stores the binary and links it as the primary asset', async () => {
    const result = await importPdf(repos, { file: pdfFile() });
    expect(await repos.assets.getBinary(result.asset.id)).not.toBeNull();
    const primary = await repos.assets.getPrimaryAsset(result.source.id);
    expect(primary?.id).toBe(result.asset.id);
  });

  it('assigns a real storage key rather than a placeholder', async () => {
    const result = await importPdf(repos, { file: pdfFile() });
    expect(result.asset.storageKey).not.toBe('');
    expect(result.asset.storageKey).toMatch(/^asset\//);
  });

  it('rejects a file whose bytes are not a PDF', async () => {
    // Signature check, not extension or MIME trust (handoff §11.1).
    await expect(
      importPdf(repos, { file: notAPdf() }),
    ).rejects.toBeInstanceOf(UnsupportedFileError);
  });

  it('writes nothing when the file is rejected', async () => {
    await expect(importPdf(repos, { file: notAPdf() })).rejects.toThrow();
    expect(await repos.sources.getAll()).toHaveLength(0);
  });

  it('seeds the furthest position at page 1', async () => {
    const result = await importPdf(repos, { file: pdfFile() });
    expect(result.workspaceState.furthestLocation?.pdf?.page).toBe(1);
    expect(result.workspaceState.listenLocation).toBeUndefined();
  });
});

// ─── annotation retrieval ───────────────────────────────────────

describe('annotation retrieval', () => {
  it('keeps replacement-asset annotations out of the Phase 3B renderer seam', async () => {
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
    await repos.annotations.create({
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

    // Phase 3B renderer seam: its active asset must bound page retrieval.
    const rendererAnnotations = await repos.annotations.getBySourceAssetAndPage(
      source.id,
      assetB.id,
      7,
    );
    expect(rendererAnnotations.map((annotation) => annotation.id)).toEqual([
      annotationB1.id,
    ]);
  });
});

// ─── createPageLinkedBlock ───────────────────────────────────────

describe('createPageLinkedBlock', () => {
  it('inherits the active page automatically (INV-004, AC-003)', async () => {
    const sourceId = id();
    const block = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 5),
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'A thought about page five.' },
    });
    expect(block.sourceLocation?.pdf?.page).toBe(5);
  });

  it('creates a Drawing block on the active page without flattening it (AC-003, AC-008)', async () => {
    const sourceId = id();
    const block = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 5),
      kind: 'drawing',
      content: {
        type: 'drawing',
        drawingData: { version: 1, width: 800, height: 600, strokes: [] },
      },
    });

    expect(block.sourceLocation?.pdf?.page).toBe(5);
    expect(block.content).toEqual({
      type: 'drawing',
      drawingData: { version: 1, width: 800, height: 600, strokes: [] },
    });
  });

  it('creates the journal on first write', async () => {
    const sourceId = id();
    expect(await repos.journals.getJournalForSource(sourceId)).toBeNull();
    await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 1),
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'x' },
    });
    expect(await repos.journals.getJournalForSource(sourceId)).not.toBeNull();
  });

  it('appends in creation order when no anchor is given', async () => {
    const sourceId = id();
    const first = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 5),
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'first' },
    });
    const second = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 5),
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'second' },
    });
    expect(compareRank(first.rank, second.rank)).toBe(-1);
  });

  it('inserts between two existing blocks', async () => {
    // The behaviour the previous timestamp-based rank could not
    // express at all (audit defect A-9).
    const sourceId = id();
    const location = locationAt(sourceId, 5);
    const first = await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: location, kind: 'paragraph',
      content: { type: 'paragraph', text: 'first' },
    });
    const third = await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: location, kind: 'paragraph',
      content: { type: 'paragraph', text: 'third' },
    });
    const second = await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: location, kind: 'paragraph',
      content: { type: 'paragraph', text: 'second' },
      afterBlockId: first.id,
    });

    expect(compareRank(first.rank, second.rank)).toBe(-1);
    expect(compareRank(second.rank, third.rank)).toBe(-1);

    const journal = await repos.journals.getJournalForSource(sourceId);
    const ordered = await repos.journals.listBlocksByPage(journal!.id, 5);
    expect(ordered.map((b) => b.id)).toEqual([first.id, second.id, third.id]);
  });

  it('ranks within the page, not across the whole journal', async () => {
    const sourceId = id();
    await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: locationAt(sourceId, 5), kind: 'paragraph',
      content: { type: 'paragraph', text: 'page five' },
    });
    const onSix = await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: locationAt(sourceId, 6), kind: 'paragraph',
      content: { type: 'paragraph', text: 'page six' },
    });
    const journal = await repos.journals.getJournalForSource(sourceId);
    const page6 = await repos.journals.listBlocksByPage(journal!.id, 6);
    expect(page6).toHaveLength(1);
    expect(page6[0]!.id).toBe(onSix.id);
  });

  it('creates no empty section for an unused page (AC-004)', async () => {
    const sourceId = id();
    await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: locationAt(sourceId, 5), kind: 'paragraph',
      content: { type: 'paragraph', text: 'x' },
    });
    const journal = await repos.journals.getJournalForSource(sourceId);
    expect(await repos.journals.listBlocksByPage(journal!.id, 6)).toHaveLength(0);
  });

  it('carries a sentence anchor when one is supplied', async () => {
    const sourceId = id();
    const block = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: {
        sourceType: 'book',
        sourceId,
        pdf: { page: 42, sentenceIndex: 3 },
      },
      kind: 'question',
      content: { type: 'question', text: 'Does the author distinguish these?' },
    });
    expect(block.sourceLocation?.pdf?.sentenceIndex).toBe(3);
  });
});

// ─── resumeSource ────────────────────────────────────────────────

describe('resumeSource', () => {
  it('restores the saved page rather than resetting to page 1', async () => {
    // WS-001 and AC-002. Handoff §26 prohibits a page-1 reset.
    const imported = await importPdf(repos, { file: pdfFile() });
    await repos.workspaceStates.update(
      {
        ...imported.workspaceState,
        activeLocation: locationAt(imported.source.id, 67),
      },
      expectedRevision(imported.workspaceState.revision),
    );

    const resumed = await resumeSource(repos, imported.source.id);
    expect(resumed.workspaceState?.activeLocation.pdf?.page).toBe(67);
  });

  it('loads blocks for the resumed page', async () => {
    const imported = await importPdf(repos, { file: pdfFile() });
    const sourceId = imported.source.id;
    await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: locationAt(sourceId, 67), kind: 'paragraph',
      content: { type: 'paragraph', text: 'on sixty-seven' },
    });
    await createPageLinkedBlock(repos, {
      sourceId, sourceLocation: locationAt(sourceId, 12), kind: 'paragraph',
      content: { type: 'paragraph', text: 'elsewhere' },
    });
    await repos.workspaceStates.update(
      {
        ...imported.workspaceState,
        activeLocation: locationAt(sourceId, 67),
      },
      expectedRevision(imported.workspaceState.revision),
    );

    const resumed = await resumeSource(repos, sourceId);
    expect(resumed.nearbyBlocks).toHaveLength(1);
  });

  it('offers a resume choice when the positions differ (RA-023)', async () => {
    const imported = await importPdf(repos, { file: pdfFile() });
    const sourceId = imported.source.id;
    await repos.workspaceStates.update(
      {
        ...imported.workspaceState,
        activeLocation: locationAt(sourceId, 67),
        listenLocation: locationAt(sourceId, 82),
      },
      expectedRevision(imported.workspaceState.revision),
    );

    const resumed = await resumeSource(repos, sourceId);
    expect(resumed.offerResumeChoice).toBe(true);
    // Neither position is modified by resuming (RA-022).
    expect(resumed.workspaceState?.activeLocation.pdf?.page).toBe(67);
    expect(resumed.workspaceState?.listenLocation?.pdf?.page).toBe(82);
  });

  it('offers no choice when the positions agree (RA-024)', async () => {
    const imported = await importPdf(repos, { file: pdfFile() });
    const sourceId = imported.source.id;
    await repos.workspaceStates.update(
      {
        ...imported.workspaceState,
        activeLocation: locationAt(sourceId, 67),
        listenLocation: locationAt(sourceId, 67),
      },
      expectedRevision(imported.workspaceState.revision),
    );
    const resumed = await resumeSource(repos, sourceId);
    expect(resumed.offerResumeChoice).toBe(false);
  });

  it('throws for an unknown source', async () => {
    await expect(resumeSource(repos, id())).rejects.toThrow();
  });
});

// ─── promoteBlockToClaim ─────────────────────────────────────────

describe('promoteBlockToClaim', () => {
  async function makeBlock(text: string, page = 5) {
    const sourceId = id();
    const block = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, page),
      kind: 'claim',
      content: { type: 'claim', text },
    });
    return block;
  }

  it('creates a claim and links the block to it', async () => {
    const block = await makeBlock('Colonialism deforms the coloniser too.');
    const result = await promoteBlockToClaim(repos, { blockId: block.id });

    expect(result.alreadyPromoted).toBe(false);
    expect(result.claim.statement).toBe('Colonialism deforms the coloniser too.');
    expect(result.claim.originBlockIds).toEqual([block.id]);
    expect(result.block.epistemicClaimId).toBe(result.claim.id);
  });

  it('leaves the block as ordinary journal content', async () => {
    // Promotion links, it does not convert (ADR-0001 §4).
    const block = await makeBlock('x');
    const result = await promoteBlockToClaim(repos, { blockId: block.id });

    expect(result.block.id).toBe(block.id);
    expect(result.block.kind).toBe('claim');
    expect(result.block.content.type).toBe('claim');
    expect(result.block.rank).toBe(block.rank);
    expect(result.block.sourceLocation?.pdf?.page).toBe(5);
  });

  it('records where the claim was first made', async () => {
    const block = await makeBlock('x', 42);
    const result = await promoteBlockToClaim(repos, { blockId: block.id });
    expect(result.claim.primaryLocation?.pdf?.page).toBe(42);
  });

  it('is idempotent — re-promoting returns the same claim', async () => {
    const block = await makeBlock('x');
    const first = await promoteBlockToClaim(repos, { blockId: block.id });
    const second = await promoteBlockToClaim(repos, { blockId: block.id });

    expect(second.alreadyPromoted).toBe(true);
    expect(second.claim.id).toBe(first.claim.id);
    expect(await repos.claims.getAll()).toHaveLength(1);
  });

  it('accepts an overriding statement and confidence', async () => {
    const block = await makeBlock('rough phrasing');
    const result = await promoteBlockToClaim(repos, {
      blockId: block.id,
      statement: 'A sharper phrasing.',
      confidence: 'high',
      status: 'contested',
    });
    expect(result.claim.statement).toBe('A sharper phrasing.');
    expect(result.claim.confidence).toBe('high');
    expect(result.claim.status).toBe('contested');
  });

  it('promotes a quote using its quoted text', async () => {
    const sourceId = id();
    const block = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 8),
      kind: 'quote',
      content: { type: 'quote', quote: 'Violence is a cleansing force.' },
    });
    const result = await promoteBlockToClaim(repos, { blockId: block.id });
    expect(result.claim.statement).toBe('Violence is a cleansing force.');
  });

  it('refuses a block with nothing to assert', async () => {
    const sourceId = id();
    const divider = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 1),
      kind: 'divider',
      content: { type: 'divider' },
    });
    await expect(
      promoteBlockToClaim(repos, { blockId: divider.id }),
    ).rejects.toBeInstanceOf(BlockNotPromotableError);
  });

  it('refuses a deleted block', async () => {
    const block = await makeBlock('x');
    await repos.journals.softDeleteBlock(block.id, expectedRevision(block.revision));
    await expect(
      promoteBlockToClaim(repos, { blockId: block.id }),
    ).rejects.toBeInstanceOf(BlockNotPromotableError);
  });

  it('refuses an unknown block', async () => {
    await expect(
      promoteBlockToClaim(repos, { blockId: id() }),
    ).rejects.toBeInstanceOf(BlockNotPromotableError);
  });

  it('promotes nothing automatically', async () => {
    await makeBlock('an ordinary claim block');
    expect(await repos.claims.getAll()).toHaveLength(0);
  });
});

describe('linkBlockToExistingClaim', () => {
  it('attaches a second passage to one claim', async () => {
    // The reason promotion links rather than transforms: one claim,
    // asserted at several passages.
    const sourceA = id();
    const sourceB = id();
    const blockA = await createPageLinkedBlock(repos, {
      sourceId: sourceA,
      sourceLocation: locationAt(sourceA, 5),
      kind: 'claim',
      content: { type: 'claim', text: 'The same underlying claim.' },
    });
    const blockB = await createPageLinkedBlock(repos, {
      sourceId: sourceB,
      sourceLocation: locationAt(sourceB, 190),
      kind: 'claim',
      content: { type: 'claim', text: 'Stated again, elsewhere.' },
    });

    const { claim } = await promoteBlockToClaim(repos, { blockId: blockA.id });
    const linked = await linkBlockToExistingClaim(repos, blockB.id, claim.id);

    expect(linked.claim.originBlockIds).toHaveLength(2);
    expect(linked.claim.originBlockIds).toContain(blockA.id);
    expect(linked.claim.originBlockIds).toContain(blockB.id);
    expect(linked.block.epistemicClaimId).toBe(claim.id);
    expect(await repos.claims.getAll()).toHaveLength(1);
  });

  it('does not duplicate an origin block', async () => {
    const sourceId = id();
    const block = await createPageLinkedBlock(repos, {
      sourceId,
      sourceLocation: locationAt(sourceId, 5),
      kind: 'claim',
      content: { type: 'claim', text: 'x' },
    });
    const { claim } = await promoteBlockToClaim(repos, { blockId: block.id });
    const linked = await linkBlockToExistingClaim(repos, block.id, claim.id);
    expect(linked.claim.originBlockIds).toEqual([block.id]);
  });

  it('finds every claim originating from a block', async () => {
    const block = await makeBlockFor(repos);
    const { claim } = await promoteBlockToClaim(repos, { blockId: block.id });
    const found = await repos.claims.getByOriginBlock(block.id);
    expect(found.map((c) => c.id)).toEqual([claim.id]);
  });
});

async function makeBlockFor(r: MemoryRepositories) {
  const sourceId = id();
  return createPageLinkedBlock(r, {
    sourceId,
    sourceLocation: locationAt(sourceId, 1),
    kind: 'claim',
    content: { type: 'claim', text: 'x' },
  });
}
