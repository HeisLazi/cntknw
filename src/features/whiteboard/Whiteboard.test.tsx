import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryProvider } from '@app/providers/RepositoryProvider';
import { createMemoryRepositories, type MemoryRepositories } from '@data/adapters/memory';
import { expectedRevision } from '@data/repositories/concurrency';
import type { DrawingContent, JournalBlock, SourceLocation, WhiteboardState } from '@domain/index';
import { recoverDrafts, stashDraft } from '@features/journal/draftBuffer';
import { Whiteboard } from './Whiteboard';

let repositories: MemoryRepositories;
let sourceId: string;
let journalId: string;
let location: SourceLocation;

function ControlledWhiteboard({
  onLayout = vi.fn(),
  initialState,
}: {
  onLayout?: (state: WhiteboardState) => void;
  initialState?: WhiteboardState;
}) {
  const [state, setState] = useState<WhiteboardState>(initialState ?? {
    viewport: { x: 0, y: 0, zoom: 1 },
    layout: {},
  });
  return (
    <Whiteboard
      sourceId={sourceId}
      journalId={journalId}
      location={location}
      state={state}
      active
      onViewportDrift={(viewport) => setState((current) => ({ ...current, viewport }))}
      onViewportCommit={(viewport) => setState((current) => ({ ...current, viewport }))}
      onLayoutCommit={(layout) => setState((current) => {
        const next = { ...current, layout };
        onLayout(next);
        return next;
      })}
    />
  );
}

async function mountBoard(
  onLayout?: (state: WhiteboardState) => void,
  initialState?: WhiteboardState,
) {
  const result = render(
    <RepositoryProvider repositories={repositories}>
      <ControlledWhiteboard onLayout={onLayout} initialState={initialState} />
    </RepositoryProvider>,
  );
  const canvas = await screen.findByRole('application', { name: 'Infinite whiteboard canvas' });
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 20, top: 40, width: 800, height: 600,
    right: 820, bottom: 640, x: 20, y: 40,
    toJSON: () => ({}),
  });
  return { ...result, canvas };
}

function pointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
  pointerId = 1,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  fireEvent(target, event);
}

beforeEach(async () => {
  localStorage.clear();
  repositories = createMemoryRepositories();
  const source = await repositories.sources.create({ type: 'book', title: 'Whiteboard source' });
  const journal = await repositories.journals.getOrCreateJournalForSource(source.id, source.title);
  sourceId = source.id;
  journalId = journal.id;
  location = { sourceType: 'book', sourceId, pdf: { page: 7 } };
});

const drawingWithStrokes = (ids: string[], color = '#ebdbb2'): DrawingContent => ({
  type: 'drawing',
  drawingData: {
    version: 1,
    width: 200,
    height: 120,
    strokes: ids.map((id, index) => ({
      id,
      color,
      width: 4,
      points: [{ x: 10, y: 10 + index }, { x: 100, y: 80 + index }],
    })),
  },
});

async function createBoardParagraph(text: string): Promise<JournalBlock> {
  return repositories.journals.createBlock({
    journalId,
    kind: 'paragraph',
    rank: 'm',
    sourceLocation: location,
    content: { type: 'paragraph', text },
  });
}

async function createBoardDrawing(content = drawingWithStrokes(['local-stroke'])): Promise<JournalBlock> {
  return repositories.journals.createBlock({
    journalId,
    kind: 'drawing',
    rank: 'm',
    sourceLocation: location,
    content,
  });
}

const boardStateFor = (block: JournalBlock): WhiteboardState => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  layout: { [block.id]: { x: 10, y: 20 } },
});

describe('Whiteboard canonical projection', () => {
  it('uses a quick swatch for the next stroke and recolors only through the explicit selection action', async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(repositories.journals, 'updateBlock');
    const { canvas } = await mountBoard();
    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Pen' }));

    pointer(canvas, 'pointerdown', 80, 110);
    pointer(canvas, 'pointermove', 150, 180);
    expect(await repositories.journals.listBlocks(journalId)).toEqual([]);
    pointer(canvas, 'pointerup', 210, 220);

    await waitFor(async () => {
      const blocks = await repositories.journals.listBlocks(journalId);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        kind: 'drawing',
        sourceLocation: { pdf: { page: 7 } },
        content: { type: 'drawing', whiteboardStyle: { tool: 'pen' } },
      });
      expect(blocks[0]?.content.type === 'drawing' && blocks[0].content.drawingData.strokes[0]?.color)
        .toBe('#cc241d');
    });
    expect(canvas).toHaveAttribute('data-object-count', '1');

    await user.click(screen.getByRole('button', { name: 'Blue' }));
    expect(update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply color to selection' }));
    await waitFor(() => expect(update).toHaveBeenCalled(), { timeout: 1_500 });
    expect(update.mock.calls.at(-1)?.[1]).toEqual({ mode: 'expected', revision: 0 });
    await waitFor(async () => {
      const saved = (await repositories.journals.listBlocks(journalId))[0]!;
      expect(saved.content.type === 'drawing' && saved.content.drawingData.strokes[0]?.color)
        .toBe('#458588');
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Hex color' }), {
      target: { value: '#123456' },
    });
    expect(screen.getByRole('button', { name: 'Recent color #123456' }))
      .toHaveClass('cn-whiteboard__swatch--recent');
  });

  it('creates canonical paragraph text and edits it in place', async () => {
    const user = userEvent.setup();
    const { canvas } = await mountBoard();
    await user.click(screen.getByRole('button', { name: 'Text' }));
    pointer(canvas, 'pointerdown', 260, 190, 2);
    pointer(canvas, 'pointerup', 260, 190, 2);

    const draft = await screen.findByRole('textbox', { name: 'New whiteboard text' });
    await user.type(draft, 'A spatial note');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(async () => {
      const blocks = await repositories.journals.listBlocks(journalId);
      expect(blocks[0]).toMatchObject({
        kind: 'paragraph',
        sourceLocation: { pdf: { page: 7 } },
        content: { type: 'paragraph', text: 'A spatial note' },
      });
    });
    const object = document.querySelector('[data-kind="paragraph"]');
    expect(object).not.toBeNull();
    fireEvent.doubleClick(object!);
    const editor = await screen.findByRole('textbox', { name: 'Edit whiteboard text' });
    await user.clear(editor);
    await user.type(editor, 'An edited spatial note');
    fireEvent.blur(editor);

    await waitFor(async () => {
      const block = (await repositories.journals.listBlocks(journalId))[0]!;
      expect(block.content).toMatchObject({ type: 'paragraph', text: 'An edited spatial note' });
      expect(block.content.type === 'paragraph' && block.content.doc).toBeUndefined();
    }, { timeout: 1_500 });
  });

  it('keeps toolbar button activation on the button instead of treating Space as a canvas shortcut', async () => {
    const user = userEvent.setup();
    await mountBoard();
    const pen = screen.getByRole('button', { name: 'Pen' });
    pen.focus();
    await user.keyboard(' ');
    expect(pen).toHaveFocus();
    expect(pen).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hand' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('measures long rendered text for its editor and hitbox and exposes its length in the name', async () => {
    const user = userEvent.setup();
    const text = 'A long whiteboard paragraph whose rendered width must not be clipped by a fixed box.';
    const block = await repositories.journals.createBlock({
      journalId,
      kind: 'paragraph',
      rank: 'm',
      sourceLocation: location,
      content: { type: 'paragraph', text, whiteboardStyle: { color: '#ebdbb2', fontSize: 20 } },
    });
    const getBBox = vi.fn(() => ({ x: 0, y: 0, width: 720, height: 28 }));
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: getBBox,
    });
    const { canvas } = await mountBoard(undefined, {
      viewport: { x: 0, y: 0, zoom: 1 },
      layout: { [block.id]: { x: 10, y: 20 } },
    });

    const object = await screen.findByRole('button', {
      name: `Text object, ${text.length} characters, from page 7`,
    });
    await waitFor(() => {
      const hitbox = object.querySelector<SVGRectElement>('.cn-whiteboard__hitbox');
      expect(Number(hitbox?.getAttribute('width'))).toBeGreaterThan(720);
    });
    fireEvent.doubleClick(object);
    const editor = await screen.findByRole('textbox', { name: 'Edit whiteboard text' });
    const foreignObject = editor.closest('foreignObject');
    expect(Number(foreignObject?.getAttribute('width'))).toBeGreaterThan(720);

    const measurementsBeforeZoom = getBBox.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(getBBox.mock.calls.length).toBeGreaterThan(measurementsBeforeZoom));
    expect(canvas).toHaveAttribute('data-zoom', '1.2');
  });

  it('drops a stale text doc so BlockEditor remains the only rich-doc producer', async () => {
    const user = userEvent.setup();
    const block = await repositories.journals.createBlock({
      journalId,
      kind: 'paragraph',
      rank: 'm',
      sourceLocation: location,
      content: {
        type: 'paragraph',
        text: 'ignored at the repository boundary',
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old rich text' }] }] },
      },
    });
    await mountBoard(undefined, {
      viewport: { x: 0, y: 0, zoom: 1 },
      layout: { [block.id]: { x: 10, y: 20 } },
    });
    const object = await screen.findByRole('button', { name: /Text object, 13 characters/ });
    fireEvent.doubleClick(object);
    const editor = await screen.findByRole('textbox', { name: 'Edit whiteboard text' });
    await user.clear(editor);
    await user.type(editor, 'Whiteboard plain text');
    fireEvent.blur(editor);

    await waitFor(async () => {
      const saved = await repositories.journals.getBlockById(block.id);
      expect(saved?.content).toEqual({ type: 'paragraph', text: 'Whiteboard plain text' });
    }, { timeout: 1_500 });
  });

  it('preserves both paragraph truths, blocks Delete and Clear, and applies Keep Saved explicitly', async () => {
    const user = userEvent.setup();
    const block = await createBoardParagraph('original paragraph');
    const { canvas } = await mountBoard(undefined, boardStateFor(block));
    fireEvent.doubleClick(await screen.findByRole('button', { name: /Text object/ }));
    const editor = await screen.findByRole('textbox', { name: 'Edit whiteboard text' });
    await user.clear(editor);
    await user.type(editor, 'local paragraph truth');
    fireEvent.blur(editor);
    await repositories.journals.updateBlock({
      id: block.id,
      content: { type: 'paragraph', text: 'remote paragraph truth' },
    }, expectedRevision(block.revision));

    const conflict = await screen.findByRole('alert', {}, { timeout: 2_000 });
    expect(conflict).toHaveTextContent('Saved version: remote paragraph truth');
    expect(conflict).toHaveTextContent('Your version: local paragraph truth');
    expect(within(canvas).getByText('local paragraph truth')).toBeVisible();
    expect((await repositories.journals.getBlockById(block.id))?.content)
      .toMatchObject({ type: 'paragraph', text: 'remote paragraph truth' });

    fireEvent.keyDown(canvas, { key: 'Delete' });
    await waitFor(() => expect(screen.getByText(
      'Resolve this object conflict before deleting it.',
    )).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('button', { name: 'Clear whiteboard' })).not.toBeInTheDocument();
    expect(screen.getByText('Resolve object conflicts before clearing the whiteboard.'))
      .toBeInTheDocument();
    expect(await repositories.journals.listBlocks(journalId)).toHaveLength(1);
    expect(await repositories.journals.listDeletedBlocks(journalId)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Keep Saved' }));
    await waitFor(async () => {
      expect(screen.queryByText('Conflict:')).not.toBeInTheDocument();
      expect((await repositories.journals.getBlockById(block.id))?.content)
        .toMatchObject({ type: 'paragraph', text: 'remote paragraph truth' });
    });
    expect(canvas).toHaveAttribute('data-object-count', '1');
    expect(recoverDrafts().has(block.id)).toBe(false);
  });

  it('preserves drawing truths, applies Use My Version, and cannot replay stale Undo or Redo history', async () => {
    const user = userEvent.setup();
    const block = await createBoardDrawing();
    await mountBoard(undefined, boardStateFor(block));
    const object = await screen.findByRole('button', { name: /Drawing object/ });
    object.focus();
    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Apply color to selection' }));
    await repositories.journals.updateBlock({
      id: block.id,
      content: drawingWithStrokes(['remote-one', 'remote-two'], '#458588'),
    }, expectedRevision(block.revision));

    const conflict = await screen.findByRole('alert', {}, { timeout: 2_000 });
    expect(conflict).toHaveTextContent('Saved version: Drawing — 2 strokes');
    expect(conflict).toHaveTextContent('Your version: Drawing — 1 stroke');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(await screen.findByText(
      'Undo and redo history was reset because an object changed elsewhere.',
    )).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use My Version' }));
    await waitFor(async () => {
      const saved = await repositories.journals.getBlockById(block.id);
      expect(saved?.content.type === 'drawing' && saved.content.drawingData.strokes).toHaveLength(1);
      expect(saved?.content.type === 'drawing' && saved.content.drawingData.strokes[0]?.color)
        .toBe('#cc241d');
    });
    expect(screen.queryByText('Conflict:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('keeps a failed resolution retryable and preserves both truths until Retry succeeds', async () => {
    const user = userEvent.setup();
    const block = await createBoardParagraph('original');
    await mountBoard(undefined, boardStateFor(block));
    fireEvent.doubleClick(await screen.findByRole('button', { name: /Text object/ }));
    const editor = await screen.findByRole('textbox', { name: 'Edit whiteboard text' });
    await user.clear(editor);
    await user.type(editor, 'local retry truth');
    fireEvent.blur(editor);
    await repositories.journals.updateBlock({
      id: block.id,
      content: { type: 'paragraph', text: 'remote retry truth' },
    }, expectedRevision(block.revision));
    await screen.findByRole('alert', {}, { timeout: 2_000 });

    vi.spyOn(repositories.journals, 'updateBlock').mockRejectedValueOnce(new Error('write failed'));
    await user.click(screen.getByRole('button', { name: 'Use My Version' }));
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByRole('alert')).toHaveTextContent('Both versions are still preserved.');
    expect((await repositories.journals.getBlockById(block.id))?.content)
      .toMatchObject({ type: 'paragraph', text: 'remote retry truth' });

    await user.click(retry);
    await waitFor(async () => {
      expect((await repositories.journals.getBlockById(block.id))?.content)
        .toMatchObject({ type: 'paragraph', text: 'local retry truth' });
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
    expect(await repositories.journals.listBlocks(journalId)).toHaveLength(1);
  });

  it('recovers exact whiteboard text across the pre-debounce crash window without copies', async () => {
    const user = userEvent.setup();
    const block = await createBoardParagraph('saved text');
    const initialState = boardStateFor(block);
    const rendered = await mountBoard(undefined, initialState);
    fireEvent.doubleClick(await screen.findByRole('button', { name: /Text object/ }));
    const editor = await screen.findByRole('textbox', { name: 'Edit whiteboard text' });
    await user.clear(editor);
    await user.type(editor, 'exact crash-window text');
    fireEvent.blur(editor);
    expect(recoverDrafts().get(block.id)?.text).toBe('exact crash-window text');

    const update = vi.spyOn(repositories.journals, 'updateBlock').mockRejectedValue(new Error('page closing'));
    fireEvent(window, new Event('pagehide'));
    await screen.findByRole('button', { name: 'Retry saving' });
    rendered.unmount();
    update.mockRestore();

    await mountBoard(undefined, initialState);
    expect(await screen.findByText('exact crash-window text')).toBeVisible();
    await waitFor(async () => {
      const blocks = await repositories.journals.listBlocks(journalId);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.id).toBe(block.id);
      expect(blocks[0]?.sourceLocation).toEqual(location);
      expect(blocks[0]?.content).toMatchObject({ type: 'paragraph', text: 'exact crash-window text' });
      expect(recoverDrafts().has(block.id)).toBe(false);
    });
  });

  it('flushes whole drawing content on pagehide before the debounce expires', async () => {
    const user = userEvent.setup();
    const block = await createBoardDrawing();
    await mountBoard(undefined, boardStateFor(block));
    (await screen.findByRole('button', { name: /Drawing object/ })).focus();
    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Apply color to selection' }));
    const update = vi.spyOn(repositories.journals, 'updateBlock');
    fireEvent(window, new Event('pagehide'));

    await waitFor(async () => {
      const saved = await repositories.journals.getBlockById(block.id);
      expect(saved?.content.type === 'drawing' && saved.content.drawingData.strokes[0]?.color)
        .toBe('#cc241d');
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(await repositories.journals.listBlocks(journalId)).toHaveLength(1);
  });

  it('keeps failed recovered text visible and retryable', async () => {
    const user = userEvent.setup();
    const block = await createBoardParagraph('saved text');
    stashDraft({ blockId: block.id, doc: undefined, text: 'recovered local text' });
    vi.spyOn(repositories.journals, 'updateBlock').mockRejectedValueOnce(new Error('disk unavailable'));
    await mountBoard(undefined, boardStateFor(block));

    expect(await screen.findByText('recovered local text')).toBeVisible();
    const retry = await screen.findByRole('button', { name: 'Retry saving' });
    expect(recoverDrafts().get(block.id)?.text).toBe('recovered local text');
    await user.click(retry);
    await waitFor(async () => {
      expect((await repositories.journals.getBlockById(block.id))?.content)
        .toMatchObject({ type: 'paragraph', text: 'recovered local text' });
      expect(recoverDrafts().has(block.id)).toBe(false);
    });
    expect(await repositories.journals.listBlocks(journalId)).toHaveLength(1);
  });

  it('keeps a transiently failed edit pending and refuses to clear its canonical object', async () => {
    const user = userEvent.setup();
    const { canvas } = await mountBoard();
    await user.click(screen.getByRole('button', { name: 'Pen' }));
    pointer(canvas, 'pointerdown', 80, 110);
    pointer(canvas, 'pointerup', 210, 220);
    await waitFor(() => expect(canvas).toHaveAttribute('data-object-count', '1'));

    vi.spyOn(repositories.journals, 'updateBlock')
      .mockRejectedValueOnce(new Error('storage temporarily unavailable'));
    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Apply color to selection' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: 'Clear whiteboard' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to save this object. Your changes are still visible.',
    ));
    expect(await repositories.journals.listBlocks(journalId)).toHaveLength(1);
    expect(await repositories.journals.listDeletedBlocks(journalId)).toHaveLength(0);
    expect(canvas).toHaveAttribute('data-object-count', '1');
  });

  it('stores an arrow as one stroke and keeps its rendered arrowhead screen-stable at minimum zoom', async () => {
    const user = userEvent.setup();
    const { canvas } = await mountBoard();
    await user.click(screen.getByRole('button', { name: 'Arrow' }));
    pointer(canvas, 'pointerdown', 100, 140);
    pointer(canvas, 'pointerup', 260, 220);
    await waitFor(async () => {
      const block = (await repositories.journals.listBlocks(journalId))[0];
      expect(block?.content.type === 'drawing' && block.content.drawingData.strokes).toHaveLength(1);
    });
    for (let index = 0; index < 14; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    }
    expect(canvas).toHaveAttribute('data-zoom', '0.1');
    const marker = document.querySelector('marker[data-screen-stable-arrowhead="true"]');
    expect(marker).toHaveAttribute('markerUnits', 'userSpaceOnUse');
    expect(Number(marker?.getAttribute('markerWidth'))).toBe(160);
    expect(document.querySelectorAll('.cn-whiteboard__object-stroke')).toHaveLength(1);
  });
});
