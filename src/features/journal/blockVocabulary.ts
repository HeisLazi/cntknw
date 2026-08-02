import type { BlockKind } from '@domain/index';

/**
 * The marginal vocabulary — ADR-0006 §2.
 *
 * **Fourteen block types, zero type-specific hues.** PDD §9.4 asks for
 * one accent and warns that blocks must not become a rainbow, so the
 * distinction between a claim and an objection is carried by a mark in
 * the margin, an indent, a rule texture and whitespace — never by
 * colour. The prose column then carries only prose.
 *
 * `mark` is what stands in the margin lane. A short uppercase word for
 * the argumentative kinds, because "CLAIM" is unambiguous where an
 * icon would need learning; a glyph where a glyph genuinely reads
 * (`?` for a question); nothing at all for the kinds whose typography
 * already tells you what they are.
 */
export interface BlockVocabularyEntry {
  kind: BlockKind;
  /** Human name, for menus and assistive technology. */
  label: string;
  /** What appears in the margin lane. Empty means the margin stays clear. */
  mark: string;
  /** Whether the mark is a word (letter-spaced caps) or a glyph. */
  markStyle: 'word' | 'glyph' | 'none';
  /** Whether its content is edited as prose in a BlockEditor. */
  textual: boolean;
  /** One line, shown in the kind menu. Says what the kind is *for*. */
  hint: string;
}

export const BLOCK_VOCABULARY: readonly BlockVocabularyEntry[] = [
  {
    kind: 'paragraph',
    label: 'Paragraph',
    mark: '',
    markStyle: 'none',
    textual: true,
    hint: 'Ordinary writing.',
  },
  {
    kind: 'heading',
    label: 'Heading',
    mark: '',
    markStyle: 'none',
    textual: true,
    hint: 'A division in your own argument.',
  },
  {
    kind: 'quote',
    label: 'Quote',
    mark: '',
    markStyle: 'none',
    textual: true,
    hint: "The source's words, not yours.",
  },
  {
    kind: 'question',
    label: 'Question',
    mark: '?',
    markStyle: 'glyph',
    textual: true,
    hint: 'Something unresolved, to return to.',
  },
  {
    kind: 'claim',
    label: 'Claim',
    mark: 'CLAIM',
    markStyle: 'word',
    textual: true,
    hint: 'A position you are asserting.',
  },
  {
    kind: 'evidence',
    label: 'Evidence',
    mark: 'EVIDENCE',
    markStyle: 'word',
    textual: true,
    hint: 'Support for a claim.',
  },
  {
    kind: 'objection',
    label: 'Objection',
    mark: 'OBJECTION',
    markStyle: 'word',
    textual: true,
    hint: 'A reason to doubt a claim.',
  },
  {
    kind: 'callout',
    label: 'Callout',
    mark: '',
    markStyle: 'none',
    textual: true,
    hint: 'Something to notice on re-reading.',
  },
  {
    kind: 'definition',
    label: 'Definition',
    mark: '',
    markStyle: 'none',
    textual: false,
    hint: 'A term, and what it means here.',
  },
  {
    kind: 'divider',
    label: 'Divider',
    mark: '',
    markStyle: 'none',
    textual: false,
    hint: 'A break in the page.',
  },
  {
    kind: 'image',
    label: 'Image',
    mark: '',
    markStyle: 'none',
    textual: false,
    hint: 'A plate, with a caption.',
  },
  {
    kind: 'drawing',
    label: 'Drawing',
    mark: '',
    markStyle: 'none',
    textual: false,
    hint: 'Something drawn, kept editable.',
  },
  {
    kind: 'connection-embed',
    label: 'Connection',
    mark: '→',
    markStyle: 'glyph',
    textual: false,
    hint: 'A link to another passage.',
  },
  {
    kind: 'argument-map',
    label: 'Argument map',
    mark: '',
    markStyle: 'none',
    textual: false,
    hint: 'The same blocks, as a map.',
  },
];

const BY_KIND = new Map(BLOCK_VOCABULARY.map((entry) => [entry.kind, entry]));

export function vocabularyFor(kind: BlockKind): BlockVocabularyEntry {
  const entry = BY_KIND.get(kind);
  if (entry) return entry;
  // A kind added to the domain without being given a marginal mark.
  // Falling back keeps the journal rendering; the missing entry is a
  // gap in the vocabulary, not a reason to lose somebody's writing.
  return {
    kind,
    label: kind,
    mark: '',
    markStyle: 'none',
    textual: true,
    hint: '',
  };
}

/**
 * The kinds offered in the change menu, in the order they are offered.
 *
 * Only the prose kinds. The others need content that cannot be
 * conjured from a sentence — a drawing, an image, a term and its
 * senses — and `canChangeKind` refuses those conversions rather than
 * destroying what is there. Offering them and then refusing would be
 * a menu that lies.
 */
export const CHANGEABLE_KINDS: readonly BlockVocabularyEntry[] =
  BLOCK_VOCABULARY.filter((entry) => entry.textual);
