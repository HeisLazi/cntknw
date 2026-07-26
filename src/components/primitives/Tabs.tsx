import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './primitives.css';

export interface TabDefinition {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  label: string;
  tabs: readonly TabDefinition[];
  defaultTabId?: string;
  value?: string;
  onValueChange?: (id: string) => void;
}

/**
 * Local view switching within one route.
 *
 * **Tabs never replace the three primary destinations.** INV-001 and
 * IA-001 fix Library, Gallery and Notes as the only permanent
 * navigation, and a tab strip that switched between them would be a
 * fourth navigation system wearing a different name. These switch
 * views *inside* a route and change no URL.
 *
 * Keyboard behaviour follows the APG tabs pattern: arrows move,
 * Home and End jump, and only the selected tab is in the tab order,
 * so Tab moves past the strip to the panel rather than through every
 * tab in turn.
 */
export function Tabs({
  label,
  tabs,
  defaultTabId,
  value,
  onValueChange,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultTabId ?? tabs[0]?.id ?? '');
  const selected = value ?? internal;
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string) => {
    setInternal(id);
    onValueChange?.(id);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === selected);
    if (current === -1) return;

    let next = current;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    select(target.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div className="cn-tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => {
          const isSelected = tab.id === selected;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              className="cn-tabs__tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          className="cn-tabs__panel"
          hidden={tab.id !== selected}
          tabIndex={0}
        >
          {tab.id === selected ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
