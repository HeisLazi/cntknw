/**
 * CNTKNW UI primitives.
 *
 * Every primitive here follows the same three rules:
 *
 *   1. Native semantics first. `<button>`, `<dialog>`, `<select>`,
 *      `<label>` — the platform's keyboard handling, focus
 *      management and assistive-technology support are better than a
 *      reimplementation, and free.
 *   2. Every visual value is a token. No hex, no magic pixels, no
 *      bespoke easing. `design-tokens.test.ts` enforces it.
 *   3. Meaning is never carried by colour alone. Every state that
 *      colour signals is also signalled by a glyph, a weight, a
 *      border, or an ARIA attribute.
 *
 * Documented in the development-only component lab at `/components`.
 */

export { Button, IconButton } from './Button';
export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  IconButtonProps,
} from './Button';

export { Input, Select, Textarea } from './Field';
export type {
  InputProps,
  SelectOption,
  SelectProps,
  TextareaProps,
} from './Field';

export { EmptyState, ScrollArea, Surface } from './Surface';
export type {
  EmptyStateProps,
  ScrollAreaProps,
  SurfacePad,
  SurfaceProps,
  SurfaceTone,
} from './Surface';

export { ConfirmDialog, Dialog } from './Dialog';
export type { ConfirmDialogProps, DialogProps } from './Dialog';

export { Menu, Popover, Tooltip } from './Overlay';
export type {
  MenuItem,
  MenuProps,
  PopoverProps,
  TooltipProps,
} from './Overlay';

export { Tabs } from './Tabs';
export type { TabDefinition, TabsProps } from './Tabs';

export { ResizablePanel, SplitPane } from './SplitPane';
export type { ResizablePanelProps, SplitPaneProps } from './SplitPane';

export { ToastProvider, useToast } from './Toast';
export type { Toast, ToastProviderProps, ToastTone } from './Toast';

export { CommandPalette } from './CommandPalette';
export type { Command, CommandPaletteProps } from './CommandPalette';

export { FocusRing } from './FocusRing';
export type { FocusRingProps } from './FocusRing';
