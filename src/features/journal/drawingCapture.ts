import type { DrawingData, DrawingPoint } from '@domain/index';

export interface DrawingClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DrawingPointerTarget {
  getBoundingClientRect(): DrawingClientRect;
  setPointerCapture(pointerId: number): void;
}

export interface DrawingPointerInput {
  pointerId: number;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
  currentTarget: DrawingPointerTarget;
}

export interface DrawingCapture {
  pointerId: number;
  points: DrawingPoint[];
}

const POINT_SAMPLE_DISTANCE = 0.5;
const MINIMUM_STROKE_DISTANCE = 2;

function distance(a: DrawingPoint, b: DrawingPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Convert client pixels at the DOM boundary into stable canvas-local units. */
export function pointerToDrawingPoint(
  pointer: Pick<DrawingPointerInput, 'clientX' | 'clientY' | 'currentTarget'>,
  drawing: Pick<DrawingData, 'width' | 'height'>,
): DrawingPoint | null {
  const rect = pointer.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = ((pointer.clientX - rect.left) / rect.width) * drawing.width;
  const y = ((pointer.clientY - rect.top) / rect.height) * drawing.height;
  return {
    x: Math.min(drawing.width, Math.max(0, x)),
    y: Math.min(drawing.height, Math.max(0, y)),
  };
}

export function beginDrawingCapture(
  pointer: DrawingPointerInput,
  drawing: Pick<DrawingData, 'width' | 'height'>,
): DrawingCapture | null {
  if (!pointer.isPrimary) return null;
  const point = pointerToDrawingPoint(pointer, drawing);
  if (!point) return null;
  pointer.currentTarget.setPointerCapture(pointer.pointerId);
  return { pointerId: pointer.pointerId, points: [point] };
}

export function appendDrawingPoint(
  capture: DrawingCapture,
  pointer: DrawingPointerInput,
  drawing: Pick<DrawingData, 'width' | 'height'>,
): DrawingCapture {
  if (!pointer.isPrimary || pointer.pointerId !== capture.pointerId) return capture;
  const point = pointerToDrawingPoint(pointer, drawing);
  const previous = capture.points.at(-1);
  if (!point || !previous || distance(previous, point) < POINT_SAMPLE_DISTANCE) {
    return capture;
  }
  return { ...capture, points: [...capture.points, point] };
}

export function finishDrawingCapture(
  capture: DrawingCapture,
  pointer: DrawingPointerInput,
  drawing: Pick<DrawingData, 'width' | 'height'>,
): DrawingPoint[] | null {
  const completed = appendDrawingPoint(capture, pointer, drawing);
  if (completed.points.length < 2) return null;
  const travelled = completed.points.slice(1).reduce(
    (sum, point, index) => sum + distance(completed.points[index]!, point),
    0,
  );
  return travelled < MINIMUM_STROKE_DISTANCE ? null : completed.points;
}
