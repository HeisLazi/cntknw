import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRepositories, type MemoryRepositories } from '@data/adapters/memory';
import { expectedRevision } from '@data/repositories/concurrency';
import type { DrawingContent, EntityId, JournalBlock, SourceLocation } from '@domain/index';
import { renderWithProviders } from '@tests/renderWithProviders';
import { JournalPane } from './JournalPane';

let repositories: MemoryRepositories;
let sourceId: EntityId;
let journalId: EntityId;
let location: SourceLocation;

const emptyDrawing: DrawingContent = {
  type: 'drawing',
  drawingData: { version: 1, width: 800, height: 600, strokes: [] },
};

const remoteStroke: DrawingContent = {
  type: 'drawing',
  drawingData: {
    version: 1,
    width: 800,
    height: 600,
    strokes: [{
      id: 'remote-stroke',
      color: 'var(--cn-palette-ink-400)',
      width: 4,
      points: [{ x: 5, y: 5 }, { x: 50, y: 50 }],
    }],
  },
};

async function setupJournal() {
  const source = await repositories.sources.create({ type: 'book', title: 'Drawing study' });
  sourceId = source.id;
  location = { sourceType: 'book', sourceId, pdf: { page: 5 } };
  const journal = await repositories.journals.getOrCreateJournalForSource(sourceId, 'Journal');
  journalId = journal.id;
}

async function createDrawing(content = emptyDrawing): Promise<JournalBlock> {
  return repositories.journals.createBlock({
    journalId,
    kind: 'drawing',
    sourceLocation: location,
    rank: 'm',
    content,
  });
}

async function createParagraph(text: string): Promise<JournalBlock> {
  return repositories.journals.createBlock({
    journalId,
    kind: 'paragraph',
    sourceLocation: location,
    rank: 'm',
    content: { type: 'paragraph', text },
  });
}

function renderPane() {
  return renderWithProviders(
    <JournalPane sourceId={sourceId} journalId={journalId} location={location} />,
    { repositories },
  );
}

function prepareAndDraw(svg: HTMLElement) {
  Object.defineProperty(svg, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(svg, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  dispatchPointer(svg, 'pointerdown', 10, 10);
  dispatchPointer(svg, 'pointermove', 110, 90);
  dispatchPointer(svg, 'pointerup', 210, 150);
}

function dispatchPointer(svg: HTMLElement, type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 2 },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  fireEvent(svg, event);
}

beforeEach(async () => {
  localStorage.clear();
  repositories = createMemoryRepositories();
  await setupJournal();
});

describe('JournalPane drawing integration', () => {
  it('keeps saved paragraph text when a trailing blank edit removes the block', async () => {
    const block = await createParagraph('to be deleted');
    const updateBlock = vi.spyOn(repositories.journals, 'updateBlock');
    const user = userEvent.setup();
    renderPane();

    const editor = await screen.findByLabelText('Write…');
    await user.clear(editor);
    await user.keyboard('{Backspace}');

    await user.click(await screen.findByText('Recently Deleted (1)'));
    expect(screen.getByText('to be deleted')).toBeVisible();
    expect(updateBlock).not.toHaveBeenCalled();

    const deleted = await repositories.journals.listDeletedBlocks(journalId);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.id).toBe(block.id);
    expect(deleted[0]?.content).toMatchObject({
      type: 'paragraph',
      text: 'to be deleted',
    });
    expect(deleted[0]?.revision).toBe(block.revision + 1);

    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByLabelText('Write…')).toHaveTextContent('to be deleted');
  });

  it('creates an editable Drawing block on page 5 and restores it from trash (AC-003)', async () => {
    const user = userEvent.setup();
    renderPane();
    await user.click(await screen.findByRole('button', { name: 'Draw a sketch.' }));
    const canvas = await screen.findByRole('img', { name: 'Editable drawing canvas, 0 strokes' });
    expect(canvas).toHaveFocus();

    const journal = await repositories.journals.getJournalById(journalId);
    const blocks = await repositories.journals.listBlocks(journal!.id);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('drawing');
    expect(blocks[0]?.sourceLocation?.pdf?.page).toBe(5);

    // Trash inside the debounce window must first preserve the latest stroke.
    prepareAndDraw(canvas);
    await user.click(screen.getByRole('button', { name: 'Move drawing to trash' }));
    const trash = await screen.findByText('Recently Deleted (1)');
    expect(trash).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByRole('img', { name: 'Drawing, 1 stroke' })).toBeVisible();
    const restored = (await repositories.journals.listBlocks(journalId))[0];
    expect(restored?.kind).toBe('drawing');
    expect((restored?.content as DrawingContent).drawingData.strokes).toHaveLength(1);
  });

  it('persists whole vector content through the guarded save and remount (AC-008)', async () => {
    const block = await createDrawing();
    const updateBlock = vi.spyOn(repositories.journals, 'updateBlock');
    const rendered = renderPane();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit drawing' }));
    prepareAndDraw(screen.getByRole('img', { name: /Editable drawing canvas/ }));

    await waitFor(async () => {
      const stored = await repositories.journals.getBlockById(block.id);
      expect(stored?.revision).toBe(1);
      expect((stored?.content as DrawingContent).drawingData.strokes).toHaveLength(1);
    }, { timeout: 2_000 });
    expect(updateBlock).toHaveBeenCalledTimes(1);

    rendered.unmount();
    renderPane();
    expect(await screen.findByRole('img', { name: 'Drawing, 1 stroke' })).toHaveAttribute('data-stroke-count', '1');
    const stored = await repositories.journals.getBlockById(block.id);
    expect((stored?.content as DrawingContent).drawingData.strokes[0]?.points).toHaveLength(3);
  });

  it('surfaces a revision conflict without overwriting the remote drawing', async () => {
    const block = await createDrawing();
    renderPane();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit drawing' }));
    await repositories.journals.updateBlock(
      { id: block.id, content: remoteStroke },
      expectedRevision(block.revision),
    );
    prepareAndDraw(screen.getByRole('img', { name: /Editable drawing canvas/ }));

    const conflict = await screen.findByRole('alert', {}, { timeout: 2_000 });
    expect(conflict).toHaveTextContent('Conflict:');
    expect(conflict).toHaveTextContent('Drawing — 1 stroke');
    const stored = await repositories.journals.getBlockById(block.id);
    expect((stored?.content as DrawingContent).drawingData.strokes[0]?.id).toBe('remote-stroke');
    expect(stored?.revision).toBe(1);
  });

  it('keeps a failed drawing edit visible and persists it through Retry', async () => {
    const block = await createDrawing();
    const originalUpdate = repositories.journals.updateBlock.bind(repositories.journals);
    vi.spyOn(repositories.journals, 'updateBlock')
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockImplementation(originalUpdate);
    renderPane();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit drawing' }));
    prepareAndDraw(screen.getByRole('img', { name: /Editable drawing canvas/ }));

    const retry = await screen.findByRole('button', { name: 'Retry saving' }, { timeout: 2_000 });
    expect(within(retry.closest('[role="alert"]')!).getByText(/still here/)).toBeVisible();
    await userEvent.click(retry);
    await waitFor(async () => {
      const stored = await repositories.journals.getBlockById(block.id);
      expect((stored?.content as DrawingContent).drawingData.strokes).toHaveLength(1);
    });
  });

  it('keeps a block intact and explains when its delete-triggered flush fails', async () => {
    const block = await createDrawing();
    const originalUpdate = repositories.journals.updateBlock.bind(repositories.journals);
    vi.spyOn(repositories.journals, 'updateBlock')
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockImplementation(originalUpdate);
    const user = userEvent.setup();
    renderPane();
    await user.click(await screen.findByRole('button', { name: 'Edit drawing' }));
    prepareAndDraw(screen.getByRole('img', { name: /Editable drawing canvas/ }));

    await user.click(screen.getByRole('button', { name: 'Move drawing to trash' }));

    const notice = await screen.findByText(
      'Could not move this to trash yet because the latest changes have not saved. Use Retry to finish saving, then delete again.',
    );
    expect(notice).toBeVisible();
    expect(screen.getByRole('img', { name: 'Editable drawing canvas, 1 stroke' })).toBeVisible();
    expect(await repositories.journals.listDeletedBlocks(journalId)).toEqual([]);
    expect((await repositories.journals.getBlockById(block.id))?.deletedAt).toBeUndefined();

    await user.click(within(notice).getByRole('button', { name: 'Retry saving' }));
    await waitFor(async () => {
      const stored = await repositories.journals.getBlockById(block.id);
      expect((stored?.content as DrawingContent).drawingData.strokes).toHaveLength(1);
      expect(screen.queryByText(/Could not move this to trash yet/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Move drawing to trash' }));
    expect(await screen.findByText('Recently Deleted (1)')).toBeVisible();
  });

  it('flushes pending drawing content on pagehide', async () => {
    const block = await createDrawing();
    const updateBlock = vi.spyOn(repositories.journals, 'updateBlock');
    renderPane();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit drawing' }));
    prepareAndDraw(screen.getByRole('img', { name: /Editable drawing canvas/ }));
    fireEvent(window, new Event('pagehide'));

    await waitFor(async () => {
      const stored = await repositories.journals.getBlockById(block.id);
      expect((stored?.content as DrawingContent).drawingData.strokes).toHaveLength(1);
    });
    expect(updateBlock).toHaveBeenCalledTimes(1);
  });
});
