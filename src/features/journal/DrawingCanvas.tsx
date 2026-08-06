import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ConfirmDialog } from '@components/primitives';
import type { DrawingContent, DrawingData, DrawingPoint, DrawingStroke } from '@domain/index';
import { createEntityId } from '@lib/id';
import {
  appendDrawingPoint,
  beginDrawingCapture,
  finishDrawingCapture,
  type DrawingCapture,
} from './drawingCapture';

const DRAWING_COLORS = [
  { label: 'Graphite', value: 'var(--cn-palette-ink-400)' },
  { label: 'Verdigris', value: 'var(--cn-palette-accent-400)' },
  { label: 'Ochre', value: 'var(--cn-palette-warning-300)' },
] as const;

const DRAWING_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Regular', value: 4 },
  { label: 'Broad', value: 7 },
] as const;

export interface DrawingCanvasProps {
  content: DrawingContent;
  autoFocus?: boolean;
  onChange: (content: DrawingContent) => void;
  onRemoveBlock: () => void;
}

export function drawingPath(points: readonly DrawingPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function strokeCountText(count: number): string {
  return `${count} ${count === 1 ? 'stroke' : 'strokes'}`;
}

export function DrawingCanvas({
  content,
  autoFocus = false,
  onChange,
  onRemoveBlock,
}: DrawingCanvasProps) {
  const [drawing, setDrawing] = useState(content.drawingData);
  const [previewDataUrl, setPreviewDataUrl] = useState(content.previewDataUrl);
  const [editing, setEditing] = useState(autoFocus);
  const [capture, setCapture] = useState<DrawingCapture | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextColor, setNextColor] = useState(DRAWING_COLORS[0].value as string);
  const [nextWidth, setNextWidth] = useState(DRAWING_WIDTHS[1].value as number);
  const [clearRequested, setClearRequested] = useState(false);
  const [announcement, setAnnouncement] = useState(
    `Drawing ready. ${strokeCountText(content.drawingData.strokes.length)}.`,
  );
  const captureRef = useRef<DrawingCapture | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  if (previewDataUrl !== content.previewDataUrl) {
    setPreviewDataUrl(content.previewDataUrl);
  }

  useEffect(() => {
    if (editing) canvasRef.current?.focus();
  }, [editing]);

  const commit = useCallback(
    (next: DrawingData, message: string) => {
      setDrawing(next);
      setAnnouncement(`${message} ${strokeCountText(next.strokes.length)}.`);
      onChange({ ...content, drawingData: next, previewDataUrl });
    },
    [content, onChange, previewDataUrl],
  );

  const exitEdit = useCallback(() => {
    captureRef.current = null;
    setCapture(null);
    setEditing(false);
    setAnnouncement(`Drawing closed. ${strokeCountText(drawing.strokes.length)}.`);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }, [drawing.strokes.length]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    const next = {
      ...drawing,
      strokes: drawing.strokes.filter((stroke) => stroke.id !== selectedId),
    };
    setSelectedId(null);
    commit(next, 'Deleted the selected stroke.');
  }, [commit, drawing, selectedId]);

  const undo = useCallback(() => {
    const removed = drawing.strokes.at(-1);
    if (!removed) return;
    const next = { ...drawing, strokes: drawing.strokes.slice(0, -1) };
    if (selectedId === removed.id) setSelectedId(null);
    commit(next, 'Undid the last stroke.');
  }, [commit, drawing, selectedId]);

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape' && editing && !clearRequested) {
      event.preventDefault();
      exitEdit();
    } else if (event.key === 'Delete' && editing && selectedId) {
      event.preventDefault();
      removeSelected();
    } else if (event.key === 'Enter' && !editing) {
      event.preventDefault();
      setEditing(true);
    }
  };

  const pointerInput = (event: ReactPointerEvent<SVGSVGElement>) => ({
    pointerId: event.pointerId,
    isPrimary: event.isPrimary,
    clientX: event.clientX,
    clientY: event.clientY,
    currentTarget: event.currentTarget,
  });

  const startStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editing || event.button !== 0) return;
    const started = beginDrawingCapture(pointerInput(event), drawing);
    if (!started) return;
    event.preventDefault();
    setSelectedId(null);
    captureRef.current = started;
    setCapture(started);
  };

  const continueStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = captureRef.current;
    if (!current) return;
    const next = appendDrawingPoint(current, pointerInput(event), drawing);
    captureRef.current = next;
    setCapture(next);
  };

  const finishStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = captureRef.current;
    if (!current) return;
    const points = finishDrawingCapture(current, pointerInput(event), drawing);
    captureRef.current = null;
    setCapture(null);
    if (!points) {
      setAnnouncement(`Ignored a mark that was too short. ${strokeCountText(drawing.strokes.length)}.`);
      return;
    }
    const stroke: DrawingStroke = {
      id: createEntityId(),
      color: nextColor,
      width: nextWidth,
      points,
    };
    commit({ ...drawing, strokes: [...drawing.strokes, stroke] }, 'Added a stroke.');
  };

  const selectStroke = (stroke: DrawingStroke) => {
    setSelectedId(stroke.id);
    const index = drawing.strokes.findIndex((candidate) => candidate.id === stroke.id) + 1;
    setAnnouncement(`Selected stroke ${index}. ${strokeCountText(drawing.strokes.length)}.`);
  };

  const strokes = drawing.strokes;
  const viewBox = `0 0 ${drawing.width} ${drawing.height}`;

  return (
    <div
      className={`cn-drawing${editing ? ' cn-drawing--editing' : ''}`}
      tabIndex={editing ? -1 : 0}
      role="group"
      aria-label={`Drawing block, ${strokeCountText(strokes.length)}`}
      onKeyDown={handleKeyDown}
    >
      {editing ? (
        <div className="cn-drawing__tools" aria-label="Drawing tools">
          <div className="cn-drawing__tool-group" role="group" aria-label="Ink color for next stroke">
            {DRAWING_COLORS.map((color) => (
              <button
                key={color.label}
                type="button"
                className="cn-drawing__tool"
                aria-pressed={nextColor === color.value}
                onClick={() => setNextColor(color.value)}
              >
                {color.label}
              </button>
            ))}
          </div>
          <div className="cn-drawing__tool-group" role="group" aria-label="Ink width for next stroke">
            {DRAWING_WIDTHS.map((width) => (
              <button
                key={width.label}
                type="button"
                className="cn-drawing__tool"
                aria-pressed={nextWidth === width.value}
                onClick={() => setNextWidth(width.value)}
              >
                {width.label}
              </button>
            ))}
          </div>
          <div className="cn-drawing__tool-group" role="group" aria-label="Drawing actions">
            <button type="button" className="cn-drawing__tool" onClick={undo} disabled={strokes.length === 0}>
              Undo last stroke
            </button>
            <button type="button" className="cn-drawing__tool" onClick={removeSelected} disabled={!selectedId}>
              Delete selected stroke
            </button>
            <button type="button" className="cn-drawing__tool" onClick={() => setClearRequested(true)} disabled={strokes.length === 0}>
              Clear drawing
            </button>
            <button type="button" className="cn-drawing__tool" onClick={exitEdit}>
              Finish drawing
            </button>
            <button type="button" className="cn-drawing__tool cn-drawing__tool--danger" onClick={onRemoveBlock}>
              Move drawing to trash
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={editButtonRef}
          type="button"
          className="cn-drawing__edit"
          onClick={() => setEditing(true)}
        >
          Edit drawing
        </button>
      )}

      <svg
        ref={canvasRef}
        className="cn-drawing__canvas"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        tabIndex={editing ? 0 : -1}
        role="img"
        aria-label={editing
          ? `Editable drawing canvas, ${strokeCountText(strokes.length)}`
          : `Drawing, ${strokeCountText(strokes.length)}`}
        data-stroke-count={strokes.length}
        style={drawing.background ? { background: drawing.background } : undefined}
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={finishStroke}
        onPointerCancel={() => {
          captureRef.current = null;
          setCapture(null);
        }}
      >
        {strokes.map((stroke, index) => (
          <g key={stroke.id}>
            <path
              className="cn-drawing__stroke"
              data-stroke-id={stroke.id}
              d={drawingPath(stroke.points)}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              opacity={stroke.opacity ?? 1}
              tabIndex={editing ? 0 : -1}
              role={editing ? 'button' : undefined}
              aria-label={editing ? `Stroke ${index + 1}. Select` : undefined}
              onClick={(event) => {
                if (!editing) return;
                event.stopPropagation();
                selectStroke(stroke);
              }}
              onKeyDown={(event) => {
                if (!editing || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                selectStroke(stroke);
              }}
            />
            {selectedId === stroke.id ? (
              <path
                className="cn-drawing__selection"
                d={drawingPath(stroke.points)}
                strokeWidth={stroke.width + 6}
                aria-hidden="true"
              />
            ) : null}
          </g>
        ))}
        {capture ? (
          <path
            className="cn-drawing__stroke cn-drawing__stroke--draft"
            d={drawingPath(capture.points)}
            stroke={nextColor}
            strokeWidth={nextWidth}
            aria-hidden="true"
          />
        ) : null}
      </svg>

      {strokes.length === 0 && !editing ? <p className="cn-drawing__empty">Empty drawing.</p> : null}
      <p className="cn-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <ConfirmDialog
        open={clearRequested}
        title="Clear this drawing?"
        description="Every stroke in this drawing will be removed. The drawing block will remain."
        confirmLabel="Clear drawing"
        destructive
        onConfirm={() => {
          setClearRequested(false);
          setSelectedId(null);
          commit({ ...drawing, strokes: [] }, 'Cleared the drawing.');
        }}
        onCancel={() => setClearRequested(false)}
      />
    </div>
  );
}
