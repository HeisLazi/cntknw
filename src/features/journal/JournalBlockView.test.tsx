import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRepositories, type MemoryRepositories } from '@data/adapters/memory';
import type { JournalBlock } from '@domain/index';
import { JournalBlockView, type JournalBlockViewProps } from './JournalBlockView';

let repositories: MemoryRepositories;
let block: JournalBlock;

beforeEach(async () => {
  repositories = createMemoryRepositories();
  const source = await repositories.sources.create({
    type: 'book',
    title: 'The quiet leaf',
  });
  const journal = await repositories.journals.getOrCreateJournalForSource(
    source.id,
    'Journal',
  );
  block = await repositories.journals.createBlock({
    journalId: journal.id,
    kind: 'paragraph',
    sourceLocation: {
      sourceType: 'book',
      sourceId: source.id,
      pdf: { page: 17 },
    },
    rank: 'm',
    content: { type: 'paragraph', text: 'A durable thought.' },
    provenance: 'user',
  });
});

function renderBlock(
  currentBlock: JournalBlock = block,
  overrides: Partial<JournalBlockViewProps> = {},
) {
  const props: JournalBlockViewProps = {
    block: currentBlock,
    autoFocus: false,
    onTextChange: vi.fn(),
    onContentChange: vi.fn(),
    onSplit: vi.fn(),
    onRemove: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onChangeKind: vi.fn(),
    ...overrides,
  };

  return { ...render(<JournalBlockView {...props} />), props };
}

describe('JournalBlockView progressive disclosure', () => {
  it('reveals the ghost actions on focus and reaches them from the keyboard', async () => {
    const user = userEvent.setup();
    const onChangeKind = vi.fn();
    const { container } = renderBlock(block, { onChangeKind });

    const blockElement = container.querySelector<HTMLElement>('.cn-block')!;
    expect(container.querySelector('.cn-block__actions')).toBeNull();
    expect(blockElement).not.toHaveClass('cn-block--actions-visible');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Block type: Paragraph. Change' }))
      .toHaveFocus();
    expect(screen.getByRole('toolbar', { name: 'Block actions' })).toBeVisible();
    expect(blockElement).toHaveClass('cn-block--actions-visible');

    const quote = screen.getByRole('button', { name: 'Quote' });
    expect(quote.tabIndex).toBe(0);
    act(() => quote.focus());
    expect(quote).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onChangeKind).toHaveBeenCalledOnce();
    expect(onChangeKind).toHaveBeenCalledWith('quote');
  });

  it('keeps the ghost row concise while every action has a readable name', async () => {
    const user = userEvent.setup();
    renderBlock();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Quote' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Question' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Definition' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move up' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();

    expect(screen.queryByRole('button', { name: 'Connect — later' })).not.toBeInTheDocument();
  });

  it('keeps the persistent mark menu keyboard-reachable with the same future and delete actions', async () => {
    const user = userEvent.setup();
    renderBlock();

    const mark = screen.getByRole('button', { name: 'Block type: Paragraph. Change' });
    await user.click(mark);

    expect(screen.getByRole('menuitem', { name: 'Connect — later' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: 'Move down' })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeEnabled();
  });

  it('dispatches a guarded kind change without mutating identity or provenance', async () => {
    const user = userEvent.setup();
    const onChangeKind = vi.fn();
    const original = structuredClone(block);
    renderBlock(block, { onChangeKind });

    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Question' }));

    expect(onChangeKind).toHaveBeenCalledWith('question');
    expect(block).toEqual(original);
    expect(block.id).toBe(original.id);
    expect(block.sourceLocation).toEqual(original.sourceLocation);
    expect(block.provenance).toBe(original.provenance);
  });

  it('keeps DrawingCanvas intact while destructive kind transforms stay disabled (AC-008)', async () => {
    const drawing = await repositories.journals.createBlock({
      journalId: block.journalId,
      kind: 'drawing',
      sourceLocation: block.sourceLocation,
      rank: 'n',
      content: {
        type: 'drawing',
        drawingData: { version: 1, width: 800, height: 600, strokes: [] },
      },
    });
    const user = userEvent.setup();
    renderBlock(drawing);

    expect(screen.getByRole('img', { name: 'Drawing, 0 strokes' })).toBeVisible();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Quote' })).toBeDisabled();
    expect(drawing.sourceLocation).toEqual(block.sourceLocation);
  });
});
