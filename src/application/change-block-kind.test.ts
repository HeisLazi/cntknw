/**
 * Transform rather than recreate, at the repository boundary.
 *
 * `transform.test.ts` covers the pure content mapping. These cover
 * what only a repository can show: that identity, rank, location,
 * revision history and promotion survive the change — because
 * recreating the block would break every connection pointing at it,
 * and a severed backlink is not noticed until it is needed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import { expectedRevision } from '@data/repositories/concurrency';
import { RevisionConflictError } from '@data/errors';
import { changeBlockKind, BlockKindChangeRefused } from './change-block-kind';
import { createEntityId } from '@lib/id';

let repositories: MemoryRepositories;
const sourceId = createEntityId();

const at = (page: number) => ({
  sourceType: 'book' as const,
  sourceId,
  pdf: { page },
});

async function makeBlock(text = 'Is violence cleansing?') {
  const journal = await repositories.journals.getOrCreateJournalForSource(
    sourceId,
    'J',
  );
  const block = await repositories.journals.createBlock({
    journalId: journal.id,
    kind: 'paragraph',
    rank: 'm',
    sourceLocation: at(42),
    content: { type: 'paragraph', text },
  });
  return { journal, block };
}

beforeEach(() => {
  repositories = createMemoryRepositories();
});

describe('changeBlockKind', () => {
  it('keeps the block\'s identity, rank and location', () => {
    // The reason this is a transform and not a delete-and-create.
    return (async () => {
      const { block } = await makeBlock();
      const { block: changed } = await changeBlockKind(
        repositories,
        block.id,
        'question',
      );

      expect(changed.id).toBe(block.id);
      expect(changed.rank).toBe(block.rank);
      expect(changed.createdAt).toBe(block.createdAt);
      expect(changed.sourceLocation?.pdf?.page).toBe(42);
      expect(changed.kind).toBe('question');
      expect(changed.content.type).toBe('question');
    })();
  });

  it('carries the words across', async () => {
    const { block } = await makeBlock('Decolonisation is a violent event.');
    const { block: changed } = await changeBlockKind(
      repositories,
      block.id,
      'claim',
    );
    expect(changed.content).toMatchObject({
      type: 'claim',
      text: 'Decolonisation is a violent event.',
    });
  });

  it('continues the revision history rather than restarting it', async () => {
    // A recreated block would be at revision 0 and would have lost
    // the fact that it was ever anything else.
    const { block } = await makeBlock();
    const { block: changed } = await changeBlockKind(
      repositories,
      block.id,
      'question',
    );
    expect(changed.revision).toBe(block.revision + 1);
  });

  it('preserves a promotion to an epistemic claim', async () => {
    // `epistemicClaimId` is what makes one claim assertable from
    // several passages (ADR-0001 §4). Losing it on a kind change
    // would quietly orphan the claim.
    const { block } = await makeBlock();
    const claim = await repositories.claims.create({
      statement: 'x',
      originBlockIds: [block.id],
    });
    const linked = await repositories.journals.updateBlock(
      { id: block.id, epistemicClaimId: claim.id },
      expectedRevision(block.revision),
    );

    const { block: changed } = await changeBlockKind(
      repositories,
      linked.id,
      'claim',
    );
    expect(changed.epistemicClaimId).toBe(claim.id);
  });

  it('leaves connections pointing at the block intact (INV-007)', async () => {
    const { block } = await makeBlock();
    const other = createEntityId();
    await repositories.connections.create({
      from: { type: 'block', id: other },
      to: { type: 'block', id: block.id },
      relationship: 'supports',
    });

    await changeBlockKind(repositories, block.id, 'question');

    // The backlink still resolves — because the block still exists.
    const backlinks = await repositories.connections.getBacklinks({
      type: 'block',
      id: block.id,
    });
    expect(backlinks).toHaveLength(1);
  });

  it('is a no-op when the block is already of that kind', async () => {
    const { block } = await makeBlock();
    const result = await changeBlockKind(repositories, block.id, 'paragraph');
    expect(result.unchanged).toBe(true);
    expect(result.block.revision).toBe(block.revision);
  });

  it('refuses a change that would destroy content, and says what', async () => {
    const journal = await repositories.journals.getOrCreateJournalForSource(
      sourceId,
      'J',
    );
    const drawing = await repositories.journals.createBlock({
      journalId: journal.id,
      kind: 'drawing',
      rank: 'a',
      content: {
        type: 'drawing',
        drawingData: {
          version: 1,
          width: 800,
          height: 600,
          strokes: [{
            id: 'stroke-one',
            color: 'var(--cn-palette-ink-400)',
            width: 3,
            points: [{ x: 1, y: 2 }, { x: 30, y: 40 }],
          }],
        },
      },
    });

    await expect(
      changeBlockKind(repositories, drawing.id, 'paragraph'),
    ).rejects.toBeInstanceOf(BlockKindChangeRefused);

    // And the drawing is untouched.
    const stored = await repositories.journals.getBlockById(drawing.id);
    expect(stored?.kind).toBe('drawing');
    expect(stored?.revision).toBe(0);
  });

  it('refuses a deleted block', async () => {
    const { block } = await makeBlock();
    await repositories.journals.softDeleteBlock(
      block.id,
      expectedRevision(block.revision),
    );
    await expect(
      changeBlockKind(repositories, block.id, 'question'),
    ).rejects.toBeInstanceOf(BlockKindChangeRefused);
  });

  it('refuses an unknown block', async () => {
    await expect(
      changeBlockKind(repositories, createEntityId(), 'question'),
    ).rejects.toBeInstanceOf(BlockKindChangeRefused);
  });

  it('rejects a stale guard rather than overwriting a newer edit', async () => {
    // A kind menu can sit open for as long as the user likes, so the
    // read-then-write window here is real — exactly ADR-0003's case.
    const { block } = await makeBlock();
    await repositories.journals.updateBlock(
      { id: block.id, content: { type: 'paragraph', text: 'edited elsewhere' } },
      expectedRevision(block.revision),
    );

    await expect(
      changeBlockKind(repositories, block.id, 'question', expectedRevision(0)),
    ).rejects.toBeInstanceOf(RevisionConflictError);

    const stored = await repositories.journals.getBlockById(block.id);
    expect(stored?.kind).toBe('paragraph');
  });
});
