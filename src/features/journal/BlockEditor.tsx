import { useCallback, useEffect, useRef } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { blockSchema, docFromJSON } from './editorSchema';
import './journal.css';

export interface BlockEditorProps {
  /** Stored ProseMirror JSON, if the block has any. */
  doc: unknown;
  /** Plain text, used to reconstruct a block whose doc will not parse. */
  text: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Fired on every change. The caller decides when to persist. */
  onChange: (next: { doc: unknown; text: string }) => void;
  /** Enter with no modifier. Used to start the next block. */
  onSplit?: () => void;
  /** Backspace at the very start of an empty block. */
  onRemove?: () => void;
}

/**
 * One ProseMirror instance, editing one block's inline content.
 *
 * React does not render the editable area — ProseMirror does. The two
 * must not both own the same DOM, so the container is created once
 * and its contents are ProseMirror's from then on. Re-rendering into
 * it would destroy the selection on every keystroke.
 *
 * The instance is deliberately *not* recreated when `doc` changes.
 * The prop is the initial value; after that the editor holds the
 * authority for its own text, and pushing a new document in mid-typing
 * would move the caret to the start on every autosave round-trip.
 */
export function BlockEditor({
  doc,
  text,
  placeholder = 'Write…',
  autoFocus = false,
  onChange,
  onSplit,
  onRemove,
}: BlockEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Callbacks flow through a ref so the editor is built once.
  // Rebuilding it when a parent re-renders would lose focus and undo
  // history. The ref is updated in a layout effect rather than during
  // render — a ref write during render is the trap
  // `react-hooks/refs` exists to catch, and rendering must remain
  // free of side effects.
  const handlers = useRef({ onChange, onSplit, onRemove });
  const syncHandlers = useCallback(() => {
    handlers.current = { onChange, onSplit, onRemove };
  }, [onChange, onSplit, onRemove]);
  useEffect(syncHandlers);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: docFromJSON(doc, text),
      plugins: [
        history(),
        keymap({
          'Mod-b': toggleMark(blockSchema.marks.strong!),
          'Mod-i': toggleMark(blockSchema.marks.em!),
          'Mod-`': toggleMark(blockSchema.marks.code!),
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo,
          Enter: () => {
            // The schema cannot split — there is nowhere to split
            // into — so Enter means "start the next block", which is
            // CNTKNW's decision to make, not the editor's.
            handlers.current.onSplit?.();
            return true;
          },
          Backspace: (editorState) => {
            const { empty, from } = editorState.selection;
            const isAtStart = empty && from <= 1;
            const isEmpty = editorState.doc.textContent.length === 0;
            if (isAtStart && isEmpty && handlers.current.onRemove) {
              handlers.current.onRemove();
              return true;
            }
            return false;
          },
        }),
        keymap(baseKeymap),
      ],
    });

    const view = new EditorView(host, {
      state,
      attributes: {
        class: 'cn-block-editor__content',
        'aria-label': placeholder,
      },
      dispatchTransaction(transaction) {
        const next = view.state.apply(transaction);
        view.updateState(next);
        if (transaction.docChanged) {
          handlers.current.onChange({
            doc: next.doc.toJSON(),
            text: next.doc.textContent,
          });
        }
      },
    });
    viewRef.current = view;

    if (autoFocus) view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Built once. `doc` and `text` are initial values by design — see
    // the note above on why pushing them back in would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className="cn-block-editor"
      data-placeholder={placeholder}
    />
  );
}
