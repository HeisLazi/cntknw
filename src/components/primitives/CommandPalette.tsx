import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './primitives.css';

export interface Command {
  id: string;
  label: string;
  /** Shown right-aligned, e.g. a section name or shortcut. */
  hint?: string;
  keywords?: readonly string[];
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: readonly Command[];
  placeholder?: string;
  label?: string;
}

function matches(command: Command, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (command.label.toLowerCase().includes(needle)) return true;
  return (command.keywords ?? []).some((keyword) =>
    keyword.toLowerCase().includes(needle),
  );
}

/**
 * Keyboard-first command surface, on the native `<dialog>`.
 *
 * The combobox wiring is the part that matters and the part that is
 * routinely skipped: the input keeps DOM focus throughout while
 * `aria-activedescendant` moves a *virtual* cursor through the list.
 * Moving real focus to each option instead would break typing, which
 * is the entire interaction.
 *
 * A palette is an accelerator, never the only route to an action —
 * every command here is reachable from the shell as well.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = 'Search commands…',
  label = 'Command palette',
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const listId = useId();

  const results = useMemo(
    () => commands.filter((command) => matches(command, query)),
    [commands, query],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // See Dialog: jsdom has the element but not showModal.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.open = true;
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.open = false;
    }
  }, [open]);

  // A filter that shortens the list must not leave the cursor past
  // its end, pointing at an option that no longer exists. Clamped
  // during render rather than corrected in an effect: an effect
  // would paint one frame with the cursor out of range, and
  // `aria-activedescendant` would name an id that is not in the DOM.
  const activeIndex = Math.min(rawActiveIndex, Math.max(results.length - 1, 0));

  const runActive = () => {
    const command = results[activeIndex];
    if (!command) return;
    command.run();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) =>
          results.length === 0 ? 0 : (current + 1) % results.length,
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) =>
          results.length === 0 ? 0 : (current - 1 + results.length) % results.length,
        );
        break;
      case 'Enter':
        event.preventDefault();
        runActive();
        break;
      default:
        break;
    }
  };

  const activeId = results[activeIndex]
    ? `${listId}-option-${results[activeIndex]!.id}`
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      className="cn-palette"
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          type="text"
          className="cn-palette__input"
          placeholder={placeholder}
          aria-label={label}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeId}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="cn-palette__list">
          {results.length === 0 ? (
            <p className="cn-palette__empty">No matching commands.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label={label}>
              {results.map((command, index) => (
                <li key={command.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-option-${command.id}`}
                    className="cn-palette__item"
                    aria-selected={index === activeIndex}
                    data-active={index === activeIndex}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      command.run();
                      onClose();
                    }}
                  >
                    <span>{command.label}</span>
                    {command.hint ? (
                      <span className="cn-palette__hint">{command.hint}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
