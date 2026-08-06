import type { BlockContent } from '@domain/index';
import { textOfEditableContent, withEditedText } from '@domain/journals/transform';

export interface PendingTextEdit {
  kind: 'text';
  /** Present only when BlockEditor authored the rich document. */
  doc?: unknown;
  text: string;
}

export interface PendingContentEdit {
  kind: 'content';
  content: BlockContent;
}

export type PendingJournalEdit = PendingTextEdit | PendingContentEdit;

export function applyPendingEdit(
  current: BlockContent,
  edit: PendingJournalEdit,
): BlockContent {
  if (edit.kind === 'content') return edit.content;
  if (current.type === 'paragraph' && edit.doc === undefined) {
    // Text-only projections such as Whiteboard must not fabricate a
    // ProseMirror document or retain one whose text is now stale.
    // BlockEditor is the sole producer of `doc`; it reconstructs from
    // this plain text the next time the block opens in the journal.
    const { doc: _staleDoc, ...withoutDoc } = current;
    return { ...withoutDoc, text: edit.text };
  }
  return withEditedText(current, edit) as BlockContent;
}

export function drawingSummary(content: BlockContent): string {
  if (content.type !== 'drawing') return textOfEditableContent(content) ?? '';
  const count = content.drawingData.strokes.length;
  return `Drawing — ${count} ${count === 1 ? 'stroke' : 'strokes'}`;
}

export function pendingEditSummary(edit: PendingJournalEdit): string {
  return edit.kind === 'text' ? edit.text : drawingSummary(edit.content);
}
