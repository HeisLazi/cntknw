import { describe, expect, it } from 'vitest';
import {
  appendToolGesture,
  beginToolGesture,
  cancelToolGesture,
  commitToolGesture,
  screenToWorld,
  worldToScreen,
  zoomViewportAt,
} from './whiteboardEngine';

describe('whiteboard coordinate and gesture engine', () => {
  it('round-trips screen and world coordinates after pan and zoom', () => {
    const viewport = { x: -120, y: 48, zoom: 2.5 };
    const rect = { left: 35, top: 70 };
    const world = screenToWorld({ x: 410, y: 245 }, rect, viewport);
    expect(world).toEqual({ x: 270, y: 22 });
    expect(worldToScreen(world, rect, viewport)).toEqual({ x: 410, y: 245 });

    const zoomed = zoomViewportAt(viewport, { x: 375, y: 175 }, 3.5);
    const before = screenToWorld({ x: 410, y: 245 }, rect, viewport);
    const after = screenToWorld({ x: 410, y: 245 }, rect, zoomed);
    expect(after).toEqual(before);
  });

  it('never mutates stored geometry when the viewport changes', () => {
    const started = beginToolGesture('pen', { x: 10, y: 20 })!;
    const gesture = appendToolGesture(started, { x: 45, y: 70 });
    const committed = commitToolGesture(gesture, {
      color: '#ebdbb2', width: 4, opacity: 1,
    }, () => 'stroke-1')!;
    const geometry = structuredClone(committed.content.drawingData);

    zoomViewportAt({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 100 }, 4);
    zoomViewportAt({ x: 900, y: -300, zoom: 0.4 }, { x: 2, y: 8 }, 0.1);

    expect(committed.content.drawingData).toEqual(geometry);
  });

  it('starts, updates, commits, and cancels tool gestures without fake tools', () => {
    expect(beginToolGesture('select', { x: 0, y: 0 })).toBeNull();
    expect(beginToolGesture('eraser', { x: 0, y: 0 })).toBeNull();
    expect(cancelToolGesture()).toBeNull();

    const started = beginToolGesture('rectangle', { x: 20, y: 30 })!;
    const updated = appendToolGesture(started, { x: 120, y: 90 });
    const committed = commitToolGesture(updated, {
      color: '#98971a', width: 3, opacity: 0.9, fill: '#98971a',
    }, () => 'shape-stroke');

    expect(committed?.content.whiteboardStyle).toEqual({
      tool: 'rectangle',
      fill: '#98971a',
    });
    expect(committed?.content.drawingData.strokes[0]?.points).toHaveLength(5);
    expect(committed?.content.drawingData.strokes[0]?.points[0]).toEqual(
      committed?.content.drawingData.strokes[0]?.points.at(-1),
    );
  });

  it('builds a proper vector arrowhead and distinct pencil/highlighter strokes', () => {
    const gesture = appendToolGesture(beginToolGesture('arrow', { x: 0, y: 0 })!, { x: 90, y: 40 });
    const arrow = commitToolGesture(gesture, {
      color: '#458588', width: 4, opacity: 1,
    }, (() => { let id = 0; return () => `arrow-${id += 1}`; })())!;
    expect(arrow.content.drawingData.strokes).toHaveLength(1);
    expect(arrow.content.drawingData.strokes[0]?.points).toHaveLength(2);

    const highlighter = commitToolGesture(
      appendToolGesture(beginToolGesture('highlighter', { x: 0, y: 0 })!, { x: 40, y: 10 }),
      { color: '#d79921', width: 4, opacity: 1 },
      () => 'highlight',
    )!;
    expect(highlighter.content.drawingData.strokes[0]).toMatchObject({ width: 12, opacity: 0.35 });
  });
});
