import { useCallback, useState } from 'react';
import { Menu } from '@components/primitives';
import { canChangeKind } from '@domain/journals/transform';
import type { BlockKind, JournalBlock } from '@domain/index';
import { BlockEditor } from './BlockEditor';
import { DrawingCanvas } from './DrawingCanvas';
import { CHANGEABLE_KINDS, vocabularyFor } from './blockVocabulary';
import './journal.css';

export interface JournalBlockViewProps {
  block: JournalBlock;
  autoFocus: boolean;
  onTextChange: (next: { doc: unknown; text: string }) => void;
  onContentChange: (next: JournalBlock['content']) => void;
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
 * kind — the mark *is* the persistent control. The ghost action row
 * is only a convenience projection of actions that remain available
 * from this keyboard-reachable menu.
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
  onTextChange,
  onContentChange,
  onSplit,
  onRemove,
  onMoveUp,
  onMoveDown,
  onChangeKind,
  footer,
}: JournalBlockViewProps) {
  const vocabulary = vocabularyFor(block.kind);
  const [hovered, setHovered] = useState(false);
  const [focusedWithin, setFocusedWithin] = useState(false);
  const actionsVisible = hovered || focusedWithin;

  const kindAction = useCallback(
    (kind: BlockKind) => {
      const entry = vocabularyFor(kind);
      const verdict = canChangeKind(block.content, kind);
      return {
        kind,
        label: entry.label,
        disabled: !verdict.ok || kind === block.kind,
        reason: verdict.ok ? undefined : verdict.reason,
        onSelect: () => onChangeKind(kind),
      };
    },
    [block.content, block.kind, onChangeKind],
  );

  const ghostKindActions = (
    ['quote', 'question', 'definition'] as const
  ).map(kindAction);

  const items = useCallback(
    () => [
      ...CHANGEABLE_KINDS.map((entry) => {
        const action = kindAction(entry.kind);
        return {
          id: entry.kind,
          label: entry.label,
          // Disabled rather than absent when the change would destroy
          // content: a menu that silently omits an option teaches
          // nothing, where a disabled one shows the shape of the rule.
          disabled: action.disabled,
          onSelect: action.onSelect,
        };
      }),
      {
        id: 'definition',
        label: vocabularyFor('definition').label,
        disabled: kindAction('definition').disabled,
        onSelect: kindAction('definition').onSelect,
      },
      {
        id: 'connect-later',
        label: 'Connect — later',
        disabled: true,
        onSelect: () => undefined,
      },
      { id: 'move-up', label: 'Move up', onSelect: onMoveUp },
      { id: 'move-down', label: 'Move down', onSelect: onMoveDown },
      { id: 'delete', label: 'Delete', onSelect: onRemove },
    ],
    [kindAction, onMoveUp, onMoveDown, onRemove],
  );

  return (
    <div
      className={`cn-block${actionsVisible ? ' cn-block--actions-visible' : ''}`}
      data-kind={block.kind}
      data-actions-visible={actionsVisible ? 'true' : 'false'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusedWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusedWithin(false);
        }
      }}
    >
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
            onChange={onTextChange}
            onSplit={onSplit}
            onRemove={onRemove}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            allowRichText={block.kind === 'paragraph'}
          />
        ) : (
          <NonTextualBlock
            block={block}
            autoFocus={autoFocus}
            onContentChange={onContentChange}
            onRemove={onRemove}
          />
        )}
        {footer}
      </div>

      {actionsVisible ? (
        <div
          className="cn-block__actions"
          role="toolbar"
          aria-label="Block actions"
        >
        {ghostKindActions.map((action) => (
          <button
            key={action.kind}
            type="button"
            className="cn-block__action"
            title={action.reason}
            disabled={action.disabled}
            onClick={action.onSelect}
          >
            {action.label}
          </button>
        ))}
        <span className="cn-block__move" role="group" aria-label="Move block">
          <button
            type="button"
            className="cn-block__action"
            aria-label="Move up"
            onClick={onMoveUp}
          >
            Move ↑
          </button>
          <button
            type="button"
            className="cn-block__action"
            aria-label="Move down"
            onClick={onMoveDown}
          >
            Move ↓
          </button>
        </span>
        <button
          type="button"
          className="cn-block__action cn-block__action--danger"
          onClick={onRemove}
        >
          Delete
        </button>
        </div>
      ) : null}
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
function NonTextualBlock({
  block,
  autoFocus,
  onContentChange,
  onRemove,
}: {
  block: JournalBlock;
  autoFocus: boolean;
  onContentChange: (next: JournalBlock['content']) => void;
  onRemove: () => void;
}) {
  const content = block.content;

  if (content.type === 'drawing') {
    return (
      <DrawingCanvas
        content={content}
        autoFocus={autoFocus}
        onChange={onContentChange}
        onRemoveBlock={onRemove}
      />
    );
  }

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
