/**
 * Primitive behaviour, keyboard and accessibility.
 *
 * These test the parts that are invisible when they work and
 * expensive when they do not: names, roles, states, and what
 * happens when there is no mouse.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Button,
  ContextPanel,
  ConfirmDialog,
  IconButton,
  Input,
  Menu,
  Popover,
  Select,
  SplitPane,
  Tabs,
  Textarea,
  Tooltip,
} from './index';

describe('Button', () => {
  it('announces a busy state in words as well as by spinner', async () => {
    render(
      <Button loading loadingLabel="Saving your work">
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    // The label is text, not only a spinning shape — which is
    // invisible to a screen reader and stationary under
    // prefers-reduced-motion.
    expect(button).toHaveTextContent('Saving your work');
  });

  it('does not fire while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('activates from the keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Import</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('defaults to type=button so it cannot submit a form by accident', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('IconButton', () => {
  it('always carries an accessible name', () => {
    render(<IconButton label="Close the source pane" icon="×" />);
    expect(
      screen.getByRole('button', { name: 'Close the source pane' }),
    ).toBeInTheDocument();
  });
});

describe('Fields', () => {
  it('links label and hint to the control', () => {
    render(<Input label="Author" hint="Optional. Free text." />);
    const input = screen.getByLabelText('Author');
    expect(input).toHaveAccessibleDescription('Optional. Free text.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks an invalid field with more than colour', () => {
    render(<Input label="Page count" error="Must be a positive number." />);
    const input = screen.getByLabelText('Page count');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Must be a positive number.');
  });

  it('prefers the error over the hint when both are present', () => {
    render(<Input label="Title" hint="A hint" error="An error" />);
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription('An error');
    expect(screen.queryByText('A hint')).not.toBeInTheDocument();
  });

  it('keeps a hidden label reachable by assistive technology', () => {
    render(<Input label="Search the library" hideLabel />);
    expect(screen.getByLabelText('Search the library')).toBeInTheDocument();
  });

  it('renders a native select with its options', () => {
    render(
      <Select
        label="Status"
        options={[
          { value: 'unread', label: 'Unread' },
          { value: 'reading', label: 'Reading' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Status');
    expect(select.tagName).toBe('SELECT');
    expect(within(select).getAllByRole('option')).toHaveLength(2);
  });

  it('renders a native textarea', () => {
    render(<Textarea label="Note" />);
    expect(screen.getByLabelText('Note').tagName).toBe('TEXTAREA');
  });
});

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Journal', content: <p>Journal view</p> },
    { id: 'b', label: 'Outline', content: <p>Outline view</p> },
    { id: 'c', label: 'Cards', content: <p>Cards view</p> },
  ];

  it('exposes the APG tab roles and state', () => {
    render(<Tabs label="Journal views" tabs={tabs} />);
    const list = screen.getByRole('tablist', { name: 'Journal views' });
    expect(within(list).getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Journal');
  });

  it('moves with arrow keys, Home and End', async () => {
    render(<Tabs label="Journal views" tabs={tabs} />);
    const first = screen.getByRole('tab', { name: 'Journal' });
    first.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Outline');

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Cards');

    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Journal');
  });

  it('keeps only the selected tab in the tab order', () => {
    render(<Tabs label="Journal views" tabs={tabs} />);
    const all = screen.getAllByRole('tab');
    expect(all.filter((tab) => tab.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('shows only the selected panel', () => {
    render(<Tabs label="Journal views" tabs={tabs} />);
    expect(screen.getByText('Journal view')).toBeVisible();
    expect(screen.queryByText('Outline view')).not.toBeInTheDocument();
  });
});

describe('Popover', () => {
  it('reports its expanded state on the trigger', async () => {
    render(
      <Popover trigger={(props) => <Button {...props}>Details</Button>}>
        <p>Panel content</p>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Details' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(
      <Popover trigger={(props) => <Button {...props}>Details</Button>}>
        <p>Panel content</p>
      </Popover>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });
});

describe('Menu', () => {
  const items = [
    { id: 'open', label: 'Open', onSelect: vi.fn() },
    { id: 'archive', label: 'Archive', onSelect: vi.fn() },
  ];

  it('exposes menu roles and haspopup', async () => {
    render(
      <Menu
        label="Source actions"
        items={items}
        trigger={(props) => <Button {...props}>Actions</Button>}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    await userEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Source actions' });
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
  });

  it('moves through items with the arrow keys', async () => {
    render(
      <Menu
        label="Source actions"
        items={items}
        trigger={(props) => <Button {...props}>Actions</Button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus();
  });

  it('skips disabled items when moving', async () => {
    render(
      <Menu
        label="Source actions"
        items={[
          { id: 'a', label: 'First', onSelect: vi.fn() },
          { id: 'b', label: 'Blocked', onSelect: vi.fn(), disabled: true },
          { id: 'c', label: 'Third', onSelect: vi.fn() },
        ]}
        trigger={(props) => <Button {...props}>Actions</Button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Third' })).toHaveFocus();
  });
});

describe('Tooltip', () => {
  it('appears on keyboard focus, not only on hover', async () => {
    render(
      <Tooltip label="Opens the source in a new pane">
        <Button>Open</Button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toBeVisible();
  });
});

describe('ConfirmDialog', () => {
  it('focuses cancel first so the safe action is the default', async () => {
    render(
      <ConfirmDialog
        open
        destructive
        title="Delete this source?"
        description="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('labels the dialog by its title', () => {
    render(
      <ConfirmDialog
        open
        title="Delete this source?"
        description="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('dialog', { name: 'Delete this source?', hidden: true }),
    ).toBeInTheDocument();
  });
});

describe('SplitPane', () => {
  it('exposes a separator with a value and bounds', () => {
    render(<SplitPane label="Source and journal" start={<p>A</p>} end={<p>B</p>} />);
    const separator = screen.getByRole('separator', { name: 'Source and journal' });
    expect(separator).toHaveAttribute('aria-valuenow', '50');
    expect(separator).toHaveAttribute('aria-valuemin', '20');
    expect(separator).toHaveAttribute('aria-valuemax', '80');
  });

  it('resizes from the keyboard', async () => {
    // A split that can only be dragged cannot be used without a
    // mouse, which PDD §21 does not allow.
    const onRatioChange = vi.fn();
    render(
      <SplitPane
        label="Source and journal"
        start={<p>A</p>}
        end={<p>B</p>}
        onRatioChange={onRatioChange}
      />,
    );
    const separator = screen.getByRole('separator');
    separator.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(separator).toHaveAttribute('aria-valuenow', '52');

    await userEvent.keyboard('{Home}');
    expect(separator).toHaveAttribute('aria-valuenow', '20');

    await userEvent.keyboard('{End}');
    expect(separator).toHaveAttribute('aria-valuenow', '80');

    expect(onRatioChange).toHaveBeenCalled();
  });

  it('clamps to its bounds rather than collapsing a pane', async () => {
    render(<SplitPane label="Panes" start={<p>A</p>} end={<p>B</p>} />);
    const separator = screen.getByRole('separator');
    separator.focus();
    for (let i = 0; i < 40; i += 1) {
      await userEvent.keyboard('{ArrowLeft}');
    }
    expect(separator).toHaveAttribute('aria-valuenow', '20');
  });

  it('honours a new persisted default and clamps it to custom limits', () => {
    const { rerender } = render(
      <SplitPane
        label="Panes"
        defaultRatio={0.7}
        minRatio={0.3}
        maxRatio={0.7}
        start={<p>A</p>}
        end={<p>B</p>}
      />,
    );
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '70');

    rerender(
      <SplitPane
        label="Panes"
        defaultRatio={0.9}
        ratio={0.9}
        minRatio={0.3}
        maxRatio={0.7}
        start={<p>A</p>}
        end={<p>B</p>}
      />,
    );
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '70');
  });

  it('lets the only visible pane fill the container regardless of the saved ratio', () => {
    const { container, rerender } = render(
      <SplitPane
        label="Panes"
        ratio={0.3}
        start={<p>A</p>}
        end={<p>B</p>}
        endVisible={false}
      />,
    );
    const split = container.querySelector<HTMLElement>('.cn-split')!;
    const start = container.querySelector<HTMLElement>('[data-pane="start"]')!;
    expect(split).toHaveAttribute('data-single-pane', 'true');
    expect(start).toBeVisible();
    expect(getComputedStyle(start).flex).toBe('1 1 auto');

    rerender(
      <SplitPane
        label="Panes"
        ratio={0.7}
        start={<p>A</p>}
        end={<p>B</p>}
        startVisible={false}
      />,
    );
    const end = container.querySelector<HTMLElement>('[data-pane="end"]')!;
    expect(end).toBeVisible();
    expect(getComputedStyle(end).flex).toBe('1 1 auto');
  });
});

function ContextPanelProbe() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Open contents
      </button>
      <ContextPanel
        open={open}
        title="Contents"
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
      >
        <button type="button">Outline item</button>
      </ContextPanel>
    </>
  );
}

describe('ContextPanel', () => {
  it('is closed by default and removes its contents from the focus order', async () => {
    render(<ContextPanelProbe />);
    const panel = document.querySelector<HTMLElement>('.cn-context-panel')!;
    expect(panel).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'Outline item' })).not.toBeInTheDocument();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Open contents' })).toHaveFocus();
    await userEvent.tab();
    expect(
      panel.querySelector('button:last-of-type'),
    ).not.toHaveFocus();
  });

  it('opens from a keyboard control, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    render(<ContextPanelProbe />);
    const trigger = screen.getByRole('button', { name: 'Open contents' });
    trigger.focus();
    await user.keyboard('{Enter}');

    const panel = screen.getByRole('dialog', { name: 'Contents' });
    expect(panel).toBeVisible();
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close contents panel' })).toHaveFocus();
    const css = readFileSync(
      join(process.cwd(), 'src/components/primitives/primitives.css'),
      'utf-8',
    );
    expect(css).toMatch(/\.cn-context-panel\s*\{[^}]*position:\s*fixed/s);

    await user.keyboard('{Escape}');
    expect(panel).not.toBeVisible();
    expect(trigger).toHaveFocus();
  });

  it('cycles Tab and Shift+Tab within the open modal panel', async () => {
    const user = userEvent.setup();
    render(<ContextPanelProbe />);
    await user.click(screen.getByRole('button', { name: 'Open contents' }));

    const close = screen.getByRole('button', { name: 'Close contents panel' });
    const item = screen.getByRole('button', { name: 'Outline item' });
    close.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(item).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(close).toHaveFocus();
  });
});
