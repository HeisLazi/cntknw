import type { BlockContent } from '@domain/index';
import { textOfEditableContent, withEditedText } from '@domain/journals/transform';

export interface PendingTextEdit {
  kind: 'text';
  doc: unknown;
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
  return edit.kind === 'content'
    ? edit.content
    : withEditedText(current, edit) as BlockContent;
}

export function drawingSummary(content: BlockContent): string {
  if (content.type !== 'drawing') return textOfEditableContent(content) ?? '';
  const count = content.drawingData.strokes.length;
  return `Drawing — ${count} ${count === 1 ? 'stroke' : 'strokes'}`;
}

export function pendingEditSummary(edit: PendingJournalEdit): string {
  return edit.kind === 'text' ? edit.text : drawingSummary(edit.content);
}
