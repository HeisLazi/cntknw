import { Schema } from 'prosemirror-model';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * The editor schema — deliberately, aggressively small.
 *
 * **ProseMirror edits one block's inline content. It does not own the
 * journal.** That is the load-bearing decision of the editor spike
 * (ADR-0004 §3), and this schema is how it is enforced: there are no
 * block-level nodes here beyond a single paragraph, so a ProseMirror
 * document *cannot* represent a heading, a list, or a second
 * paragraph. Pressing Enter cannot split a block, because the schema
 * has nowhere to split into.
 *
 * If ProseMirror owned the whole journal it would immediately fight
 * the model everything else depends on: blocks are separate records
 * with their own id, rank, revision, source location, concept links
 * and soft-delete state (INV-003, INV-004, INV-006). A single
 * ProseMirror document would either lose those or force them into
 * node attributes, where a repository cannot query them and a
 * `ConcurrencyGuard` cannot protect them.
 *
 * Marks are what the editor is genuinely for. A philosophy journal
 * needs to italicise a term, stress a word, and set a phrase in
 * monospace for a citation — losing those is a real loss, and they
 * are exactly what plain `<textarea>` cannot do and hand-rolled
 * `contenteditable` gets wrong.
 */
export const blockSchema = new Schema({
  nodes: {
    doc: { content: 'paragraph' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
  marks: {
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0],
    },
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        { style: 'font-weight=bold' },
        { style: 'font-weight=700' },
      ],
      toDOM: () => ['strong', 0],
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0],
    },
  },
});

/** An empty document, for a block that has just been created. */
export function emptyDoc(): ProseMirrorNode {
  return blockSchema.node('doc', null, [blockSchema.node('paragraph')]);
}

/**
 * Rebuild a document from stored JSON.
 *
 * Stored content is not trusted: it may have been written by an older
 * schema, by a migration, or by a bug. A parse failure returns an
 * empty document with the text preserved as plain content rather than
 * throwing — a block whose formatting cannot be restored should still
 * show its words, because losing the sentence is worse than losing
 * the italics.
 */
export function docFromJSON(doc: unknown, fallbackText: string): ProseMirrorNode {
  if (doc && typeof doc === 'object') {
    try {
      return blockSchema.nodeFromJSON(doc as Parameters<typeof blockSchema.nodeFromJSON>[0]);
    } catch {
      // Fall through to the plain-text reconstruction below.
    }
  }
  if (!fallbackText) return emptyDoc();
  return blockSchema.node('doc', null, [
    blockSchema.node('paragraph', null, [blockSchema.text(fallbackText)]),
  ]);
}
