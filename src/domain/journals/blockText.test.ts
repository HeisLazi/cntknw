/**
 * `text` is derived from `doc` — checked, not asserted.
 *
 * ADR-0004 §1 turns "these two fields will agree" from an intention
 * into a structural property. These are the tests that hold it there:
 * every write path applies the transform, and the transform is
 * documented by its behaviour rather than by prose.
 */
import { describe, it, expect } from 'vitest';
import { CreateBlockInputSchema, UpdateBlockInputSchema } from './journal.schemas';
import { isEmptyDoc, plainTextOf } from './blockText';
import { createEntityId } from '@lib/id';

const journalId = createEntityId();
const blockId = createEntityId();

/** A one-paragraph ProseMirror doc with the given text and optional marks. */
function docOf(text: string): unknown {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

describe('plainTextOf', () => {
  it('returns the leaf text of a simple paragraph', () => {
    expect(plainTextOf(docOf('Decolonisation is always a violent event.'))).toBe(
      'Decolonisation is always a violent event.',
    );
  });

  it('joins runs inside a paragraph without gaps', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The ' },
            { type: 'text', text: 'coloniser', marks: [{ type: 'em' }] },
            { type: 'text', text: ' is deformed too.' },
          ],
        },
      ],
    };
    expect(plainTextOf(doc)).toBe('The coloniser is deformed too.');
  });

  it('separates block-level nodes so two paragraphs are not one word', () => {
    // Without this, search would find "endcolonisation" where two
    // paragraphs meet, and Read Aloud would say one long sentence.
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'end' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'colonisation' }] },
      ],
    };
    expect(plainTextOf(doc)).toBe('end\ncolonisation');
  });

  it('returns empty for a doc with no leaves', () => {
    expect(plainTextOf({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
    expect(plainTextOf(null)).toBe('');
    expect(plainTextOf(undefined)).toBe('');
    expect(plainTextOf(42)).toBe('');
  });
});

describe('isEmptyDoc', () => {
  it('treats an empty paragraph as empty rather than as content', () => {
    // A ProseMirror "empty doc" is a doc containing one empty
    // paragraph. Treating that as content is how a journal fills up
    // with blank blocks nobody typed.
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
  });

  it('recognises whitespace-only content as empty', () => {
    expect(isEmptyDoc(docOf('   \n  '))).toBe(true);
  });

  it('recognises real content as content', () => {
    expect(isEmptyDoc(docOf('one word'))).toBe(false);
  });
});

describe('deriveBlockText transform on write inputs', () => {
  const baseBlock = {
    journalId,
    kind: 'paragraph' as const,
    rank: 'a',
  };

  it('overwrites a mismatched `text` supplied alongside a `doc`', () => {
    // The whole point of the transform. A caller cannot make the two
    // fields disagree, because whatever text is supplied is replaced.
    const parsed = CreateBlockInputSchema.parse({
      ...baseBlock,
      content: {
        type: 'paragraph',
        doc: docOf('The stored words.'),
        text: 'Something else entirely.',
      },
    });
    expect(parsed.content.type).toBe('paragraph');
    if (parsed.content.type === 'paragraph') {
      expect(parsed.content.text).toBe('The stored words.');
    }
  });

  it('leaves `text` alone when no `doc` is supplied', () => {
    // A legacy record or a very simple caller may store plain text
    // without a rich document. That is still allowed; the transform
    // only intervenes when it has a doc to derive from.
    const parsed = CreateBlockInputSchema.parse({
      ...baseBlock,
      content: { type: 'paragraph', text: 'Plain text, no editor.' },
    });
    if (parsed.content.type === 'paragraph') {
      expect(parsed.content.text).toBe('Plain text, no editor.');
      expect(parsed.content.doc).toBeUndefined();
    }
  });

  it('applies to updates as well as creates, because a stale `text` is a bug either way', () => {
    const parsed = UpdateBlockInputSchema.parse({
      id: blockId,
      content: {
        type: 'paragraph',
        doc: docOf('Edited.'),
        text: 'stale',
      },
    });
    if (parsed.content?.type === 'paragraph') {
      expect(parsed.content.text).toBe('Edited.');
    } else {
      throw new Error('paragraph content expected');
    }
  });

  it('does not touch non-paragraph content', () => {
    // Other block kinds carry their own fields; nothing to derive.
    const parsed = CreateBlockInputSchema.parse({
      ...baseBlock,
      kind: 'quote',
      content: {
        type: 'quote',
        quote: 'Violence is a cleansing force.',
      },
    });
    if (parsed.content.type === 'quote') {
      expect(parsed.content.quote).toBe('Violence is a cleansing force.');
    }
  });
});
