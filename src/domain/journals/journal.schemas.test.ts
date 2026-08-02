import { describe, it, expect } from 'vitest';
import { JournalBlockSchema, UpdateBlockInputSchema } from './journal.schemas';

describe('Journal Block Zod Schemas', () => {
  describe('Block Consistency (Finding 4)', () => {
    const validBase = {
      id: '12345678-1234-1234-1234-123456789012',
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
      revision: 1,
      journalId: '12345678-1234-1234-1234-123456789013',
      rank: '0|h00000:',
    };

    const kinds = [
      'paragraph',
      'heading',
      'quote',
      'question',
      'claim',
      'evidence',
      'objection',
      'definition',
      'drawing',
      'argument-map',
      'image',
      'connection-embed',
      'divider',
      'callout',
    ] as const;

    const validContents: Record<string, unknown> = {
      paragraph: { type: 'paragraph', text: 'hello' },
      heading: { type: 'heading', level: 2, text: 'Title' },
      quote: { type: 'quote', quote: 'text' },
      question: { type: 'question', text: 'what?' },
      claim: { type: 'claim', text: 'claim text' },
      evidence: { type: 'evidence', text: 'evidence text' },
      objection: { type: 'objection', text: 'objection text' },
      definition: { type: 'definition', term: 'term' },
      drawing: { type: 'drawing', drawingData: {} },
      'argument-map': { type: 'argument-map' },
      image: { type: 'image' },
      'connection-embed': { type: 'connection-embed', connectionId: '12345678-1234-1234-1234-123456789014' },
      divider: { type: 'divider' },
      callout: { type: 'callout', text: 'callout text' },
    };

    kinds.forEach((kind) => {
      it(`accepts ${kind} when kind matches content.type`, () => {
        const block = {
          ...validBase,
          kind,
          content: validContents[kind],
        };
        const parsed = JournalBlockSchema.parse(block);
        expect(parsed.kind).toBe(kind);
        expect(parsed.content.type).toBe(kind);
      });

      it(`rejects ${kind} when kind does not match content.type`, () => {
        const wrongKind = kind === 'paragraph' ? 'heading' : 'paragraph';
        const block = {
          ...validBase,
          kind,
          content: validContents[wrongKind],
        };
        const result = JournalBlockSchema.safeParse(block);
        expect(result.success).toBe(false);
        if (!result.success) {
          const error = result.error.issues.find((i) => i.path.includes('kind'));
          expect(error?.message).toMatch(/Block kind must match content type/);
        }
      });
    });

    it('rejects UpdateBlockInput when kind and content are provided but do not match', () => {
      const result = UpdateBlockInputSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789012',
        kind: 'paragraph',
        content: { type: 'heading', level: 2, text: 'Title' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((i) => i.path.includes('kind'));
        expect(error?.message).toMatch(/Block kind must match content type when both are provided/);
      }
    });

    it('accepts UpdateBlockInput when only kind is provided', () => {
      const result = UpdateBlockInputSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789012',
        kind: 'paragraph',
      });
      expect(result.success).toBe(true);
    });

    it('accepts UpdateBlockInput when only content is provided', () => {
      const result = UpdateBlockInputSchema.safeParse({
        id: '12345678-1234-1234-1234-123456789012',
        content: { type: 'paragraph', text: 'hi' },
      });
      expect(result.success).toBe(true);
    });
  });
});
