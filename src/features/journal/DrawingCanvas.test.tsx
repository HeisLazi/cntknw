import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DrawingContent } from '@domain/index';
import { DrawingCanvas } from './DrawingCanvas';

const empty: DrawingContent = {
  type: 'drawing',
  drawingData: { version: 1, width: 800, height: 600, strokes: [] },
};

const withStrokes: DrawingContent = {
  type: 'drawing',
  drawingData: {
    version: 1,
    width: 800,
    height: 600,
    strokes: [
      {
        id: 'first',
        color: 'var(--cn-palette-ink-400)',
        width: 4,
        points: [{ x: 10, y: 20 }, { x: 100, y: 120 }],
      },
      {
        id: 'second',
        color: 'var(--cn-palette-accent-400)',
        width: 2,
        points: [{ x: 50, y: 40 }, { x: 180, y: 160 }],
      },
    ],
  },
};

function prepareCanvas(svg: HTMLElement) {
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
  const setPointerCapture = vi.fn();
  Object.defineProperty(svg, 'setPointerCapture', {
    configurable: true,
    value: setPointerCapture,
  });
  return setPointerCapture;
}

function drawStroke(svg: HTMLElement) {
  dispatchPointer(svg, 'pointerdown', 20, 30);
  dispatchPointer(svg, 'pointermove', 120, 90);
  dispatchPointer(svg, 'pointerup', 220, 150);
}

function dispatchPointer(svg: HTMLElement, type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  fireEvent(svg, event);
}

describe('DrawingCanvas', () => {
  it('draws vector points, announces the stroke, and renders it after remount', async () => {
    const onChange = vi.fn();
    const first = render(
      <DrawingCanvas content={empty} autoFocus onChange={onChange} onRemoveBlock={vi.fn()} />,
    );
    const svg = screen.getByRole('img', { name: /Editable drawing canvas/ });
    const setPointerCapture = prepareCanvas(svg);
    drawStroke(svg);

    expect(setPointerCapture).toHaveBeenCalledWith(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Added a stroke. 1 stroke.');
    const saved = onChange.mock.lastCall?.[0] as DrawingContent;
    expect(saved.drawingData.version).toBe(1);
    expect(saved.drawingData.strokes[0]?.points).toHaveLength(3);
    expect(saved.drawingData.strokes[0]?.points[0]).toEqual({ x: 40, y: 60 });
    expect(saved.drawingData.strokes[0]?.points[2]?.x).toBeCloseTo(440);
    expect(saved.drawingData.strokes[0]?.points[2]?.y).toBe(300);
    expect(saved.previewDataUrl).toBeUndefined();

    first.unmount();
    render(<DrawingCanvas content={saved} onChange={vi.fn()} onRemoveBlock={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Drawing, 1 stroke' })).toHaveAttribute(
      'data-stroke-count',
      '1',
    );
    expect(document.querySelector('.cn-drawing__stroke')).toHaveAttribute('d', expect.stringContaining('L'));
  });

  it('retains an existing preview data URL when vector content is edited', () => {
    const onChange = vi.fn();
    const previewDataUrl = 'data:image/png;base64,disposable-preview';
    render(
      <DrawingCanvas
        content={{ ...empty, previewDataUrl }}
        autoFocus
        onChange={onChange}
        onRemoveBlock={vi.fn()}
      />,
    );
    const svg = screen.getByRole('img', { name: /Editable drawing canvas/ });
    prepareCanvas(svg);
    drawStroke(svg);

    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      type: 'drawing',
      previewDataUrl,
    });
  });

  it('selects and deletes a stroke with the Delete key', async () => {
    const onChange = vi.fn();
    render(<DrawingCanvas content={withStrokes} autoFocus onChange={onChange} onRemoveBlock={vi.fn()} />);
    const paths = document.querySelectorAll<SVGPathElement>('.cn-drawing__stroke');
    fireEvent.click(paths[0]!);
    expect(screen.getByRole('status')).toHaveTextContent('Selected stroke 1. 2 strokes.');

    fireEvent.keyDown(screen.getByRole('img', { name: /Editable drawing canvas/ }), { key: 'Delete' });
    expect(onChange.mock.lastCall?.[0].drawingData.strokes.map((stroke: { id: string }) => stroke.id)).toEqual(['second']);
    expect(screen.getByRole('status')).toHaveTextContent('Deleted the selected stroke. 1 stroke.');
  });

  it('undoes through a keyboard-accessible button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DrawingCanvas content={withStrokes} autoFocus onChange={onChange} onRemoveBlock={vi.fn()} />);
    const undo = screen.getByRole('button', { name: 'Undo last stroke' });
    undo.focus();
    await user.keyboard('{Enter}');
    expect(onChange.mock.lastCall?.[0].drawingData.strokes).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Undid the last stroke. 1 stroke.');
  });

  it('clears only after confirmation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DrawingCanvas content={withStrokes} autoFocus onChange={onChange} onRemoveBlock={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Clear drawing' }));
    const dialog = screen.getByRole('dialog', { name: 'Clear this drawing?' });
    expect(onChange).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Clear drawing' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear drawing' }));
    expect(onChange.mock.lastCall?.[0].drawingData.strokes).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Cleared the drawing. 0 strokes.');
  });

  it('enters from the focused block and Escape returns to read mode', async () => {
    const user = userEvent.setup();
    render(<DrawingCanvas content={empty} onChange={vi.fn()} onRemoveBlock={vi.fn()} />);
    const block = screen.getByRole('group', { name: 'Drawing block, 0 strokes' });
    block.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('img', { name: /Editable drawing canvas/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit drawing' })).toHaveFocus());
  });
});
