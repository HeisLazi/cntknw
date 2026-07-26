import { useState } from 'react';
import {
  Button,
  CommandPalette,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Menu,
  Popover,
  ResizablePanel,
  ScrollArea,
  Select,
  SplitPane,
  Surface,
  Tabs,
  Textarea,
  Tooltip,
  useToast,
} from '@components/primitives';
import { RouteHeader } from '@components/shell/RouteStates';

/**
 * The component lab. **Development only.**
 *
 * Mounted at `/components` when `import.meta.env.DEV` is true, and
 * absent from the production route table — `navigation.test.ts` and
 * a Playwright case both assert it is never a primary destination.
 *
 * Its job is to make every state of every primitive visible at once:
 * default, hover, focus-visible, active, disabled, loading, invalid.
 * States that are only reachable by driving the real application are
 * the states that quietly rot, and a lab is cheaper than discovering
 * a broken disabled style in Phase 6.
 */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cn-lab__section">
      <h2 className="cn-lab__heading">{title}</h2>
      <p className="cn-lab__note">{note}</p>
      {children}
    </section>
  );
}

const SEMANTIC_TOKENS = [
  '--cn-canvas',
  '--cn-surface',
  '--cn-surface-raised',
  '--cn-paper',
  '--cn-ink',
  '--cn-ink-muted',
  '--cn-border',
  '--cn-accent',
  '--cn-success',
  '--cn-warning',
  '--cn-danger',
] as const;

const TYPE_SCALE = [
  ['--cn-text-4xl', '4xl'],
  ['--cn-text-3xl', '3xl'],
  ['--cn-text-2xl', '2xl'],
  ['--cn-text-xl', 'xl'],
  ['--cn-text-lg', 'lg'],
  ['--cn-text-base', 'base'],
  ['--cn-text-sm', 'sm'],
  ['--cn-text-xs', 'xs'],
] as const;

export function ComponentsRoute() {
  const { show } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="cn-main__inner">
      <RouteHeader
        title="Component lab"
        lede="Development only. Every primitive, in every state it can be in."
      />

      <Section
        title="Colour roles"
        note="Components consume these semantic roles, never the raw palette behind them. Light mode redefines this layer and nothing else."
      >
        <div className="cn-lab__grid">
          {SEMANTIC_TOKENS.map((token) => (
            <div className="cn-lab__swatch" key={token}>
              <span
                className="cn-lab__chip"
                style={{ backgroundColor: `var(${token})` }}
                aria-hidden="true"
              />
              <span>{token}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Type scale"
        note="A 1.2 minor third from a 16px base. Headings take an editorial serif; UI takes the sans. Hierarchy comes from scale and spacing, not colour."
      >
        {TYPE_SCALE.map(([token, name]) => (
          <p key={token} style={{ fontSize: `var(${token})` }}>
            {name} — Decolonisation is always a violent event
          </p>
        ))}
      </Section>

      <Section
        title="Button"
        note="Four variants, three sizes, and every state including loading and disabled. Loading sets aria-busy and says so in words, because a spinner alone is invisible to a screen reader."
      >
        <div className="cn-lab__row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div className="cn-lab__row" style={{ marginTop: 'var(--cn-space-md)' }}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="cn-lab__row" style={{ marginTop: 'var(--cn-space-md)' }}>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Close panel" icon="×" />
          <IconButton label="Close panel, small" icon="×" size="sm" />
          <IconButton label="Unavailable" icon="×" disabled />
        </div>
      </Section>

      <Section
        title="Fields"
        note="Label, hint and error are wired by id through aria-describedby. An invalid field is marked aria-invalid and carries a glyph and a message, never a red border alone."
      >
        <div className="cn-lab__row">
          <Input label="Title" placeholder="The Wretched of the Earth" />
          <Input label="Author" hint="Optional. Free text." />
          <Input
            label="Page count"
            defaultValue="-3"
            error="Page count must be a positive number."
          />
          <Input label="Locked" defaultValue="Read-only" disabled />
        </div>
        <div className="cn-lab__row" style={{ marginTop: 'var(--cn-space-md)' }}>
          <Select
            label="Reading status"
            options={[
              { value: 'unread', label: 'Unread' },
              { value: 'reading', label: 'Reading' },
              { value: 'finished', label: 'Finished' },
            ]}
          />
          <Textarea label="Note" placeholder="Write something…" />
        </div>
      </Section>

      <Section
        title="Surface and empty state"
        note="Four tones: default, raised, sunken, and the warm paper plane used for reading and writing."
      >
        <div className="cn-lab__grid">
          <Surface pad="md" bordered>
            Default
          </Surface>
          <Surface tone="raised" pad="md">
            Raised
          </Surface>
          <Surface tone="sunken" pad="md" bordered>
            Sunken
          </Surface>
          <Surface tone="paper" pad="md" bordered>
            Paper
          </Surface>
        </div>
        <div style={{ marginTop: 'var(--cn-space-lg)' }}>
          <EmptyState
            title="Your library is empty"
            description="An empty state teaches exactly one next action (PDD §9.8)."
            action={<Button variant="primary">Import a PDF</Button>}
          />
        </div>
      </Section>

      <Section
        title="Overlays"
        note="Dialog and CommandPalette use the native <dialog> element, so focus trapping, Escape and inertness come from the platform. Popover and Menu are non-modal and deliberately do not trap focus."
      >
        <div className="cn-lab__row">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete something
          </Button>
          <Button onClick={() => setPaletteOpen(true)}>Command palette</Button>

          <Popover
            trigger={(props) => (
              <Button {...props} variant="secondary">
                Popover
              </Button>
            )}
          >
            <p style={{ padding: 'var(--cn-space-sm)' }}>
              Non-modal. Escape or a click outside dismisses it.
            </p>
          </Popover>

          <Menu
            label="Source actions"
            trigger={(props) => (
              <Button {...props} variant="secondary">
                Menu
              </Button>
            )}
            items={[
              { id: 'open', label: 'Open', onSelect: () => show('Opened') },
              { id: 'archive', label: 'Archive', onSelect: () => show('Archived') },
              { id: 'delete', label: 'Delete', onSelect: () => show('Deleted'), disabled: true },
            ]}
          />

          <Tooltip label="Shown on hover and on keyboard focus">
            <Button variant="quiet">Hover or focus me</Button>
          </Tooltip>
        </div>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="A modal dialog"
          description="Focus is trapped here, Escape closes it, and the rest of the page is inert — all from the platform."
        />

        <ConfirmDialog
          open={confirmOpen}
          destructive
          title="Delete this source?"
          description="Cancel is focused first, so the default keyboard action is the safe one."
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmOpen(false);
            show('Deleted', 'danger');
          }}
          onCancel={() => setConfirmOpen(false)}
        />

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          commands={[
            { id: 'library', label: 'Go to Library', hint: 'Navigate', run: () => show('Library') },
            { id: 'gallery', label: 'Go to Gallery', hint: 'Navigate', run: () => show('Gallery') },
            { id: 'notes', label: 'Go to Notes', hint: 'Navigate', run: () => show('Notes') },
            { id: 'import', label: 'Import a PDF', hint: 'Library', run: () => show('Import') },
          ]}
        />
      </Section>

      <Section
        title="Toast"
        note="One always-mounted polite live region. Tone is carried by a glyph and a visually hidden word as well as by the border colour."
      >
        <div className="cn-lab__row">
          <Button onClick={() => show('Saved to your library', 'success')}>Success</Button>
          <Button onClick={() => show('Storage is nearly full', 'warning')}>Warning</Button>
          <Button onClick={() => show('That change could not be saved', 'danger')}>Danger</Button>
          <Button onClick={() => show('Nothing to report')}>Info</Button>
        </div>
      </Section>

      <Section
        title="Tabs"
        note="Local view switching inside one route. Tabs never replace the three primary destinations (INV-001). Arrows move, Home and End jump, and only the selected tab is in the tab order."
      >
        <Tabs
          label="Journal views"
          tabs={[
            { id: 'journal', label: 'Journal', content: <p>Continuous journal.</p> },
            { id: 'outline', label: 'Outline', content: <p>The same blocks, as an outline.</p> },
            { id: 'cards', label: 'Cards', content: <p>The same blocks, as cards.</p> },
          ]}
        />
      </Section>

      <Section
        title="Split and resizable panes"
        note="The handle is a real separator with a role and arrow-key support, because a split that can only be dragged cannot be used without a mouse."
      >
        <div className="cn-lab__panes">
          <SplitPane
            label="Source and journal"
            start={<div style={{ padding: 'var(--cn-space-lg)' }}>Source pane</div>}
            end={<div style={{ padding: 'var(--cn-space-lg)' }}>Journal pane</div>}
          />
        </div>
        <div className="cn-lab__panes" style={{ marginTop: 'var(--cn-space-lg)' }}>
          <ResizablePanel label="Sidebar width">
            <div style={{ padding: 'var(--cn-space-lg)' }}>Resizable sidebar</div>
          </ResizablePanel>
        </div>
      </Section>

      <Section
        title="Scroll area"
        note="Native overflow with styled scrollbars. Custom scroll implementations break keyboard scrolling, find-in-page and touch momentum."
      >
        <ScrollArea style={{ maxHeight: '8rem' }}>
          <div style={{ padding: 'var(--cn-space-md)' }}>
            {Array.from({ length: 20 }, (_, index) => (
              <p key={index}>Line {index + 1}</p>
            ))}
          </div>
        </ScrollArea>
      </Section>
    </div>
  );
}
