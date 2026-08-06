/**
 * Transform rather than recreate — PDD §7.5.
 *
 * The rules being tested are about what a transform must NOT do:
 * must not lose the words, must not fabricate structure the user
 * never authored, and must not silently discard content it cannot
 * carry.
 */
import { describe, it, expect } from 'vitest';
import { canChangeKind, contentForKind, textOfContent } from './transform';
import { BlockContentSchema } from './journal.schemas';
import type { BlockContent } from './journal.schemas';

const parse = (input: unknown): BlockContent => BlockContentSchema.parse(input);
const emptyDrawing = {
  type: 'drawing' as const,
  drawingData: { version: 1 as const, width: 800, height: 600, strokes: [] },
};
const drawingWithStroke = {
  type: 'drawing' as const,
  drawingData: {
    version: 1 as const,
    width: 800,
    height: 600,
    strokes: [{
      id: 'stroke-one',
      color: 'var(--cn-palette-ink-400)',
      width: 3,
      points: [{ x: 1, y: 1 }, { x: 20, y: 20 }],
    }],
  },
};

describe('textOfContent', () => {
  it('reads the text of every prose kind', () => {
    expect(textOfContent(parse({ type: 'paragraph', text: 'a' }))).toBe('a');
    expect(textOfContent(parse({ type: 'heading', text: 'b' }))).toBe('b');
    expect(textOfContent(parse({ type: 'question', text: 'c' }))).toBe('c');
    expect(textOfContent(parse({ type: 'claim', text: 'd' }))).toBe('d');
    expect(textOfContent(parse({ type: 'evidence', text: 'e' }))).toBe('e');
    expect(textOfContent(parse({ type: 'objection', text: 'f' }))).toBe('f');
    expect(textOfContent(parse({ type: 'callout', text: 'g' }))).toBe('g');
    expect(textOfContent(parse({ type: 'quote', quote: 'h' }))).toBe('h');
  });

  it('prefers the rich document over the derived text', () => {
    // `doc` is authoritative (ADR-0004). Reading it means a transform
    // never loses an edit that has not yet been projected to `text`.
    const content = parse({
      type: 'paragraph',
      text: 'stale projection',
      doc: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'the real words' }] },
        ],
      },
    });
    expect(textOfContent(content)).toBe('the real words');
  });

  it('returns empty for kinds that hold no prose', () => {
    expect(textOfContent(parse({ type: 'divider' }))).toBe('');
    expect(
      textOfContent(parse(emptyDrawing)),
    ).toBe('');
  });
});

describe('canChangeKind', () => {
  const paragraph = parse({ type: 'paragraph', text: 'Is violence cleansing?' });

  it('allows any prose kind to become any other', () => {
    for (const to of [
      'heading',
      'question',
      'claim',
      'evidence',
      'objection',
      'callout',
      'quote',
    ] as const) {
      expect(canChangeKind(paragraph, to).ok, `paragraph -> ${to}`).toBe(true);
    }
  });

  it('allows a no-op change to the same kind', () => {
    expect(canChangeKind(paragraph, 'paragraph').ok).toBe(true);
  });

  it('refuses to turn a drawing into prose, and says what would be lost', () => {
    // A user who loses a drawing to a menu click has been robbed by
    // the interface. Being told costs one click and keeps the work.
    const drawing = parse(drawingWithStroke);
    const verdict = canChangeKind(drawing, 'paragraph');
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain('discard the drawing');
      // The message says what happens, not that something is invalid.
      expect(verdict.reason).not.toMatch(/invalid|error|not allowed/i);
    }
  });

  it('refuses to turn prose into a kind whose content it cannot supply', () => {
    for (const to of ['drawing', 'image', 'definition', 'argument-map'] as const) {
      const verdict = canChangeKind(paragraph, to);
      expect(verdict.ok, `paragraph -> ${to}`).toBe(false);
    }
  });

  it('refuses drawing transformations in both directions', () => {
    expect(canChangeKind(parse(drawingWithStroke), 'paragraph').ok).toBe(false);
    expect(canChangeKind(paragraph, 'drawing').ok).toBe(false);
  });

  it('refuses prose to divider, because that discards the words', () => {
    const verdict = canChangeKind(paragraph, 'divider');
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('discard the text');
  });
});

describe('contentForKind', () => {
  const paragraph = parse({
    type: 'paragraph',
    text: 'Decolonisation is always a violent event.',
  });

  it('carries the words across', () => {
    const next = contentForKind(paragraph, 'question');
    expect(next).toEqual({
      type: 'question',
      text: 'Decolonisation is always a violent event.',
    });
  });

  it('leaves defaults to the schema rather than duplicating them', () => {
    // ADR-0001 §2: constructing defaults here would let them drift
    // from the schema that actually applies them.
    const input = contentForKind(paragraph, 'question');
    expect('resolved' in input).toBe(false);
    // The schema supplies it on the way in.
    expect(parse(input)).toMatchObject({ resolved: false });
  });

  it('does not fabricate a rich document when becoming a paragraph', () => {
    // A synthesised ProseMirror doc would claim a structure the user
    // never authored. The editor rebuilds one from the text on open.
    const heading = parse({ type: 'heading', text: 'On Violence' });
    const next = contentForKind(heading, 'paragraph');
    expect(next).toEqual({ type: 'paragraph', text: 'On Violence' });
    expect('doc' in next).toBe(false);
  });

  it('does not fabricate a source anchor when becoming a quote', () => {
    // The user wrote this; they did not quote it. Attaching a source
    // anchor would be a fabricated citation — the worst possible lie
    // for a study tool to tell.
    const next = contentForKind(paragraph, 'quote');
    expect(next).toEqual({
      type: 'quote',
      quote: 'Decolonisation is always a violent event.',
    });
    expect('anchor' in next).toBe(false);
  });

  it('round-trips through the schema for every allowed prose target', () => {
    for (const to of [
      'paragraph',
      'heading',
      'question',
      'claim',
      'evidence',
      'objection',
      'callout',
      'quote',
    ] as const) {
      const input = contentForKind(paragraph, to);
      expect(() => parse(input), `paragraph -> ${to}`).not.toThrow();
      expect(parse(input).type).toBe(to);
    }
  });

  it('throws rather than destroying content when the caller forgot to check', () => {
    const drawing = parse(emptyDrawing);
    expect(() => contentForKind(drawing, 'paragraph')).toThrow(/discard the drawing/);
  });
});
