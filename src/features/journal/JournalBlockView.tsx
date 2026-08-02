import { useCallback } from 'react';
import { Menu } from '@components/primitives';
import { canChangeKind } from '@domain/journals/transform';
import type { BlockKind, JournalBlock } from '@domain/index';
import { BlockEditor } from './BlockEditor';
import { CHANGEABLE_KINDS, vocabularyFor } from './blockVocabulary';
import './journal.css';

export interface JournalBlockViewProps {
  block: JournalBlock;
  autoFocus: boolean;
  onChange: (next: { doc: unknown; text: string }) => void;
  onSplit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeKind: (to: BlockKind) => void;
  /** Rendered beneath the block — a conflict notice, for instance. */
  footer?: React.ReactNode;
}

/**
 * One block: a mark in the margin, prose in the column.
 *
 * The mark lane carries the taxonomy so the prose column carries only
 * prose (ADR-0006 §2). It is also the affordance for changing the
 * kind — the mark *is* the control, so there is no hovering toolbar
 * and no second place to look.
 *
 * **The mark button stays in the tab order.** That costs a second tab
 * stop per block, which is a real price in a long journal. The
 * alternative — hiding it behind a shortcut — would make block type
 * unreachable for anyone who does not already know the shortcut, and
 * AC-015 requires core actions to be keyboard accessible. Two
 * predictable stops beat one hidden one.
 */
export function JournalBlockView({
  block,
  autoFocus,
  onChange,
  onSplit,
  onRemove,
  onMoveUp,
  onMoveDown,
  onChangeKind,
  footer,
}: JournalBlockViewProps) {
  const vocabulary = vocabularyFor(block.kind);

  const items = useCallback(
    () =>
      CHANGEABLE_KINDS.map((entry) => {
        const verdict = canChangeKind(block.content, entry.kind);
        return {
          id: entry.kind,
          label: entry.label,
          // Disabled rather than absent when the change would destroy
          // content: a menu that silently omits an option teaches
          // nothing, where a disabled one shows the shape of the rule.
          disabled: !verdict.ok || entry.kind === block.kind,
          onSelect: () => onChangeKind(entry.kind),
        };
      }),
    [block.content, block.kind, onChangeKind],
  );

  return (
    <div className="cn-block" data-kind={block.kind}>
      <div className="cn-block__mark">
        <Menu
          label={`Change block type from ${vocabulary.label}`}
          items={items()}
          align="start"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              className="cn-block__mark-button"
              data-style={vocabulary.markStyle}
              // Named for what it does, not for what it shows — a
              // paragraph's mark is empty, and an unnamed button is
              // useless to anyone not looking at it.
              aria-label={`Block type: ${vocabulary.label}. Change`}
            >
              <span aria-hidden="true">{vocabulary.mark}</span>
            </button>
          )}
        />
      </div>

      <div className="cn-block__body">
        {vocabulary.textual ? (
          <BlockEditor
            // Keyed on kind so changing type rebuilds the editor with
            // the new content rather than leaving the old document in
            // place — the editor holds its own state deliberately
            // (ADR-0004 §4), so it must be told when that state is
            // no longer the truth.
            key={`${block.id}:${block.kind}`}
            doc={block.content.type === 'paragraph' ? block.content.doc : undefined}
            text={textOf(block)}
            autoFocus={autoFocus}
            placeholder={placeholderFor(block.kind)}
            onChange={onChange}
            onSplit={onSplit}
            onRemove={onRemove}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        ) : (
          <NonTextualBlock block={block} />
        )}
        {footer}
      </div>
    </div>
  );
}

function textOf(block: JournalBlock): string {
  const content = block.content;
  switch (content.type) {
    case 'paragraph':
    case 'heading':
    case 'question':
    case 'claim':
    case 'evidence':
    case 'objection':
    case 'callout':
      return content.text;
    case 'quote':
      return content.quote;
    default:
      return '';
  }
}

function placeholderFor(kind: BlockKind): string {
  switch (kind) {
    case 'question':
      return 'What is unresolved?';
    case 'claim':
      return 'What are you asserting?';
    case 'evidence':
      return 'What supports it?';
    case 'objection':
      return 'What tells against it?';
    case 'quote':
      return "The source's words…";
    case 'heading':
      return 'A division…';
    default:
      return 'Write…';
  }
}

/**
 * Kinds that are not prose.
 *
 * Rendered as an honest placeholder rather than as nothing. A block
 * that exists in the data and shows blank in the journal is
 * indistinguishable from data loss, which is the impression a study
 * tool can least afford to give.
 */
function NonTextualBlock({ block }: { block: JournalBlock }) {
  const content = block.content;

  if (content.type === 'divider') {
    return <hr className="cn-block__divider" />;
  }

  if (content.type === 'definition') {
    return (
      <dl className="cn-block__definition">
        <dt>{content.term}</dt>
        {content.sourceMeaning ? <dd>{content.sourceMeaning}</dd> : null}
        {content.personalMeaning ? <dd>{content.personalMeaning}</dd> : null}
      </dl>
    );
  }

  const { label } = vocabularyFor(block.kind);
  return (
    <p className="cn-block__pending">
      {label} — not yet displayable. Your content is stored and unchanged.
    </p>
  );
}
