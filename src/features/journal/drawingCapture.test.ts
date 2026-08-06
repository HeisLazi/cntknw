import { describe, expect, it, vi } from 'vitest';
import {
  appendDrawingPoint,
  beginDrawingCapture,
  finishDrawingCapture,
  pointerToDrawingPoint,
  type DrawingPointerInput,
} from './drawingCapture';

const drawing = { width: 800, height: 600 };

function pointer(
  clientX: number,
  clientY: number,
  overrides: Partial<DrawingPointerInput> = {},
): DrawingPointerInput {
  return {
    pointerId: 7,
    isPrimary: true,
    clientX,
    clientY,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 300 }),
      setPointerCapture: vi.fn(),
    },
    ...overrides,
  };
}

describe('drawing pointer capture', () => {
  it('converts client pixels to canvas-local viewBox points', () => {
    expect(pointerToDrawingPoint(pointer(300, 200), drawing)).toEqual({ x: 400, y: 300 });
  });

  it('captures a normal primary drag and uses pointer capture', () => {
    const start = pointer(100, 50);
    const capture = beginDrawingCapture(start, drawing)!;
    expect(start.currentTarget.setPointerCapture).toHaveBeenCalledWith(7);

    const moved = appendDrawingPoint(capture, pointer(200, 125), drawing);
    expect(finishDrawingCapture(moved, pointer(300, 200), drawing)).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 150 },
      { x: 400, y: 300 },
    ]);
  });

  it('ignores a degenerate drag', () => {
    const start = pointer(200, 125);
    const capture = beginDrawingCapture(start, drawing)!;
    expect(finishDrawingCapture(capture, pointer(200.2, 125.2), drawing)).toBeNull();
  });

  it('refuses a non-primary pointer without taking capture', () => {
    const secondary = pointer(200, 125, { isPrimary: false });
    expect(beginDrawingCapture(secondary, drawing)).toBeNull();
    expect(secondary.currentTarget.setPointerCapture).not.toHaveBeenCalled();
  });

  it('clamps points to the canvas bounds and rejects zero-sized targets', () => {
    expect(pointerToDrawingPoint(pointer(20, 900), drawing)).toEqual({ x: 0, y: 600 });
    const target = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
      setPointerCapture: vi.fn(),
    };
    expect(pointerToDrawingPoint(pointer(0, 0, { currentTarget: target }), drawing)).toBeNull();
  });
});
