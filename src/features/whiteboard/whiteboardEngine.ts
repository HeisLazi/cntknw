import type {
  DrawingContent,
  DrawingPoint,
  DrawingStroke,
  WhiteboardPosition,
  WhiteboardViewport,
} from '@domain/index';

export const WHITEBOARD_TOOLS = [
  'select',
  'pen',
  'pencil',
  'highlighter',
  'eraser',
  'line',
  'arrow',
  'rectangle',
  'ellipse',
  'text',
  'hand',
] as const;

export type WhiteboardTool = (typeof WHITEBOARD_TOOLS)[number];
export type DrawingTool = Exclude<
  WhiteboardTool,
  'select' | 'eraser' | 'text' | 'hand'
>;

export interface ClientBox {
  left: number;
  top: number;
}

export interface DrawingGesture {
  tool: DrawingTool;
  points: DrawingPoint[];
}

export interface DrawingOptions {
  color: string;
  width: number;
  opacity: number;
  fill?: string;
}

export interface DrawingCommit {
  content: DrawingContent;
  position: WhiteboardPosition;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** DOM client coordinates enter canonical board space only at this boundary. */
export function screenToWorld(
  client: DrawingPoint,
  rect: ClientBox,
  viewport: WhiteboardViewport,
): DrawingPoint {
  return {
    x: (client.x - rect.left) / viewport.zoom - viewport.x,
    y: (client.y - rect.top) / viewport.zoom - viewport.y,
  };
}

export function worldToScreen(
  world: DrawingPoint,
  rect: ClientBox,
  viewport: WhiteboardViewport,
): DrawingPoint {
  return {
    x: rect.left + (world.x + viewport.x) * viewport.zoom,
    y: rect.top + (world.y + viewport.y) * viewport.zoom,
  };
}

/** Zoom without moving the board point underneath the cursor. */
export function zoomViewportAt(
  viewport: WhiteboardViewport,
  screenPoint: DrawingPoint,
  nextZoom: number,
): WhiteboardViewport {
  const zoom = clampZoom(nextZoom);
  const world = {
    x: screenPoint.x / viewport.zoom - viewport.x,
    y: screenPoint.y / viewport.zoom - viewport.y,
  };
  return {
    x: screenPoint.x / zoom - world.x,
    y: screenPoint.y / zoom - world.y,
    zoom,
  };
}

export function beginToolGesture(
  tool: WhiteboardTool,
  point: DrawingPoint,
): DrawingGesture | null {
  if (![
    'pen',
    'pencil',
    'highlighter',
    'line',
    'arrow',
    'rectangle',
    'ellipse',
  ].includes(tool)) return null;
  return { tool: tool as DrawingTool, points: [point] };
}

export function appendToolGesture(
  gesture: DrawingGesture,
  point: DrawingPoint,
): DrawingGesture {
  const last = gesture.points.at(-1);
  if (!last) return gesture;
  if (gesture.tool === 'pen' || gesture.tool === 'pencil' || gesture.tool === 'highlighter') {
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.5) return gesture;
    return { ...gesture, points: [...gesture.points, point] };
  }
  return { ...gesture, points: [gesture.points[0]!, point] };
}

export function cancelToolGesture(): null {
  return null;
}

function totalTravel(points: readonly DrawingPoint[]): number {
  return points.slice(1).reduce((sum, point, index) => {
    const previous = points[index]!;
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function rectanglePoints(start: DrawingPoint, end: DrawingPoint): DrawingPoint[] {
  return [
    start,
    { x: end.x, y: start.y },
    end,
    { x: start.x, y: end.y },
    start,
  ];
}

function ellipsePoints(start: DrawingPoint, end: DrawingPoint): DrawingPoint[] {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;
  return Array.from({ length: 33 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function pencilPoints(points: readonly DrawingPoint[]): DrawingPoint[] {
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const offset = index % 2 === 0 ? 0.45 : -0.45;
    return { x: point.x + offset, y: point.y - offset };
  });
}

interface RawStroke {
  points: DrawingPoint[];
}

function rawStrokes(gesture: DrawingGesture): RawStroke[] {
  const start = gesture.points[0]!;
  const end = gesture.points.at(-1)!;
  switch (gesture.tool) {
    case 'rectangle':
      return [{ points: rectanglePoints(start, end) }];
    case 'ellipse':
      return [{ points: ellipsePoints(start, end) }];
    case 'arrow': {
      // The shaft is one canonical stroke, so recolouring and undo can
      // never split an arrow into independently styled fragments. The
      // screen-stable arrowhead is a rendering concern (SVG marker).
      return [{ points: [start, end] }];
    }
    case 'line':
      return [{ points: [start, end] }];
    case 'pencil':
      return [{ points: pencilPoints(gesture.points) }];
    default:
      return [{ points: gesture.points }];
  }
}

export function commitToolGesture(
  gesture: DrawingGesture,
  options: DrawingOptions,
  createId: () => string,
): DrawingCommit | null {
  if (gesture.points.length < 2 || totalTravel(gesture.points) < 2) return null;
  const raw = rawStrokes(gesture);
  const all = raw.flatMap((stroke) => stroke.points);
  const padding = Math.max(1, options.width / 2);
  const minX = Math.min(...all.map((point) => point.x)) - padding;
  const minY = Math.min(...all.map((point) => point.y)) - padding;
  const maxX = Math.max(...all.map((point) => point.x)) + padding;
  const maxY = Math.max(...all.map((point) => point.y)) + padding;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const strokeWidth = gesture.tool === 'pencil'
    ? Math.max(1, options.width * 0.65)
    : gesture.tool === 'highlighter'
      ? Math.max(12, options.width * 3)
      : options.width;
  const opacity = gesture.tool === 'highlighter'
    ? Math.min(0.35, options.opacity)
    : gesture.tool === 'pencil'
      ? Math.min(0.78, options.opacity)
      : options.opacity;
  const strokes: DrawingStroke[] = raw.map((stroke) => ({
    id: createId(),
    color: options.color,
    width: strokeWidth,
    opacity,
    points: stroke.points.map((point) => ({
      x: point.x - minX,
      y: point.y - minY,
    })),
  }));
  return {
    position: { x: minX, y: minY },
    content: {
      type: 'drawing',
      drawingData: { version: 1, width, height, strokes },
      whiteboardStyle: {
        tool: gesture.tool,
        ...((gesture.tool === 'rectangle' || gesture.tool === 'ellipse') && options.fill
          ? { fill: options.fill }
          : {}),
      },
    },
  };
}

export function drawingPath(points: readonly DrawingPoint[], smooth = false): string {
  const first = points[0];
  if (!first) return '';
  if (!smooth || points.length < 3) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  }
  const sections = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const next = points[index + 1]!;
    sections.push(`Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`);
  }
  const last = points.at(-1)!;
  sections.push(`L ${last.x} ${last.y}`);
  return sections.join(' ');
}
