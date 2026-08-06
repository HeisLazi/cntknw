import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { ConfirmDialog } from '@components/primitives';
import type {
  BlockContent,
  DrawingContent,
  DrawingPoint,
  EntityId,
  JournalBlock,
  SourceLocation,
  WhiteboardPosition,
  WhiteboardState,
  WhiteboardViewport,
} from '@domain/index';
import { createEntityId } from '@lib/id';
import { WhiteboardCommandHistory } from './commandHistory';
import {
  WHITEBOARD_TOOLS,
  appendToolGesture,
  beginToolGesture,
  cancelToolGesture,
  commitToolGesture,
  drawingPath,
  screenToWorld,
  zoomViewportAt,
  type DrawingGesture,
  type WhiteboardTool,
} from './whiteboardEngine';
import { deleteCanonicalBoardObject, withoutLayoutEntry } from './whiteboardOperations';
import { useWhiteboardJournal } from './useWhiteboardJournal';
import './whiteboard.css';

const TOOL_LABELS: Record<WhiteboardTool, string> = {
  select: 'Select',
  pen: 'Pen',
  pencil: 'Pencil',
  highlighter: 'Highlighter',
  eraser: 'Eraser',
  line: 'Line',
  arrow: 'Arrow',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  text: 'Text',
  hand: 'Hand',
};

const TOOL_SHORTCUTS: Partial<Record<WhiteboardTool, string>> = {
  select: 'V',
  pen: 'P',
  pencil: 'B',
  highlighter: 'I',
  eraser: 'E',
  line: 'L',
  arrow: 'A',
  rectangle: 'R',
  ellipse: 'O',
  text: 'T',
  hand: 'H',
};

const QUICK_COLORS = [
  { label: 'Paper', value: '#ebdbb2' },
  { label: 'Red', value: '#cc241d' },
  { label: 'Green', value: '#98971a' },
  { label: 'Yellow', value: '#d79921' },
  { label: 'Blue', value: '#458588' },
  { label: 'Purple', value: '#b16286' },
  { label: 'Aqua', value: '#689d6a' },
  { label: 'Orange', value: '#d65d0e' },
] as const;

interface MoveInteraction {
  kind: 'move';
  pointerId: number;
  blockId: EntityId;
  start: DrawingPoint;
  origin: WhiteboardPosition;
  current: WhiteboardPosition;
}

interface PanInteraction {
  kind: 'pan';
  pointerId: number;
  startClient: DrawingPoint;
  origin: WhiteboardViewport;
}

interface DrawInteraction {
  kind: 'draw';
  pointerId: number;
  gesture: DrawingGesture;
}

interface TextPlacementInteraction {
  kind: 'text';
  pointerId: number;
  position: WhiteboardPosition;
}

type PointerInteraction = MoveInteraction | PanInteraction | DrawInteraction | TextPlacementInteraction;

interface TextDraft {
  position: WhiteboardPosition;
  text: string;
}

export interface WhiteboardProps {
  sourceId: EntityId;
  journalId: EntityId;
  location: SourceLocation;
  state: WhiteboardState;
  active: boolean;
  onViewportDrift: (viewport: WhiteboardViewport) => void;
  onViewportCommit: (viewport: WhiteboardViewport) => void;
  onLayoutCommit: (layout: Record<EntityId, WhiteboardPosition>) => void;
}

interface ObjectSize {
  width: number;
  height: number;
}

type ParagraphContent = Extract<JournalBlock['content'], { type: 'paragraph' }>;

function estimatedParagraphSize(content: ParagraphContent): ObjectSize {
  const fontSize = content.whiteboardStyle?.fontSize ?? 20;
  const lines = content.text.split('\n');
  const longestLine = Math.max(1, ...lines.map((line) => line.length));
  return {
    width: Math.max(fontSize * 4, longestLine * fontSize * 0.62 + fontSize),
    height: Math.max(fontSize * 1.5, lines.length * fontSize * 1.35),
  };
}

function objectSize(block: JournalBlock, measured?: ObjectSize): ObjectSize {
  if (block.content.type === 'drawing') {
    return {
      width: block.content.drawingData.width,
      height: block.content.drawingData.height,
    };
  }
  if (block.content.type === 'paragraph') {
    return measured ?? estimatedParagraphSize(block.content);
  }
  return { width: 1, height: 1 };
}

function isBoardBlock(block: JournalBlock): boolean {
  return block.content.type === 'drawing' || block.content.type === 'paragraph';
}

function contentWithColor(block: JournalBlock, color: string): BlockContent | null {
  if (block.content.type === 'drawing') {
    return {
      ...block.content,
      drawingData: {
        ...block.content.drawingData,
        strokes: block.content.drawingData.strokes.map((stroke) => ({ ...stroke, color })),
      },
    };
  }
  if (block.content.type === 'paragraph') {
    return {
      ...block.content,
      whiteboardStyle: {
        color,
        fontSize: block.content.whiteboardStyle?.fontSize ?? 20,
      },
    };
  }
  return null;
}

export function Whiteboard({
  sourceId,
  journalId,
  location,
  state,
  active,
  onViewportDrift,
  onViewportCommit,
  onLayoutCommit,
}: WhiteboardProps) {
  const journal = useWhiteboardJournal(sourceId, journalId, active);
  const [tool, setTool] = useState<WhiteboardTool>('select');
  const [color, setColor] = useState<string>(QUICK_COLORS[0].value);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [textMeasurements, setTextMeasurements] = useState<Map<EntityId, ObjectSize>>(new Map());
  const [selectedId, setSelectedId] = useState<EntityId | null>(null);
  const [interaction, setInteraction] = useState<PointerInteraction | null>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const [viewport, setViewport] = useState(state.viewport);
  const viewportRef = useRef(state.viewport);
  const layoutRef = useRef(state.layout);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [editingTextId, setEditingTextId] = useState<EntityId | null>(null);
  const [editingText, setEditingText] = useState('');
  const [announcement, setAnnouncement] = useState('Whiteboard ready. Select tool active.');
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [clearRequested, setClearRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const history = useRef(new WhiteboardCommandHistory(200));
  const canvasRef = useRef<SVGSVGElement>(null);
  const spaceHeld = useRef(false);
  const viewportDriftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    layoutRef.current = state.layout;
  }, [state.layout]);

  useEffect(() => {
    if (interactionRef.current) return;
    viewportRef.current = state.viewport;
    setViewport(state.viewport);
  }, [state.viewport]);

  useEffect(() => {
    const releaseSpace = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeld.current = false;
    };
    globalThis.window.addEventListener('keyup', releaseSpace);
    return () => globalThis.window.removeEventListener('keyup', releaseSpace);
  }, []);

  useEffect(() => () => {
    if (viewportDriftTimer.current) clearTimeout(viewportDriftTimer.current);
  }, []);

  const boardBlocks = useMemo(() => (journal.blocks ?? []).filter(
    (block) => state.layout[block.id] && isBoardBlock(block),
  ), [journal.blocks, state.layout]);
  const selected = boardBlocks.find((block) => block.id === selectedId) ?? null;

  const commitLayout = useCallback((layout: Record<EntityId, WhiteboardPosition>) => {
    layoutRef.current = layout;
    onLayoutCommit(layout);
  }, [onLayoutCommit]);

  const setLiveViewport = useCallback((next: WhiteboardViewport) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);

  const selectTool = useCallback((next: WhiteboardTool, focusCanvas = true) => {
    setTool(next);
    setAnnouncement(`${TOOL_LABELS[next]} tool active.`);
    if (focusCanvas) canvasRef.current?.focus();
  }, []);

  const rememberColor = useCallback((next: string) => {
    setColor(next);
    setRecentColors((current) => [next, ...current.filter((value) => value !== next)].slice(0, 5));
  }, []);

  const recordTextMeasurement = useCallback((blockId: EntityId, next: ObjectSize) => {
    setTextMeasurements((current) => {
      const previous = current.get(blockId);
      if (previous?.width === next.width && previous.height === next.height) return current;
      return new Map(current).set(blockId, next);
    });
  }, []);

  const pushHistory = useCallback((command: Parameters<WhiteboardCommandHistory['push']>[0]) => {
    history.current.push(command);
    setHistoryState({ canUndo: history.current.canUndo, canRedo: history.current.canRedo });
  }, []);

  const deleteObject = useCallback(async (blockId: EntityId, recordHistory = true) => {
    const position = layoutRef.current[blockId];
    if (!position) return;
    const before = layoutRef.current;
    const next = await deleteCanonicalBoardObject({
      deleteBlock: journal.deleteBlock,
      commitLayout,
    }, blockId, before);
    setSelectedId((current) => current === blockId ? null : current);
    setAnnouncement('Deleted the selected object. Undo is available.');
    if (recordHistory) {
      pushHistory({
        label: 'delete object',
        undo: async () => {
          await journal.restoreBlock(blockId);
          commitLayout({ ...layoutRef.current, [blockId]: position });
        },
        redo: async () => {
          await deleteCanonicalBoardObject({
            deleteBlock: journal.deleteBlock,
            commitLayout,
          }, blockId, layoutRef.current);
        },
      });
    }
    layoutRef.current = next;
  }, [commitLayout, journal, pushHistory]);

  const createDrawing = useCallback(async (gesture: DrawingGesture) => {
    const committed = commitToolGesture(gesture, {
      color,
      width: strokeWidth,
      opacity,
      ...(fillEnabled ? { fill: color } : {}),
    }, createEntityId);
    if (!committed) {
      setAnnouncement('Ignored a mark that was too short.');
      return;
    }
    setBusy(true);
    try {
      const block = await journal.createBlock('drawing', committed.content, location);
      const position = committed.position;
      commitLayout({ ...layoutRef.current, [block.id]: position });
      setSelectedId(block.id);
      pushHistory({
        label: `create ${gesture.tool}`,
        undo: async () => {
          await journal.deleteBlock(block.id);
          commitLayout(withoutLayoutEntry(layoutRef.current, block.id));
        },
        redo: async () => {
          await journal.restoreBlock(block.id);
          commitLayout({ ...layoutRef.current, [block.id]: position });
        },
      });
      setAnnouncement(`Created ${TOOL_LABELS[gesture.tool].toLowerCase()} on p.${location.pdf?.page ?? 1}.`);
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : 'The object could not be created.');
    } finally {
      setBusy(false);
    }
  }, [color, commitLayout, fillEnabled, journal, location, opacity, pushHistory, strokeWidth]);

  const createText = useCallback(async (draft: TextDraft) => {
    const text = draft.text.trim();
    setTextDraft(null);
    if (!text) {
      setAnnouncement('Cancelled empty text.');
      return;
    }
    setBusy(true);
    try {
      const content: BlockContent = {
        type: 'paragraph',
        text,
        whiteboardStyle: { color, fontSize },
      };
      const block = await journal.createBlock('paragraph', content, location);
      commitLayout({ ...layoutRef.current, [block.id]: draft.position });
      setSelectedId(block.id);
      pushHistory({
        label: 'create text',
        undo: async () => {
          await journal.deleteBlock(block.id);
          commitLayout(withoutLayoutEntry(layoutRef.current, block.id));
        },
        redo: async () => {
          await journal.restoreBlock(block.id);
          commitLayout({ ...layoutRef.current, [block.id]: draft.position });
        },
      });
      setAnnouncement(`Created text on p.${location.pdf?.page ?? 1}.`);
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : 'The text could not be created.');
    } finally {
      setBusy(false);
    }
  }, [color, commitLayout, fontSize, journal, location, pushHistory]);

  const startTextEdit = useCallback((block: JournalBlock) => {
    if (block.content.type !== 'paragraph') return;
    setSelectedId(block.id);
    setEditingTextId(block.id);
    setEditingText(block.content.text);
    setAnnouncement('Editing selected text. Press Control+Enter to finish or Escape to cancel.');
  }, []);

  const finishTextEdit = useCallback((save: boolean) => {
    const blockId = editingTextId;
    setEditingTextId(null);
    if (!blockId || !save) return;
    const block = journal.blocks?.find((candidate) => candidate.id === blockId);
    if (!block || block.content.type !== 'paragraph' || block.content.text === editingText) return;
    const before = block.content;
    const afterText = editingText;
    journal.scheduleEdit(blockId, { kind: 'text', text: afterText });
    pushHistory({
      label: 'edit text',
      undo: async () => journal.scheduleEdit(blockId, {
        kind: 'text',
        text: before.text,
      }),
      redo: async () => journal.scheduleEdit(blockId, {
        kind: 'text',
        text: afterText,
      }),
    });
    setAnnouncement('Updated text.');
  }, [editingText, editingTextId, journal, pushHistory]);

  const recolorSelected = useCallback((nextColor: string) => {
    rememberColor(nextColor);
    if (!selected) return;
    const before = selected.content;
    const after = contentWithColor(selected, nextColor);
    if (!after) return;
    journal.scheduleEdit(selected.id, { kind: 'content', content: after });
    pushHistory({
      label: 'recolor object',
      undo: async () => journal.scheduleEdit(selected.id, { kind: 'content', content: before }),
      redo: async () => journal.scheduleEdit(selected.id, { kind: 'content', content: after }),
    });
    setAnnouncement('Recolored the selected object.');
  }, [journal, pushHistory, rememberColor, selected]);

  const undo = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const label = await history.current.undo();
      if (label) setAnnouncement(`Undid ${label}.`);
      setHistoryState({ canUndo: history.current.canUndo, canRedo: history.current.canRedo });
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : 'Undo failed.');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const redo = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const label = await history.current.redo();
      if (label) setAnnouncement(`Redid ${label}.`);
      setHistoryState({ canUndo: history.current.canUndo, canRedo: history.current.canRedo });
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : 'Redo failed.');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const zoomBy = useCallback((factor: number, commit = true) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return;
    const next = zoomViewportAt(
      viewportRef.current,
      { x: box.width / 2, y: box.height / 2 },
      viewportRef.current.zoom * factor,
    );
    setLiveViewport(next);
    if (commit) onViewportCommit(next);
  }, [onViewportCommit, setLiveViewport]);

  const fitBoard = useCallback(() => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || boardBlocks.length === 0) {
      const origin = { x: 0, y: 0, zoom: 1 };
      setLiveViewport(origin);
      onViewportCommit(origin);
      return;
    }
    const bounds = boardBlocks.map((block) => {
      const position = layoutRef.current[block.id]!;
      const size = objectSize(block, textMeasurements.get(block.id));
      return { left: position.x, top: position.y, right: position.x + size.width, bottom: position.y + size.height };
    });
    const left = Math.min(...bounds.map((bound) => bound.left));
    const top = Math.min(...bounds.map((bound) => bound.top));
    const right = Math.max(...bounds.map((bound) => bound.right));
    const bottom = Math.max(...bounds.map((bound) => bound.bottom));
    const padding = 48;
    const zoom = Math.min(4, Math.max(0.1, Math.min(
      (box.width - padding * 2) / Math.max(1, right - left),
      (box.height - padding * 2) / Math.max(1, bottom - top),
    )));
    const next = {
      x: box.width / (2 * zoom) - (left + right) / 2,
      y: box.height / (2 * zoom) - (top + bottom) / 2,
      zoom,
    };
    setLiveViewport(next);
    onViewportCommit(next);
  }, [boardBlocks, onViewportCommit, setLiveViewport, textMeasurements]);

  const clearBoard = useCallback(async () => {
    setClearRequested(false);
    const entries = boardBlocks.map((block) => ({ blockId: block.id, position: layoutRef.current[block.id]! }));
    if (entries.length === 0) return;
    setBusy(true);
    try {
      for (const entry of entries) await journal.deleteBlock(entry.blockId);
      let next = layoutRef.current;
      for (const entry of entries) next = withoutLayoutEntry(next, entry.blockId);
      commitLayout(next);
      setSelectedId(null);
      pushHistory({
        label: 'clear board',
        undo: async () => {
          for (const entry of entries) await journal.restoreBlock(entry.blockId);
          commitLayout(Object.fromEntries([
            ...Object.entries(layoutRef.current),
            ...entries.map((entry) => [entry.blockId, entry.position]),
          ]));
        },
        redo: async () => {
          for (const entry of entries) await journal.deleteBlock(entry.blockId);
          let cleared = layoutRef.current;
          for (const entry of entries) cleared = withoutLayoutEntry(cleared, entry.blockId);
          commitLayout(cleared);
        },
      });
      setAnnouncement('Cleared the board. Undo is available.');
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : 'The board could not be cleared.');
    } finally {
      setBusy(false);
    }
  }, [boardBlocks, commitLayout, journal, pushHistory]);

  const worldPoint = useCallback((event: Pick<ReactPointerEvent<SVGSVGElement>, 'clientX' | 'clientY'>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect
      ? screenToWorld({ x: event.clientX, y: event.clientY }, rect, viewportRef.current)
      : { x: 0, y: 0 };
  }, []);

  const storeInteraction = useCallback((next: PointerInteraction | null) => {
    interactionRef.current = next;
    setInteraction(next);
  }, []);

  const startPan = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    storeInteraction({
      kind: 'pan',
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      origin: viewportRef.current,
    });
  }, [storeInteraction]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.isPrimary === false || event.button > 0 || busy) return;
    if (tool === 'hand' || spaceHeld.current) {
      event.preventDefault();
      startPan(event);
      return;
    }
    if (tool === 'text') {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      storeInteraction({ kind: 'text', pointerId: event.pointerId, position: worldPoint(event) });
      return;
    }
    const gesture = beginToolGesture(tool, worldPoint(event));
    if (gesture) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      storeInteraction({ kind: 'draw', pointerId: event.pointerId, gesture });
      return;
    }
    if (tool === 'select') {
      setSelectedId(null);
      setAnnouncement('Selection cleared.');
    }
  };

  const handleObjectPointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    block: JournalBlock,
  ) => {
    if (event.isPrimary === false || event.button > 0 || busy) return;
    if (tool === 'hand' || spaceHeld.current) {
      startPan(event as unknown as ReactPointerEvent<SVGSVGElement>);
      return;
    }
    event.stopPropagation();
    if (tool === 'eraser') {
      void deleteObject(block.id);
      return;
    }
    if (tool !== 'select') return;
    const position = layoutRef.current[block.id];
    if (!position) return;
    setSelectedId(block.id);
    setAnnouncement(`Selected ${block.kind} from p.${block.sourceLocation?.pdf?.page ?? 1}. Drag to move.`);
    canvasRef.current?.setPointerCapture?.(event.pointerId);
    const next: MoveInteraction = {
      kind: 'move',
      pointerId: event.pointerId,
      blockId: block.id,
      start: worldPoint(event as unknown as ReactPointerEvent<SVGSVGElement>),
      origin: position,
      current: position,
    };
    storeInteraction(next);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = interactionRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.kind === 'draw') {
      storeInteraction({ ...current, gesture: appendToolGesture(current.gesture, worldPoint(event)) });
    } else if (current.kind === 'move') {
      const point = worldPoint(event);
      storeInteraction({
        ...current,
        current: {
          x: current.origin.x + point.x - current.start.x,
          y: current.origin.y + point.y - current.start.y,
        },
      });
    } else if (current.kind === 'pan') {
      const next = {
        ...current.origin,
        x: current.origin.x + (event.clientX - current.startClient.x) / current.origin.zoom,
        y: current.origin.y + (event.clientY - current.startClient.y) / current.origin.zoom,
      };
      setLiveViewport(next);
    }
  };

  const finishPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = interactionRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    storeInteraction(null);
    if (current.kind === 'draw') {
      void createDrawing(appendToolGesture(current.gesture, worldPoint(event)));
    } else if (current.kind === 'move') {
      const moved = current.current;
      if (moved.x !== current.origin.x || moved.y !== current.origin.y) {
        commitLayout({ ...layoutRef.current, [current.blockId]: moved });
        pushHistory({
          label: 'move object',
          undo: async () => commitLayout({ ...layoutRef.current, [current.blockId]: current.origin }),
          redo: async () => commitLayout({ ...layoutRef.current, [current.blockId]: moved }),
        });
        setAnnouncement('Moved the selected object.');
      }
    } else if (current.kind === 'pan') {
      onViewportDrift(viewportRef.current);
      setAnnouncement('Panned the whiteboard.');
    } else {
      setTextDraft({ position: current.position, text: '' });
      setAnnouncement('Text editor opened. Type, then press Control+Enter to place it.');
    }
  };

  const cancelInteraction = useCallback(() => {
    storeInteraction(cancelToolGesture());
    setTextDraft(null);
    setAnnouncement('Cancelled the current gesture.');
  }, [storeInteraction]);

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const current = viewportRef.current;
    let next: WhiteboardViewport;
    if (event.ctrlKey || event.metaKey) {
      const rect = event.currentTarget.getBoundingClientRect();
      next = zoomViewportAt(
        current,
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        current.zoom * Math.exp(-event.deltaY * 0.002),
      );
    } else {
      const horizontal = event.shiftKey ? event.deltaY : event.deltaX;
      const vertical = event.shiftKey ? 0 : event.deltaY;
      next = {
        ...current,
        x: current.x - horizontal / current.zoom,
        y: current.y - vertical / current.zoom,
      };
    }
    setLiveViewport(next);
    if (viewportDriftTimer.current) clearTimeout(viewportDriftTimer.current);
    viewportDriftTimer.current = setTimeout(() => onViewportDrift(next), 120);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (
      event.target instanceof HTMLInputElement
      || event.target instanceof HTMLTextAreaElement
      || event.target instanceof HTMLButtonElement
    ) {
      return;
    }
    if (event.code === 'Space') {
      spaceHeld.current = true;
      event.preventDefault();
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === 'z') {
      event.preventDefault();
      void (event.shiftKey ? redo() : undo());
      return;
    }
    if (modifier && key === 'y') {
      event.preventDefault();
      void redo();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (interactionRef.current || textDraft) cancelInteraction();
      else if (editingTextId) finishTextEdit(false);
      else {
        setSelectedId(null);
        setAnnouncement('Selection cleared.');
      }
      return;
    }
    if (event.key === 'Delete' && selectedId) {
      event.preventDefault();
      void deleteObject(selectedId);
      return;
    }
    if (event.key === 'Enter' && selected?.content.type === 'paragraph') {
      event.preventDefault();
      startTextEdit(selected);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.2);
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      zoomBy(1 / 1.2);
      return;
    }
    if (event.key === '0') {
      event.preventDefault();
      fitBoard();
      return;
    }
    if (!modifier && !event.altKey && key.length === 1) {
      const shortcut = Object.entries(TOOL_SHORTCUTS).find(([, value]) => value?.toLowerCase() === key);
      if (shortcut) {
        event.preventDefault();
        selectTool(shortcut[0] as WhiteboardTool);
      }
    }
  };

  const selectedPage = selected?.sourceLocation?.pdf?.page;
  const previewGesture = interaction?.kind === 'draw' ? interaction.gesture : null;
  const previewPath = previewGesture?.points ?? [];
  const transform = `translate(${viewport.x * viewport.zoom} ${viewport.y * viewport.zoom}) scale(${viewport.zoom})`;
  return (
    <div className="cn-whiteboard" data-tool={tool}>
      <div className="cn-whiteboard__toolbar" role="toolbar" aria-label="Whiteboard tools">
        <div className="cn-whiteboard__tools" role="group" aria-label="Drawing tool">
          {WHITEBOARD_TOOLS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={tool === candidate}
              aria-keyshortcuts={TOOL_SHORTCUTS[candidate]}
              title={`${TOOL_LABELS[candidate]}${TOOL_SHORTCUTS[candidate] ? ` (${TOOL_SHORTCUTS[candidate]})` : ''}`}
              onClick={() => selectTool(candidate, false)}
            >
              {TOOL_LABELS[candidate]}
            </button>
          ))}
        </div>

        <div className="cn-whiteboard__tools" role="group" aria-label="History and view">
          <button type="button" onClick={() => void undo()} disabled={!historyState.canUndo || busy}>Undo</button>
          <button type="button" onClick={() => void redo()} disabled={!historyState.canRedo || busy}>Redo</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>−</button>
          <output aria-label="Whiteboard zoom">
            {active ? `${Math.round(viewport.zoom * 100)}%` : null}
          </output>
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>+</button>
          <button type="button" onClick={fitBoard}>Fit</button>
          <button type="button" onClick={() => setClearRequested(true)} disabled={boardBlocks.length === 0}>Clear</button>
        </div>

        <div className="cn-whiteboard__style" role="group" aria-label="Object style">
          <div className="cn-whiteboard__swatches" aria-label="Quick colors">
            {QUICK_COLORS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className="cn-whiteboard__swatch"
                aria-label={entry.label}
                aria-pressed={color === entry.value}
                style={{ backgroundColor: entry.value }}
                onClick={() => rememberColor(entry.value)}
              />
            ))}
            {recentColors.filter((value) => !QUICK_COLORS.some((entry) => entry.value === value)).map((value) => (
              <button
                key={value}
                type="button"
                className="cn-whiteboard__swatch cn-whiteboard__swatch--recent"
                aria-label={`Recent color ${value}`}
                style={{ backgroundColor: value }}
                onClick={() => rememberColor(value)}
              />
            ))}
          </div>
          <label>Color <input aria-label="Arbitrary color" type="color" value={color.startsWith('#') ? color : '#ebdbb2'} onChange={(event) => rememberColor(event.target.value)} /></label>
          <label>Hex <input aria-label="Hex color" value={color} onChange={(event) => rememberColor(event.target.value)} /></label>
          <button type="button" onClick={() => recolorSelected(color)} disabled={!selected}>
            Apply color to selection
          </button>
          <label>Width <input aria-label="Stroke width" type="range" min="1" max="20" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} /></label>
          <label>Opacity <input aria-label="Stroke opacity" type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>
          <label>Text size <input aria-label="Text size" type="range" min="10" max="96" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
          <label><input type="checkbox" checked={fillEnabled} onChange={(event) => setFillEnabled(event.target.checked)} /> Fill shapes</label>
        </div>
      </div>

      <svg
        ref={canvasRef}
        className="cn-whiteboard__canvas"
        tabIndex={0}
        role="application"
        aria-label="Infinite whiteboard canvas"
        data-object-count={boardBlocks.length}
        data-zoom={viewport.zoom}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={cancelInteraction}
        onDoubleClick={(event) => {
          const blockId = (event.target as Element).closest('[data-block-id]')?.getAttribute('data-block-id');
          const block = journal.blocks?.find((candidate) => candidate.id === blockId);
          if (block?.content.type === 'paragraph') startTextEdit(block);
        }}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      >
        <defs>
          <pattern id="cn-whiteboard-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle className="cn-whiteboard__grid-dot" cx="1" cy="1" r="1" />
          </pattern>
          <marker
            id="cn-whiteboard-draft-arrowhead"
            viewBox="0 0 5 5"
            refX="4.5"
            refY="2.5"
            markerWidth={16 / viewport.zoom}
            markerHeight={16 / viewport.zoom}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 5 2.5 L 0 5 Z" fill={color} />
          </marker>
        </defs>
        <rect className="cn-whiteboard__grid" width="100%" height="100%" />
        <g transform={transform}>
          {boardBlocks.map((block) => {
            const storedPosition = state.layout[block.id]!;
            const position = interaction?.kind === 'move' && interaction.blockId === block.id
              ? interaction.current
              : storedPosition;
            const size = objectSize(block, textMeasurements.get(block.id));
            const selectedObject = selectedId === block.id;
            const objectLabel = block.content.type === 'paragraph'
              ? `Text object, ${block.content.text.length} characters, from page ${block.sourceLocation?.pdf?.page ?? 1}${selectedObject ? ', selected' : ''}`
              : `Drawing object from page ${block.sourceLocation?.pdf?.page ?? 1}${selectedObject ? ', selected' : ''}`;
            return (
              <g
                key={block.id}
                data-block-id={block.id}
                data-kind={block.kind}
                transform={`translate(${position.x} ${position.y})`}
                role="button"
                tabIndex={0}
                aria-label={objectLabel}
                onPointerDown={(event) => handleObjectPointerDown(event, block)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (block.content.type === 'paragraph') startTextEdit(block);
                }}
                onFocus={() => setSelectedId(block.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedId(block.id);
                    if (event.key === 'Enter' && block.content.type === 'paragraph') startTextEdit(block);
                  }
                }}
              >
                {block.content.type === 'drawing' ? (
                  <BoardDrawing content={block.content} zoom={viewport.zoom} />
                ) : block.content.type === 'paragraph' ? (
                  editingTextId === block.id ? (
                    <foreignObject width={size.width} height={Math.max(size.height, 80)}>
                      <textarea
                        className="cn-whiteboard__text-editor"
                        aria-label="Edit whiteboard text"
                        autoFocus
                        value={editingText}
                        style={{ color: block.content.whiteboardStyle?.color, fontSize: block.content.whiteboardStyle?.fontSize }}
                        onChange={(event) => setEditingText(event.target.value)}
                        onBlur={() => finishTextEdit(true)}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            finishTextEdit(false);
                            canvasRef.current?.focus();
                          }
                        }}
                      />
                    </foreignObject>
                  ) : (
                    <MeasuredBoardText
                      blockId={block.id}
                      content={block.content}
                      fallbackColor={color}
                      measurementKey={viewport.zoom}
                      onMeasure={recordTextMeasurement}
                    />
                  )
                ) : null}
                <rect
                  className={selectedObject ? 'cn-whiteboard__selection' : 'cn-whiteboard__hitbox'}
                  x={-4}
                  y={-4}
                  width={size.width + 8}
                  height={size.height + 8}
                  rx={4}
                  aria-hidden="true"
                />
              </g>
            );
          })}

          {previewGesture ? (
            <path
              className="cn-whiteboard__draft-stroke"
              d={drawingPath(previewPath, previewGesture.tool === 'pen' || previewGesture.tool === 'highlighter')}
              stroke={color}
              strokeWidth={previewGesture.tool === 'highlighter' ? Math.max(12, strokeWidth * 3) : strokeWidth}
              opacity={previewGesture.tool === 'highlighter' ? Math.min(0.35, opacity) : opacity}
              markerEnd={previewGesture.tool === 'arrow' ? 'url(#cn-whiteboard-draft-arrowhead)' : undefined}
              aria-hidden="true"
            />
          ) : null}

          {textDraft ? (
            <foreignObject x={textDraft.position.x} y={textDraft.position.y} width="240" height="120">
              <textarea
                className="cn-whiteboard__text-editor"
                aria-label="New whiteboard text"
                autoFocus
                value={textDraft.text}
                style={{ color, fontSize }}
                onChange={(event) => setTextDraft({ ...textDraft, text: event.target.value })}
                onBlur={() => void createText(textDraft)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setTextDraft(null);
                    canvasRef.current?.focus();
                  }
                }}
              />
            </foreignObject>
          ) : null}
        </g>
      </svg>

      <div className="cn-whiteboard__inspector" aria-live="polite">
        {selected ? (
          <span>Selected {selected.kind === 'paragraph' ? 'text' : 'drawing'} · p.{selectedPage ?? 1}</span>
        ) : (
          <span>{boardBlocks.length} {boardBlocks.length === 1 ? 'object' : 'objects'}</span>
        )}
      </div>

      {[...journal.failedWrites.entries()].map(([blockId, message]) => (
        <p key={blockId} className="cn-whiteboard__error" role="alert">
          {message}
          <button type="button" onClick={() => void journal.flush(blockId)}>Retry saving</button>
        </p>
      ))}

      <p className="cn-visually-hidden" role="status" aria-live="polite">{announcement}</p>

      <ConfirmDialog
        open={clearRequested}
        title="Clear this whiteboard?"
        description="Every projected object will move to trash. Undo restores the blocks and their positions during this session."
        confirmLabel="Clear whiteboard"
        destructive
        onConfirm={() => void clearBoard()}
        onCancel={() => setClearRequested(false)}
      />
    </div>
  );
}

interface MeasuredBoardTextProps {
  blockId: EntityId;
  content: ParagraphContent;
  fallbackColor: string;
  measurementKey: number;
  onMeasure: (blockId: EntityId, size: ObjectSize) => void;
}

function MeasuredBoardText({
  blockId,
  content,
  fallbackColor,
  measurementKey,
  onMeasure,
}: MeasuredBoardTextProps) {
  const textRef = useRef<SVGTextElement>(null);
  const fontSize = content.whiteboardStyle?.fontSize ?? 20;

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const measure = () => {
      const fallback = estimatedParagraphSize(content);
      let width = fallback.width;
      let height = fallback.height;
      try {
        const box = text.getBBox();
        const lineWidths = [...text.querySelectorAll<SVGTSpanElement>('tspan')].map((line) => (
          typeof line.getComputedTextLength === 'function' ? line.getComputedTextLength() : 0
        ));
        width = Math.max(width, box.width + fontSize, ...lineWidths.map((line) => line + fontSize));
        height = Math.max(height, box.height);
      } catch {
        // Detached/test SVG nodes may not expose geometry. The
        // length-aware fallback still grows instead of clipping.
      }
      onMeasure(blockId, { width: Math.ceil(width), height: Math.ceil(height) });
    };

    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(text);
    document.fonts?.addEventListener('loadingdone', measure);
    void document.fonts?.ready.then(measure);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [blockId, content, fontSize, measurementKey, onMeasure]);

  return (
    <text
      ref={textRef}
      className="cn-whiteboard__text"
      fill={content.whiteboardStyle?.color ?? fallbackColor}
      fontSize={fontSize}
      dominantBaseline="hanging"
    >
      {content.text.split('\n').map((line, index) => (
        <tspan key={`${index}:${line}`} x="0" dy={index === 0 ? 0 : '1.35em'}>
          {line || '\u00a0'}
        </tspan>
      ))}
    </text>
  );
}

function BoardDrawing({ content, zoom }: { content: DrawingContent; zoom: number }) {
  const smooth = content.whiteboardStyle?.tool === 'pen'
    || content.whiteboardStyle?.tool === 'highlighter';
  const arrow = content.whiteboardStyle?.tool === 'arrow';
  return content.drawingData.strokes.map((stroke, index) => {
    const markerId = `cn-whiteboard-arrowhead-${stroke.id}`;
    const arrowheadSize = Math.max(12, stroke.width * 4) / zoom;
    return (
      <g key={stroke.id}>
        {arrow ? (
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 5 5"
              refX="4.5"
              refY="2.5"
              markerWidth={arrowheadSize}
              markerHeight={arrowheadSize}
              orient="auto"
              markerUnits="userSpaceOnUse"
              data-screen-stable-arrowhead="true"
            >
              <path d="M 0 0 L 5 2.5 L 0 5 Z" fill={stroke.color} />
            </marker>
          </defs>
        ) : null}
        <path
          className="cn-whiteboard__object-stroke"
          d={drawingPath(stroke.points, smooth)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          opacity={stroke.opacity ?? 1}
          fill={index === 0 ? content.whiteboardStyle?.fill ?? 'none' : 'none'}
          markerEnd={arrow ? `url(#${markerId})` : undefined}
          data-stroke-id={stroke.id}
        />
      </g>
    );
  });
}
