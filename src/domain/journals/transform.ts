/**
 * Changing a block's kind without recreating it.
 *
 * PDD §7.5 — *transform rather than recreate*. A paragraph that turns
 * out to be a question becomes a question **in place**: same id, same
 * rank, same source location, same revision history, same backlinks,
 * same promotion to an epistemic claim if it had one. Deleting the
 * block and making a new one would break every one of those, and
 * every connection pointing at it (INV-007).
 *
 * The one thing that must carry across is the words. Everything else
 * about a block's content is specific to its kind, and inventing
 * values for the target kind's fields would be fabrication — so this
 * carries the text, applies the target's declared defaults, and drops
 * the rest.
 *
 * Not all kinds are text. Converting a drawing to a paragraph cannot
 * preserve the drawing, and the honest response is to refuse rather
 * than to silently discard it — see `canChangeKind`.
 */
import type { BlockContent, BlockContentInput, BlockKind } from './journal.schemas';
import { plainTextOf } from './blockText';

/**
 * Kinds whose content is essentially a passage of prose.
 *
 * These convert freely between one another because the text is the
 * content. Everything outside this set carries data that prose cannot
 * represent.
 */
const TEXTUAL_KINDS = new Set<BlockKind>([
  'paragraph',
  'heading',
  'question',
  'claim',
  'evidence',
  'objection',
  'callout',
  'quote',
]);

/** The readable text of any block, whatever its kind. */
export function textOfContent(content: BlockContent): string {
  switch (content.type) {
    case 'paragraph':
      // `doc` is authoritative and `text` is derived from it
      // (ADR-0004), so either answers — but preferring `doc` means a
      // transform never loses a change that has not yet been
      // projected down.
      return content.doc ? plainTextOf(content.doc) : content.text;
    case 'heading':
    case 'question':
    case 'claim':
    case 'evidence':
    case 'objection':
    case 'callout':
      return content.text;
    case 'quote':
      return content.quote;
    case 'definition':
      return content.personalMeaning ?? content.sourceMeaning ?? content.term;
    case 'image':
      return content.caption ?? content.alt ?? '';
    default:
      // divider, drawing, argument-map, connection-embed: no prose.
      return '';
  }
}

export interface KindChangeRefusal {
  ok: false;
  /** Shown to the user. Says what would be lost, not "invalid". */
  reason: string;
}

export interface KindChangeAllowed {
  ok: true;
}

export type KindChangeVerdict = KindChangeAllowed | KindChangeRefusal;

/**
 * Whether a kind change can be made without destroying content.
 *
 * Refuses rather than silently discarding. A user who turns a drawing
 * into a paragraph and loses the drawing has been robbed by the
 * interface; being told "that would discard the drawing" costs one
 * click and keeps the work.
 */
export function canChangeKind(from: BlockContent, to: BlockKind): KindChangeVerdict {
  if (from.type === to) return { ok: true };

  if (TEXTUAL_KINDS.has(from.type) && TEXTUAL_KINDS.has(to)) return { ok: true };

  // Leaving a non-textual kind means abandoning data prose cannot hold.
  switch (from.type) {
    case 'drawing':
      return {
        ok: false,
        reason: 'That would discard the drawing. Delete the drawing first if you meant to replace it.',
      };
    case 'image':
      return {
        ok: false,
        reason: 'That would detach the image. Delete the image block first if you meant to replace it.',
      };
    case 'connection-embed':
      return {
        ok: false,
        reason: 'That would remove the embedded connection. The connection itself would survive.',
      };
    case 'argument-map':
      return {
        ok: false,
        reason: 'That would discard the argument map view.',
      };
    case 'definition':
      return {
        ok: false,
        reason: 'That would discard the term and its meanings.',
      };
    default:
      break;
  }

  // Into a non-textual kind: nothing is lost, but nothing sensible can
  // be fabricated either.
  switch (to) {
    case 'drawing':
      return { ok: false, reason: 'Add a drawing block instead — there is nothing to draw from text.' };
    case 'image':
      return { ok: false, reason: 'Add an image block instead — there is no image in this text.' };
    case 'connection-embed':
      return { ok: false, reason: 'Embed a connection instead — this text does not name one.' };
    case 'argument-map':
      return { ok: false, reason: 'Add an argument map instead.' };
    case 'definition':
      return { ok: false, reason: 'Add a definition instead, so the term and its meanings are separate fields.' };
    case 'divider':
      return { ok: false, reason: 'That would discard the text. Add a divider instead.' };
    default:
      return { ok: true };
  }
}

/**
 * Build the content for the target kind, carrying the text across.
 *
 * Returns an **input** shape (`BlockContentInput`, `z.input`) rather
 * than stored content, because the target kind's defaults —
 * `resolved`, `supportingBlockIds`, `style` — are applied by the
 * schema at the repository boundary. Constructing them here would
 * duplicate the defaults and let the two drift (ADR-0001 §2).
 *
 * @throws when the change would destroy content. Callers check
 *   `canChangeKind` first; this throw is the backstop for the one
 *   that forgets.
 */
export function contentForKind(
  from: BlockContent,
  to: BlockKind,
): BlockContentInput {
  const verdict = canChangeKind(from, to);
  if (!verdict.ok) throw new Error(verdict.reason);

  const text = textOfContent(from);

  switch (to) {
    case 'paragraph':
      // Only `text` is set. `doc` is left absent rather than
      // synthesised: a fabricated ProseMirror document would claim a
      // structure the user never authored, and the editor rebuilds
      // one from the text on open (see `docFromJSON`).
      return { type: 'paragraph', text };
    case 'heading':
      return { type: 'heading', text };
    case 'question':
      return { type: 'question', text };
    case 'claim':
      return { type: 'claim', text };
    case 'evidence':
      return { type: 'evidence', text };
    case 'objection':
      return { type: 'objection', text };
    case 'callout':
      return { type: 'callout', text };
    case 'quote':
      // The anchor is not carried: this text was written by the user,
      // not quoted from the source, and giving it a source anchor it
      // never had would be a fabricated citation.
      return { type: 'quote', quote: text };
    case 'divider':
      return { type: 'divider' };
    default:
      throw new Error(`Cannot build ${to} content from ${from.type}`);
  }
}
