/**
 * Plain text derived from a rich document.
 *
 * ADR-0004 makes `doc` authoritative and `text` a derived projection.
 * This is the single function that performs the derivation, so the
 * two representations cannot disagree: there is no second place where
 * `text` is computed, and no place at all where it is authored.
 *
 * Pure and dependency-free on purpose — it runs at the write boundary
 * for every block, and it must be usable from a migration, a worker
 * and a test without dragging an editor in with it.
 */

/**
 * A ProseMirror-shaped node, described structurally rather than by
 * importing ProseMirror's types.
 *
 * The domain must not depend on the editor. If ProseMirror is ever
 * replaced, `doc` stays a JSON tree of nodes with `text` leaves and
 * this function keeps working — which is most of the reason the
 * domain stores JSON rather than an editor's own object graph.
 */
interface RichNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

function isRichNode(value: unknown): value is RichNode {
  return typeof value === 'object' && value !== null;
}

/**
 * Extract readable text from a rich document.
 *
 * Block-level nodes are separated by a newline so that two paragraphs
 * do not run together into one false word — which would corrupt both
 * search results and Read Aloud's sentence segmentation.
 */
export function plainTextOf(doc: unknown): string {
  if (!isRichNode(doc)) return '';

  const parts: string[] = [];

  const walk = (node: unknown): void => {
    if (!isRichNode(node)) return;

    if (typeof node.text === 'string') {
      parts.push(node.text);
      return;
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }

    // A hard break or a block boundary separates words.
    if (node.type === 'hard_break') parts.push('\n');
  };

  if (Array.isArray(doc.content)) {
    for (const block of doc.content) {
      const before = parts.length;
      walk(block);
      if (parts.length > before) parts.push('\n');
    }
  } else {
    walk(doc);
  }

  return parts.join('').replace(/\n+$/, '');
}

/**
 * True when a document contains nothing a reader would see.
 *
 * An "empty" ProseMirror document is not an empty object — it is a
 * doc containing one empty paragraph. Treating that as content is how
 * a journal fills up with blank blocks nobody typed.
 */
export function isEmptyDoc(doc: unknown): boolean {
  return plainTextOf(doc).trim().length === 0;
}
