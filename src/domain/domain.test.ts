/**
 * Domain Schema Validation Tests
 *
 * Verifies that Zod schemas correctly validate, reject, and
 * apply defaults for all domain entities.
 */
import { describe, it, expect } from 'vitest';
import {
  EntityIdSchema,
  ISODateTimeSchema,
  SourceLocationSchema,
  TextAnchorSchema,
  SourceTypeSchema,
} from '@domain/shared';
import {
  SourceSchema,
  BookDetailsSchema,
} from '@domain/sources/source.schemas';
import {
  JournalBlockSchema,
  BlockContentSchema,
} from '@domain/journals/journal.schemas';
import { AnnotationSchema } from '@domain/annotations/annotation.schemas';
import {
  ConnectionSchema,
  ReferenceSchema,
} from '@domain/connections/connection.schemas';
import {
  WorkspaceStateSchema,
} from '@domain/workspace/workspace.schemas';
import { createEntityId } from '@lib/id';

// ─── Helpers ─────────────────────────────────────────────────────

const now = new Date().toISOString();
const id = createEntityId;

function baseFields() {
  return { id: id(), createdAt: now, updatedAt: now, revision: 0 };
}

// ─── Shared Primitives ──────────────────────────────────────────

describe('EntityIdSchema', () => {
  it('accepts valid UUIDs', () => {
    expect(EntityIdSchema.safeParse(id()).success).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(EntityIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('accepts UUIDv7 so the generator can change without a migration', () => {
    // Zod's built-in .uuid() only allows versions 1-5 and would
    // reject this, foreclosing the v7 option the handoff names
    // (ADR-0001 §5).
    expect(
      EntityIdSchema.safeParse('018f3a5b-7c2d-7e1f-9a3b-4c5d6e7f8a9b').success,
    ).toBe(true);
  });

  it('accepts the nil UUID', () => {
    expect(
      EntityIdSchema.safeParse('00000000-0000-0000-0000-000000000000').success,
    ).toBe(true);
  });
});

describe('ISODateTimeSchema', () => {
  it('accepts ISO 8601 strings', () => {
    expect(ISODateTimeSchema.safeParse('2026-07-24T12:00:00.000Z').success).toBe(true);
  });

  it('rejects plain dates', () => {
    expect(ISODateTimeSchema.safeParse('2026-07-24').success).toBe(false);
  });
});

describe('SourceTypeSchema', () => {
  it('accepts valid types', () => {
    expect(SourceTypeSchema.safeParse('book').success).toBe(true);
    expect(SourceTypeSchema.safeParse('artwork').success).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(SourceTypeSchema.safeParse('video').success).toBe(false);
  });
});

describe('TextAnchorSchema', () => {
  it('accepts valid anchor with required fields', () => {
    const result = TextAnchorSchema.safeParse({
      page: 5,
      quote: 'The unexamined life is not worth living.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero or negative page', () => {
    expect(TextAnchorSchema.safeParse({ page: 0, quote: 'x' }).success).toBe(false);
    expect(TextAnchorSchema.safeParse({ page: -1, quote: 'x' }).success).toBe(false);
  });
});

describe('SourceLocationSchema', () => {
  it('accepts book location with PDF page', () => {
    const result = SourceLocationSchema.safeParse({
      sourceType: 'book',
      sourceId: id(),
      pdf: { page: 42 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts artwork location with region', () => {
    const result = SourceLocationSchema.safeParse({
      sourceType: 'artwork',
      sourceId: id(),
      artwork: { region: { x: 0.1, y: 0.2, width: 0.5, height: 0.3 } },
    });
    expect(result.success).toBe(true);
  });
});

// ─── Source ──────────────────────────────────────────────────────

describe('SourceSchema', () => {
  it('accepts valid source with defaults', () => {
    const result = SourceSchema.safeParse({
      ...baseFields(),
      type: 'book',
      title: 'Meditations',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.creatorIds).toEqual([]);
      expect(result.data.collectionIds).toEqual([]);
      expect(result.data.tagIds).toEqual([]);
    }
  });

  it('rejects empty title', () => {
    const result = SourceSchema.safeParse({
      ...baseFields(),
      type: 'book',
      title: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('BookDetailsSchema', () => {
  it('applies default status', () => {
    const result = BookDetailsSchema.safeParse({ sourceId: id() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentStatus).toBe('unread');
    }
  });

  it('does not carry a reading position', () => {
    // WorkspaceState.activeLocation is the single canonical reading
    // position. A copy here would be a second position that can
    // silently disagree with it (ADR-0001 §3).
    const result = BookDetailsSchema.parse({ sourceId: id() });
    expect('currentPage' in result).toBe(false);
    expect('currentChapter' in result).toBe(false);
  });
});

// ─── Journal ─────────────────────────────────────────────────────

describe('BlockContentSchema (discriminated union)', () => {
  it('accepts paragraph content', () => {
    const result = BlockContentSchema.safeParse({
      type: 'paragraph',
      text: 'Hello world',
    });
    expect(result.success).toBe(true);
  });

  it('accepts quote content', () => {
    const result = BlockContentSchema.safeParse({
      type: 'quote',
      quote: 'Cogito ergo sum.',
      anchor: { page: 3, quote: 'Cogito ergo sum.' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts definition content', () => {
    const result = BlockContentSchema.safeParse({
      type: 'definition',
      term: 'Eudaimonia',
      personalMeaning: 'A life of flourishing virtue.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown block type', () => {
    const result = BlockContentSchema.safeParse({
      type: 'unknown-type',
      text: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('rejects quote without required quote field', () => {
    const result = BlockContentSchema.safeParse({
      type: 'quote',
    });
    expect(result.success).toBe(false);
  });
});

describe('JournalBlockSchema', () => {
  it('accepts a valid block with source location', () => {
    const result = JournalBlockSchema.safeParse({
      ...baseFields(),
      journalId: id(),
      kind: 'paragraph',
      sourceLocation: {
        sourceType: 'book',
        sourceId: id(),
        pdf: { page: 5 },
      },
      rank: 'a0',
      content: { type: 'paragraph', text: 'My reflection on page 5.' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provenance).toBe('user');
      expect(result.data.conceptIds).toEqual([]);
    }
  });
});

// ─── Annotation ──────────────────────────────────────────────────

describe('AnnotationSchema', () => {
  it('accepts a canonical multi-rectangle text anchor', () => {
    const result = AnnotationSchema.safeParse({
      ...baseFields(),
      sourceId: id(),
      assetId: id(),
      page: 1,
      kind: 'highlight',
      anchor: {
        kind: 'text',
        quote: 'The selected passage',
        rects: [
          { x: 0.1, y: 0.2, width: 0.4, height: 0.04 },
          { x: 0.1, y: 0.25, width: 0.3, height: 0.04 },
        ],
        boundingRect: { x: 0.1, y: 0.2, width: 0.4, height: 0.09 },
      },
      style: { color: '#ffff00', opacity: 0.3 },
    });
    expect(result.success).toBe(true);
  });
});

// ─── Connection ──────────────────────────────────────────────────

describe('ReferenceSchema', () => {
  it('accepts source reference', () => {
    const result = ReferenceSchema.safeParse({ type: 'source', id: id() });
    expect(result.success).toBe(true);
  });

  it('accepts block reference', () => {
    const result = ReferenceSchema.safeParse({ type: 'block', id: id() });
    expect(result.success).toBe(true);
  });

  it('accepts location reference', () => {
    const result = ReferenceSchema.safeParse({
      type: 'location',
      location: { sourceType: 'book', sourceId: id(), pdf: { page: 5 } },
    });
    expect(result.success).toBe(true);
  });
});

describe('ConnectionSchema', () => {
  it('accepts valid connection with defaults', () => {
    const result = ConnectionSchema.safeParse({
      ...baseFields(),
      from: { type: 'block', id: id() },
      to: { type: 'block', id: id() },
      relationship: 'supports',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe('directed');
    }
  });
});

// ─── Workspace State ─────────────────────────────────────────────

describe('WorkspaceStateSchema', () => {
  it('accepts valid state with defaults', () => {
    const sourceId = id();
    const result = WorkspaceStateSchema.safeParse({
      ...baseFields(),
      sourceId,
      activeLocation: {
        sourceType: 'book',
        sourceId,
        pdf: { page: 42 },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceView.mode).toBe('continuous');
      expect(result.data.sourceView.zoom).toBe(1);
      expect(result.data.layout.mode).toBe('split');
      expect(result.data.layout.splitRatio).toBe(0.7);
      expect(result.data.layout.rightWorkspace).toBe('write');
      expect(result.data.whiteboard).toEqual({
        viewport: { x: 0, y: 0, zoom: 1 },
        layout: {},
      });
    }
  });

  it('decodes legacy and current workspace layout shapes without losing projections', () => {
    const sourceId = id();
    const legacy = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: {
        sourceType: 'book',
        sourceId,
        pdf: { page: 7 },
      },
      layout: { mode: 'split', splitRatio: 0.35 },
    });
    expect(legacy.layout).toMatchObject({
      mode: 'split',
      splitRatio: 0.35,
      rightWorkspace: 'write',
    });

    const restored = WorkspaceStateSchema.parse({
      ...legacy,
      layout: {
        ...legacy.layout,
        mode: 'journal-focus',
        splitRatio: 0.4,
        rightWorkspace: 'whiteboard',
      },
    });
    expect(restored.layout).toMatchObject({
      mode: 'journal-focus',
      splitRatio: 0.4,
      rightWorkspace: 'whiteboard',
    });
  });

  it('serializes and restores whiteboard viewport plus block layout without content', () => {
    const sourceId = id();
    const blockId = id();
    const restored = WorkspaceStateSchema.parse(JSON.parse(JSON.stringify(
      WorkspaceStateSchema.parse({
        ...baseFields(),
        sourceId,
        activeLocation: { sourceType: 'book', sourceId, pdf: { page: 12 } },
        whiteboard: {
          viewport: { x: -240, y: 95, zoom: 2.25 },
          layout: { [blockId]: { x: 1800, y: -700 } },
        },
      }),
    )));

    expect(restored.whiteboard.viewport).toEqual({ x: -240, y: 95, zoom: 2.25 });
    expect(restored.whiteboard.layout[blockId]).toEqual({ x: 1800, y: -700 });
    expect(restored.whiteboard).not.toHaveProperty('blocks');
    expect(restored.whiteboard).not.toHaveProperty('content');
  });
});
