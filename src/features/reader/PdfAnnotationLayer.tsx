import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { createSourceAnnotation } from '@application/annotations/create-annotation';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { Button, ConfirmDialog, IconButton } from '@components/primitives';
import { CntknwStorageError, RevisionConflictError } from '@data/errors';
import { expectedRevision } from '@data/repositories/concurrency';
import type {
  Annotation,
  EntityId,
} from '@domain/index';
import {
  canonicalPathToViewport,
  canonicalPointToViewport,
  canonicalRectToViewport,
  type PageViewportLike,
  type PdfPageBox,
  type ViewportPoint,
  type ViewportRect,
} from '@lib/geometry';
import {
  captureRegionAnchor,
  captureTextSelection,
  rectFromRegionDrag,
} from './annotationCapture';
import { splitAnnotationsByLegacyGeometry } from './legacyGeometry';
import {
  clearPendingIntent,
  getPendingIntent,
  putPendingIntent,
  usePendingIntent,
  type PendingAnnotationIntent,
} from './pendingAnnotationIntent';
import { usePageAnnotations } from './usePageAnnotations';

const STYLE_PRESETS = [
  { label: 'Verdigris', value: 'var(--cn-palette-accent-400)' },
  { label: 'Sage', value: 'var(--cn-palette-success-300)' },
  { label: 'Ochre', value: 'var(--cn-palette-warning-300)' },
  { label: 'Clay', value: 'var(--cn-palette-danger-300)' },
  { label: 'Graphite', value: 'var(--cn-palette-ink-400)' },
] as const;

export interface PdfAnnotationLayerProps {
  sourceId: EntityId;
  assetId: EntityId;
  pageNumber: number;
  viewport: PageViewportLike;
  pageBox: PdfPageBox;
  pageRef: RefObject<HTMLDivElement | null>;
  regionActive: boolean;
}

function nodeElement(node: Node | null): Element | null {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
}

function pageForNode(node: Node | null): HTMLElement | null {
  return nodeElement(node)?.closest<HTMLElement>('.cn-pdf-page') ?? null;
}

function isTextLayerNode(node: Node | null): boolean {
  return nodeElement(node)?.closest('.cn-pdf-page__text') !== null;
}

function excerpt(value: string, length = 60): string {
  const compact = value.replace(/\s+/gu, ' ').trim();
  return compact.length > length ? `${compact.slice(0, length - 1)}…` : compact;
}

export function annotationAccessibleName(annotation: Annotation): string {
  switch (annotation.anchor.kind) {
    case 'text':
      return `Highlight on page ${annotation.page}: “${excerpt(annotation.anchor.quote)}”`;
    case 'area':
      return `Region on page ${annotation.page}`;
    case 'point':
      return `Point on page ${annotation.page}`;
    case 'ink':
      return `Ink drawing on page ${annotation.page}`;
  }
}

function positionedStyle(rect: ViewportRect, color: string): CSSProperties {
  return {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    '--cn-annotation-color': color,
  } as CSSProperties;
}

function annotationColor(annotation: Annotation): string {
  return annotation.style.color ?? STYLE_PRESETS[0].value;
}

function annotationBounds(
  annotation: Annotation,
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): ViewportRect {
  switch (annotation.anchor.kind) {
    case 'text':
      return canonicalRectToViewport(annotation.anchor.boundingRect, viewport, pageBox);
    case 'area':
      return canonicalRectToViewport(annotation.anchor.rect, viewport, pageBox);
    case 'point': {
      const point = canonicalPointToViewport(annotation.anchor.point, viewport, pageBox);
      return { x: point.x, y: point.y, width: 0, height: 0 };
    }
    case 'ink': {
      const points = annotation.anchor.strokes.flatMap((stroke) =>
        canonicalPathToViewport(stroke.points, viewport, pageBox),
      );
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
  }
}

function interactionKeyDown(
  event: React.KeyboardEvent<HTMLButtonElement>,
  open: () => void,
  requestDelete: () => void,
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    open();
  } else if (event.key === 'Delete') {
    event.preventDefault();
    requestDelete();
  }
}

export function PdfAnnotationLayer({
  sourceId,
  assetId,
  pageNumber,
  viewport,
  pageBox,
  pageRef,
  regionActive,
}: PdfAnnotationLayerProps) {
  const repositories = useRepositories();
  const { annotations, reload, error, loading } = usePageAnnotations(
    sourceId,
    assetId,
    pageNumber,
  );
  const [selectedId, setSelectedId] = useState<EntityId | null>(null);
  const pending = usePendingIntent(sourceId, assetId, pageNumber);
  const [notice, setNotice] = useState<string | null>(null);
  const [crossPageNotice, setCrossPageNotice] = useState(false);
  const [dragStart, setDragStart] = useState<ViewportPoint | null>(null);
  const [dragCurrent, setDragCurrent] = useState<ViewportPoint | null>(null);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const annotationRefs = useRef(new Map<EntityId, HTMLButtonElement>());
  const returnFocusAfterDialog = useRef(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const { positioned, fallback } = useMemo(
    () => splitAnnotationsByLegacyGeometry(annotations),
    [annotations],
  );
  const saving = pending?.status === 'saving';
  const failed = pending?.status === 'failed';

  const selected = useMemo(
    () => positioned.find((annotation) => annotation.id === selectedId) ?? null,
    [positioned, selectedId],
  );

  const focusSource = useCallback(() => {
    pageRef.current
      ?.closest<HTMLElement>('.cn-reader__scroll')
      ?.focus({ preventScroll: true });
  }, [pageRef]);

  useEffect(() => {
    if (deleteRequested || !returnFocusAfterDialog.current) return;
    returnFocusAfterDialog.current = false;
    const id = selectedId;
    requestAnimationFrame(() => {
      if (id) annotationRefs.current.get(id)?.focus();
    });
  }, [deleteRequested, selectedId]);

  const savePending = useCallback(
    async (intent: PendingAnnotationIntent) => {
      putPendingIntent({ ...intent, status: 'saving', errorMessage: undefined });
      setNotice(null);
      try {
        const saved = await createSourceAnnotation(repositories, {
          sourceId,
          assetId,
          page: pageNumber,
          kind: intent.kind,
          anchor: intent.anchor,
        });
        await reload();
        clearPendingIntent(sourceId, assetId, pageNumber);
        if (!mounted.current) return;
        setSelectedId(saved.id);
        window.getSelection()?.removeAllRanges();
        requestAnimationFrame(() => annotationRefs.current.get(saved.id)?.focus());
      } catch (cause) {
        putPendingIntent({
          ...intent,
          status: 'failed',
          errorMessage: cause instanceof CntknwStorageError
            ? cause.userMessage
            : 'Could not save the annotation. Your selection is kept — try again.',
        });
      }
    },
    [assetId, pageNumber, reload, repositories, sourceId],
  );

  useEffect(() => {
    const handleSelectionChange = () => {
      const current = getPendingIntent(sourceId, assetId, pageNumber);
      if (current?.status === 'saving' || current?.status === 'failed') return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        if (current?.status === 'draft') {
          clearPendingIntent(sourceId, assetId, pageNumber);
        }
        setCrossPageNotice(false);
        return;
      }

      const anchorPage = pageForNode(selection.anchorNode);
      if (!anchorPage || anchorPage !== pageRef.current) {
        if (current?.status === 'draft') {
          clearPendingIntent(sourceId, assetId, pageNumber);
        }
        return;
      }
      const focusPage = pageForNode(selection.focusNode);
      if (
        focusPage !== anchorPage ||
        !isTextLayerNode(selection.anchorNode) ||
        !isTextLayerNode(selection.focusNode)
      ) {
        if (current?.status === 'draft') {
          clearPendingIntent(sourceId, assetId, pageNumber);
        }
        setCrossPageNotice(true);
        return;
      }
      if (regionActive) return;

      const pageRect = anchorPage.getBoundingClientRect();
      const rangeRects = [...selection.getRangeAt(0).getClientRects()];
      try {
        const anchor = captureTextSelection({
          quote: selection.toString(),
          clientRects: rangeRects,
          pageOrigin: pageRect,
          viewport,
          pageBox,
        });
        if (!anchor) {
          if (current?.status === 'draft') {
            clearPendingIntent(sourceId, assetId, pageNumber);
          }
          return;
        }
        setCrossPageNotice(false);
        putPendingIntent({
          sourceId,
          assetId,
          page: pageNumber,
          kind: 'highlight',
          anchor,
          status: 'draft',
        });
      } catch {
        if (current?.status === 'draft') {
          clearPendingIntent(sourceId, assetId, pageNumber);
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [assetId, pageBox, pageNumber, pageRef, regionActive, sourceId, viewport]);

  const localPoint = (event: ReactPointerEvent<HTMLDivElement>): ViewportPoint => {
    const rect = pageRef.current?.getBoundingClientRect();
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  };

  const handleRegionStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!regionActive || !event.isPrimary || event.target !== event.currentTarget) return;
    const current = getPendingIntent(sourceId, assetId, pageNumber);
    if (current?.status === 'saving' || current?.status === 'failed') return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    if (current?.status === 'draft') {
      clearPendingIntent(sourceId, assetId, pageNumber);
    }
    setNotice(null);
    setDragStart(point);
    setDragCurrent(point);
  };

  const handleRegionMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart) setDragCurrent(localPoint(event));
  };

  const handleRegionEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const end = localPoint(event);
    setDragStart(null);
    setDragCurrent(null);
    const anchor = captureRegionAnchor(dragStart, end, viewport, pageBox);
    if (!anchor) return;
    const intent: PendingAnnotationIntent = {
      sourceId,
      assetId,
      page: pageNumber,
      kind: 'region',
      anchor,
      status: 'saving',
    };
    putPendingIntent(intent);
    void savePending(intent);
  };

  const updateColor = async (annotation: Annotation, color: string) => {
    try {
      await repositories.annotations.update(
        annotation.id,
        { style: { ...annotation.style, color } },
        expectedRevision(annotation.revision),
      );
      await reload();
      if (mounted.current) setNotice(null);
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof RevisionConflictError) {
        setNotice('This annotation changed elsewhere — reloaded.');
        await reload();
      } else {
        setNotice('Style not saved — try again.');
      }
    }
  };

  const confirmDelete = async () => {
    if (!selected) return;
    try {
      await repositories.annotations.delete(
        selected.id,
        expectedRevision(selected.revision),
      );
      setDeleteRequested(false);
      setSelectedId(null);
      await reload();
      if (mounted.current) focusSource();
    } catch (cause) {
      if (!mounted.current) return;
      setDeleteRequested(false);
      if (cause instanceof RevisionConflictError) {
        setNotice('This annotation changed elsewhere — reloaded.');
        await reload();
      } else {
        setNotice('Annotation not deleted — try again.');
      }
    }
  };

  const closeActions = () => {
    const id = selectedId;
    setSelectedId(null);
    requestAnimationFrame(() => {
      if (id) annotationRefs.current.get(id)?.focus();
    });
  };

  const requestDelete = (annotation: Annotation) => {
    setSelectedId(annotation.id);
    setDeleteRequested(true);
  };

  const previewRect =
    dragStart && dragCurrent ? rectFromRegionDrag(dragStart, dragCurrent, 0) : null;
  const failedRegionRect =
    failed && pending?.anchor.kind === 'area'
      ? canonicalRectToViewport(pending.anchor.rect, viewport, pageBox)
      : null;
  const pendingRect =
    pending?.anchor.kind === 'text'
      ? canonicalRectToViewport(pending.anchor.boundingRect, viewport, pageBox)
      : pending?.anchor.kind === 'area'
        ? canonicalRectToViewport(pending.anchor.rect, viewport, pageBox)
        : null;
  const pendingPosition = pendingRect
    ? { x: pendingRect.x, y: pendingRect.y + pendingRect.height }
    : null;

  return (
    <div
      className={
        regionActive
          ? 'cn-annotation-layer cn-annotation-layer--region'
          : 'cn-annotation-layer'
      }
      data-testid="annotation-layer"
      tabIndex={regionActive ? -1 : undefined}
      onPointerDown={handleRegionStart}
      onPointerMove={handleRegionMove}
      onPointerUp={handleRegionEnd}
      onPointerCancel={() => {
        setDragStart(null);
        setDragCurrent(null);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        if (dragStart) {
          event.preventDefault();
          setDragStart(null);
          setDragCurrent(null);
          focusSource();
        } else if (selectedId) {
          event.preventDefault();
          closeActions();
        }
      }}
    >
      {positioned.map((annotation) => {
        const name = annotationAccessibleName(annotation);
        const color = annotationColor(annotation);
        const open = () => setSelectedId(annotation.id);
        const keyDown = (event: React.KeyboardEvent<HTMLButtonElement>) =>
          interactionKeyDown(event, open, () => requestDelete(annotation));
        const ref = (node: HTMLButtonElement | null) => {
          if (node) annotationRefs.current.set(annotation.id, node);
          else annotationRefs.current.delete(annotation.id);
        };

        if (annotation.anchor.kind === 'text') {
          const rects = annotation.anchor.rects.map((rect) =>
            canonicalRectToViewport(rect, viewport, pageBox),
          );
          return (
            <div key={annotation.id} data-annotation-id={annotation.id}>
              {rects.map((rect, index) =>
                index === 0 ? (
                  <button
                    key={`${annotation.id}-${index}`}
                    ref={ref}
                    type="button"
                    className="cn-annotation cn-annotation--highlight"
                    style={positionedStyle(rect, color)}
                    aria-label={name}
                    aria-pressed={selectedId === annotation.id}
                    onClick={open}
                    onKeyDown={keyDown}
                  />
                ) : (
                  <span
                    key={`${annotation.id}-${index}`}
                    className="cn-annotation cn-annotation--highlight"
                    style={positionedStyle(rect, color)}
                    aria-hidden="true"
                    onClick={open}
                  />
                ),
              )}
            </div>
          );
        }

        if (annotation.anchor.kind === 'area') {
          const rect = canonicalRectToViewport(annotation.anchor.rect, viewport, pageBox);
          return (
            <button
              key={annotation.id}
              ref={ref}
              type="button"
              className="cn-annotation cn-annotation--region"
              style={positionedStyle(rect, color)}
              data-annotation-id={annotation.id}
              aria-label={name}
              aria-pressed={selectedId === annotation.id}
              onClick={open}
              onKeyDown={keyDown}
            />
          );
        }

        if (annotation.anchor.kind === 'point') {
          const point = canonicalPointToViewport(annotation.anchor.point, viewport, pageBox);
          return (
            <button
              key={annotation.id}
              ref={ref}
              type="button"
              className="cn-annotation cn-annotation--point"
              style={positionedStyle({ ...point, width: 0, height: 0 }, color)}
              data-annotation-id={annotation.id}
              aria-label={name}
              aria-pressed={selectedId === annotation.id}
              onClick={open}
              onKeyDown={(event) => interactionKeyDown(event, open, () => undefined)}
            />
          );
        }

        const strokes = annotation.anchor.strokes.map((stroke) =>
          canonicalPathToViewport(stroke.points, viewport, pageBox),
        );
        const bounds = annotationBounds(annotation, viewport, pageBox);
        return (
          <div key={annotation.id} data-annotation-id={annotation.id}>
            <svg
              className="cn-annotation__ink"
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
              aria-hidden="true"
              style={{ '--cn-annotation-color': color } as CSSProperties}
            >
              {strokes.map((stroke, index) => (
                <polyline
                  key={index}
                  points={stroke.map((point) => `${point.x},${point.y}`).join(' ')}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <button
              ref={ref}
              type="button"
              className="cn-annotation cn-annotation--ink-target"
              style={positionedStyle(bounds, color)}
              aria-label={name}
              aria-pressed={selectedId === annotation.id}
              onClick={open}
              onKeyDown={(event) => interactionKeyDown(event, open, () => undefined)}
            />
          </div>
        );
      })}

      {previewRect ? (
        <span
          className="cn-annotation cn-annotation--region cn-annotation--preview"
          style={positionedStyle(previewRect, STYLE_PRESETS[0].value)}
          aria-hidden="true"
        />
      ) : null}
      {failedRegionRect ? (
        <span
          className="cn-annotation cn-annotation--region cn-annotation--preview"
          style={positionedStyle(failedRegionRect, STYLE_PRESETS[0].value)}
          aria-hidden="true"
        />
      ) : null}

      {pending && pendingPosition ? (
        <div
          className="cn-annotation-create"
          style={{ left: pendingPosition.x, top: pendingPosition.y }}
          role={failed ? 'alert' : undefined}
        >
          {failed ? (
            <>
              <span>{pending.errorMessage ?? 'Not saved'}</span>
              <Button
                size="sm"
                variant="primary"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => void savePending(pending)}
              >
                Retry
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  clearPendingIntent(sourceId, assetId, pageNumber);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                Dismiss
              </Button>
            </>
          ) : pending.kind === 'highlight' ? (
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              loadingLabel="Saving…"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => void savePending(pending)}
            >
              Highlight
            </Button>
          ) : null}
        </div>
      ) : null}

      {selected && selected.anchor.kind !== 'point' && selected.anchor.kind !== 'ink' ? (
        <div
          className="cn-annotation-actions"
          style={{
            left: annotationBounds(selected, viewport, pageBox).x,
            top:
              annotationBounds(selected, viewport, pageBox).y +
              annotationBounds(selected, viewport, pageBox).height,
          }}
          role="toolbar"
          aria-label={`Actions for ${annotationAccessibleName(selected)}`}
        >
          <span className="cn-annotation-actions__label">Mark</span>
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="cn-annotation-swatch"
              style={{ '--cn-annotation-color': preset.value } as CSSProperties}
              aria-label={`Use ${preset.label}`}
              aria-pressed={annotationColor(selected) === preset.value}
              onClick={() => void updateColor(selected, preset.value)}
            />
          ))}
          <IconButton
            label="Delete annotation"
            icon="×"
            size="sm"
            onClick={() => setDeleteRequested(true)}
          />
        </div>
      ) : null}

      {error ? (
        <div className="cn-annotation-notice cn-annotation-notice--error" role="alert">
          <span>Annotations could not be loaded. Stored marks were not deleted.</span>
          <Button size="sm" variant="secondary" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : null}
      {loading && annotations.length === 0 ? (
        <span className="cn-visually-hidden" role="status">
          Loading annotations…
        </span>
      ) : null}
      {fallback.length > 0 ? (
        <div className="cn-annotation-notice" role="status" aria-live="polite">
          {fallback.length === 1
            ? 'A legacy annotation on this page could not be positioned precisely.'
            : `${fallback.length} legacy annotations on this page could not be positioned precisely.`}
        </div>
      ) : null}
      {crossPageNotice ? (
        <div className="cn-annotation-notice" role="status" aria-live="polite">
          Selection crosses pages — annotate one page at a time.
        </div>
      ) : null}
      {notice ? (
        <div className="cn-annotation-notice" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteRequested && selected !== null}
        title={`Delete ${selected?.kind ?? 'annotation'}?`}
        description={selected ? annotationAccessibleName(selected) : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          returnFocusAfterDialog.current = true;
          setDeleteRequested(false);
        }}
      />
    </div>
  );
}
