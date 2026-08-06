import { useRef, useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSourceAnnotation } from '@application/annotations/create-annotation';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import { AssetNotLinkedToSourceError, RevisionConflictError } from '@data/errors';
import {
  AnnotationSchema,
  type Annotation,
  type AnnotationAnchor,
  type AnnotationKind,
  type EntityId,
} from '@domain/index';
import type { PageViewportLike, PdfPageBox } from '@lib/geometry';
import { renderWithProviders } from '@tests/renderWithProviders';
import {
  clearPendingIntent,
  getPendingIntent,
  putPendingIntent,
} from './pendingAnnotationIntent';
import { PdfAnnotationLayer } from './PdfAnnotationLayer';

const PAGE_BOX: PdfPageBox = [0, 0, 400, 600];
const VIEWPORT: PageViewportLike = {
  width: 400,
  height: 600,
  convertToPdfPoint: (x, y) => [x, 600 - y],
  convertToViewportPoint: (x, y) => [x, 600 - y],
  convertToViewportRectangle: ([left, bottom, right, top]) => [
    left!,
    600 - bottom!,
    right!,
    600 - top!,
  ],
};

function PageHarness({
  sourceId,
  assetId,
  pageNumber = 3,
  regionActive = false,
}: {
  sourceId: EntityId;
  assetId: EntityId;
  pageNumber?: number;
  regionActive?: boolean;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  return (
    <div className="cn-reader__scroll" role="region" aria-label="Source pages" tabIndex={0}>
      <div ref={pageRef} className="cn-pdf-page" data-page={pageNumber}>
        <div className="cn-pdf-page__text">
          <span>Selectable archive quote</span>
        </div>
        <PdfAnnotationLayer
          sourceId={sourceId}
          assetId={assetId}
          pageNumber={pageNumber}
          viewport={VIEWPORT}
          pageBox={PAGE_BOX}
          pageRef={pageRef}
          regionActive={regionActive}
        />
      </div>
    </div>
  );
}

function VirtualizedPageHarness({
  sourceId,
  assetId,
}: {
  sourceId: EntityId;
  assetId: EntityId;
}) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setMounted((current) => !current)}>
        {mounted ? 'Unmount page' : 'Remount page'}
      </button>
      {mounted ? <PageHarness sourceId={sourceId} assetId={assetId} /> : null}
    </>
  );
}

async function sourceWithAssets(repositories: MemoryRepositories) {
  const source = await repositories.sources.create({
    type: 'book',
    title: 'Production annotations',
  });
  const makeAsset = async (name: string) => {
    const asset = await repositories.assets.create({
      kind: 'pdf',
      mimeType: 'application/pdf',
      originalName: name,
      sizeBytes: 100,
      storageKey: `asset/${name}`,
    });
    await repositories.assets.linkToSource(source.id, asset.id, 'supplement');
    return asset;
  };
  return { source, assetA: await makeAsset('a.pdf'), assetB: await makeAsset('b.pdf') };
}

async function seedHighlight(
  repositories: MemoryRepositories,
  sourceId: EntityId,
  assetId: EntityId,
  page = 3,
) {
  return createSourceAnnotation(repositories, {
    sourceId,
    assetId,
    page,
    kind: 'highlight',
    anchor: {
      kind: 'text',
      quote: 'Selectable archive quote',
      rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.04 }],
      boundingRect: { x: 0.1, y: 0.2, width: 0.4, height: 0.04 },
    },
  });
}

async function seedRegion(
  repositories: MemoryRepositories,
  sourceId: EntityId,
  assetId: EntityId,
  page = 3,
) {
  return createSourceAnnotation(repositories, {
    sourceId,
    assetId,
    page,
    kind: 'region',
    anchor: { kind: 'area', rect: { x: 0.5, y: 0.4, width: 0.2, height: 0.1 } },
  });
}

function parsedAnnotation({
  id,
  sourceId,
  assetId,
  kind,
  anchor,
  geometryStatus,
}: {
  id: EntityId;
  sourceId: EntityId;
  assetId: EntityId;
  kind: AnnotationKind;
  anchor: AnnotationAnchor;
  geometryStatus?: 'converted' | 'fallback';
}): Annotation {
  return AnnotationSchema.parse({
    id,
    sourceId,
    assetId,
    page: 3,
    kind,
    anchor,
    style: {},
    linkedBlockIds: [],
    legacyMigration: geometryStatus
      ? { fromSchemaVersion: 1, geometryStatus }
      : undefined,
    createdAt: '2026-08-06T00:00:00.000Z',
    updatedAt: '2026-08-06T00:00:00.000Z',
    revision: 0,
  });
}

function fallbackAnnotation(
  sourceId: EntityId,
  assetId: EntityId,
  kind: 'point' | 'ink' | 'area' | 'text',
): Annotation {
  const id = crypto.randomUUID();
  if (kind === 'point') {
    return parsedAnnotation({
      id,
      sourceId,
      assetId,
      kind: 'bookmark',
      anchor: { kind: 'point', point: { x: 0, y: 0 } },
      geometryStatus: 'fallback',
    });
  }
  if (kind === 'ink') {
    return parsedAnnotation({
      id,
      sourceId,
      assetId,
      kind: 'pen',
      anchor: { kind: 'ink', strokes: [{ points: [{ x: 0, y: 0 }] }] },
      geometryStatus: 'fallback',
    });
  }
  if (kind === 'area') {
    return parsedAnnotation({
      id,
      sourceId,
      assetId,
      kind: 'region',
      anchor: { kind: 'area', rect: { x: 0, y: 0, width: 0, height: 0 } },
      geometryStatus: 'fallback',
    });
  }
  return parsedAnnotation({
    id,
    sourceId,
    assetId,
    kind: 'highlight',
    anchor: {
      kind: 'text',
      quote: '',
      rects: [{ x: 0, y: 0, width: 0, height: 0 }],
      boundingRect: { x: 0, y: 0, width: 0, height: 0 },
    },
    geometryStatus: 'fallback',
  });
}

function selectHarnessText(): Selection {
  const text = screen.getByText('Selectable archive quote').firstChild!;
  const range = document.createRange();
  range.selectNodeContents(text);
  Object.defineProperty(range, 'getClientRects', {
    value: () => [{ left: 40, top: 120, width: 160, height: 24 }],
  });
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  return selection;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

let repositories: MemoryRepositories;

beforeEach(() => {
  repositories = createMemoryRepositories();
});

describe('PdfAnnotationLayer', () => {
  it('renders persisted highlight and region projections on their exact page', async () => {
    const { source, assetA } = await sourceWithAssets(repositories);
    await seedHighlight(repositories, source.id, assetA.id);
    await seedRegion(repositories, source.id, assetA.id);

    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    const highlight = await screen.findByRole('button', {
      name: /Highlight on page 3/u,
    });
    const region = screen.getByRole('button', { name: 'Region on page 3' });
    expect(highlight).toHaveStyle({ left: '40px', top: '120px', width: '160px' });
    expect(region).toHaveStyle({ left: '200px', top: '240px', width: '80px' });
  });

  it('isolates replacement assets on the same source and page', async () => {
    const { source, assetA, assetB } = await sourceWithAssets(repositories);
    await seedHighlight(repositories, source.id, assetA.id);

    const rendered = renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetB.id} />,
      { repositories },
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: /Highlight/u })).toBeNull());

    rendered.unmount();
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );
    expect(
      await screen.findByRole('button', { name: /Highlight on page 3/u }),
    ).toBeVisible();
  });

  it('does not spatially render or focus a fallback point sentinel', async () => {
    const { source, assetA } = await sourceWithAssets(repositories);
    const fallback = fallbackAnnotation(source.id, assetA.id, 'point');
    const read = vi.fn(async () => [fallback]);
    repositories.annotations.getBySourceAssetAndPage = read;
    const deleteSpy = vi.spyOn(repositories.annotations, 'delete');

    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    const notice = await screen.findByText(
      'A legacy annotation on this page could not be positioned precisely.',
    );
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    const layer = screen.getByTestId('annotation-layer');
    expect(layer.querySelector('.cn-annotation--point')).toBeNull();
    expect(layer.querySelector(`[data-annotation-id="${fallback.id}"]`)).toBeNull();
    expect(layer.querySelector('button.cn-annotation')).toBeNull();
    expect(await repositories.annotations.getBySourceAssetAndPage(
      source.id,
      assetA.id,
      3,
    )).toEqual([fallback]);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('hides fallback ink, area, and text sentinels behind one count-honest notice', async () => {
    const { source, assetA } = await sourceWithAssets(repositories);
    const fallback = (['ink', 'area', 'text'] as const).map((kind) =>
      fallbackAnnotation(source.id, assetA.id, kind),
    );
    repositories.annotations.getBySourceAssetAndPage = vi.fn(async () => fallback);
    const deleteSpy = vi.spyOn(repositories.annotations, 'delete');

    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    const notice = await screen.findByText(
      '3 legacy annotations on this page could not be positioned precisely.',
    );
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    const layer = screen.getByTestId('annotation-layer');
    expect(layer.querySelector('.cn-annotation__ink')).toBeNull();
    expect(layer.querySelector('.cn-annotation--ink-target')).toBeNull();
    expect(layer.querySelector('.cn-annotation--region')).toBeNull();
    expect(layer.querySelector('.cn-annotation--highlight')).toBeNull();
    expect(layer.querySelectorAll('[data-annotation-id]')).toHaveLength(0);
    expect(await repositories.annotations.getBySourceAssetAndPage(
      source.id,
      assetA.id,
      3,
    )).toEqual(fallback);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('continues to position native and converted legacy geometry', async () => {
    const { source, assetA } = await sourceWithAssets(repositories);
    const native = await seedHighlight(repositories, source.id, assetA.id);
    const converted = parsedAnnotation({
      id: crypto.randomUUID(),
      sourceId: source.id,
      assetId: assetA.id,
      kind: 'region',
      anchor: { kind: 'area', rect: { x: 0.5, y: 0.4, width: 0.2, height: 0.1 } },
      geometryStatus: 'converted',
    });
    repositories.annotations.getBySourceAssetAndPage = vi.fn(async () => [
      native,
      converted,
    ]);

    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    const nativeMark = await screen.findByRole('button', {
      name: /Highlight on page 3/u,
    });
    const convertedMark = screen.getByRole('button', { name: 'Region on page 3' });
    expect(nativeMark).toHaveStyle({ left: '40px', top: '120px', width: '160px' });
    expect(convertedMark).toHaveStyle({ left: '200px', top: '240px', width: '80px' });
    expect(screen.queryByText(/legacy annotations? on this page/u)).toBeNull();
  });

  it('supports keyboard actions and requires confirmation before delete', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const annotation = await seedHighlight(repositories, source.id, assetA.id);
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    await user.tab();
    const highlight = await screen.findByRole('button', { name: /Highlight on page 3/u });
    if (document.activeElement !== highlight) await user.tab();
    await waitFor(() => expect(highlight).toHaveFocus());
    await user.keyboard('{Enter}');
    expect(screen.getByRole('toolbar', { name: /Actions for Highlight/u })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Use Ochre' }));
    await waitFor(async () => {
      expect((await repositories.annotations.getById(annotation.id))?.style.color).toBe(
        'var(--cn-palette-warning-300)',
      );
    });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('toolbar', { name: /Actions for Highlight/u })).toBeNull();
    await waitFor(() => expect(highlight).toHaveFocus());
    await user.keyboard(' ');
    expect(screen.getByRole('toolbar', { name: /Actions for Highlight/u })).toBeVisible();
    await user.keyboard('{Escape}');

    highlight.focus();
    await user.keyboard('{Delete}');
    expect(screen.getByRole('dialog', { name: 'Delete highlight?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await repositories.annotations.getById(annotation.id)).not.toBeNull();
    await waitFor(() => expect(highlight).toHaveFocus());

    await user.keyboard('{Delete}');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(async () => {
      expect(await repositories.annotations.getById(annotation.id)).toBeNull();
    });
    expect(screen.queryByRole('button', { name: /Highlight on page 3/u })).toBeNull();
  });

  it('retains a failed text-selection intent and retries without clearing it', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const realCreate = repositories.annotations.create.bind(repositories.annotations);
    let rejectCreate = true;
    repositories.annotations.create = vi.fn(async (input) => {
      if (rejectCreate) throw new Error('induced create failure');
      return realCreate(input);
    });
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    const text = screen.getByText('Selectable archive quote').firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    Object.defineProperty(range, 'getClientRects', {
      value: () => [{ left: 40, top: 120, width: 160, height: 24 }],
    });
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent(document, new Event('selectionchange'));

    await user.click(await screen.findByRole('button', { name: 'Highlight' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not save the annotation/i,
    );
    expect(selection.rangeCount).toBe(1);

    rejectCreate = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('button', { name: /Highlight on page 3/u }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Highlight' })).toBeNull();
  });

  it('restores a failed create after unmount and retries to one durable record', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const firstCreate = deferred<Annotation>();
    const realCreate = repositories.annotations.create.bind(repositories.annotations);
    const createSpy = vi.fn(async (input: Parameters<typeof realCreate>[0]) => {
      if (createSpy.mock.calls.length === 1) {
        return firstCreate.promise;
      }
      return realCreate(input);
    });
    repositories.annotations.create = createSpy;
    renderWithProviders(
      <VirtualizedPageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    selectHarnessText();
    await user.click(await screen.findByRole('button', { name: 'Highlight' }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'Unmount page' }));
    await act(async () => {
      firstCreate.reject(new Error('delayed persistence failure'));
      await firstCreate.promise.catch(() => undefined);
    });

    await user.click(screen.getByRole('button', { name: 'Remount page' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not save the annotation/iu,
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('button', { name: /Highlight on page 3/u }),
    ).toBeVisible();
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
    expect(await repositories.annotations.getBySourceAssetAndPage(
      source.id,
      assetA.id,
      3,
    )).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('clears a successful create after unmount without exposing a stale retry', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const firstCreate = deferred<Annotation>();
    const realCreate = repositories.annotations.create.bind(repositories.annotations);
    let capturedInput: Parameters<typeof realCreate>[0] | null = null;
    const createSpy = vi.fn(async (input: Parameters<typeof realCreate>[0]) => {
      capturedInput = input;
      return firstCreate.promise;
    });
    repositories.annotations.create = createSpy;
    renderWithProviders(
      <VirtualizedPageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    selectHarnessText();
    await user.click(await screen.findByRole('button', { name: 'Highlight' }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'Unmount page' }));
    await act(async () => {
      if (!capturedInput) throw new Error('Create input was not captured');
      firstCreate.resolve(await realCreate(capturedInput));
      await firstCreate.promise;
    });

    await user.click(screen.getByRole('button', { name: 'Remount page' }));
    expect(
      await screen.findByRole('button', { name: /Highlight on page 3/u }),
    ).toBeVisible();
    expect(createSpy).toHaveBeenCalledOnce();
    expect(await repositories.annotations.getBySourceAssetAndPage(
      source.id,
      assetA.id,
      3,
    )).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('does not expose a pending intent across source and asset identity', async () => {
    const { source: sourceA, assetA } = await sourceWithAssets(repositories);
    const { source: sourceB, assetA: assetB } = await sourceWithAssets(repositories);
    putPendingIntent({
      sourceId: sourceA.id,
      assetId: assetA.id,
      page: 3,
      kind: 'highlight',
      anchor: {
        kind: 'text',
        quote: 'Source A only',
        rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
        boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
      },
      status: 'failed',
      errorMessage: 'Source A failure',
    });

    renderWithProviders(
      <PageHarness sourceId={sourceB.id} assetId={assetB.id} />,
      { repositories },
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
      expect(screen.queryByText('Source A failure')).toBeNull();
      expect(document.querySelector('.cn-annotation-create')).toBeNull();
      expect(document.querySelector('.cn-annotation-notice')).toBeNull();
    });
    clearPendingIntent(sourceA.id, assetA.id, 3);
  });

  it('keeps an in-flight saving intent when a selection change collapses mid-save', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const pendingCreate = deferred<Annotation>();
    const realCreate = repositories.annotations.create.bind(repositories.annotations);
    repositories.annotations.create = vi.fn(
      async (_input: Parameters<typeof realCreate>[0]) => pendingCreate.promise,
    );
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    // A draft highlight is showing.
    selectHarnessText();
    await screen.findByRole('button', { name: 'Highlight' });
    const draft = await waitFor(() => {
      const intent = getPendingIntent(source.id, assetA.id, 3);
      expect(intent?.status).toBe('draft');
      return intent!;
    });

    // The user clicks Highlight: savePending moves the store to 'saving' while
    // the write is in flight.
    await user.click(screen.getByRole('button', { name: 'Highlight' }));
    await waitFor(() => {
      expect(getPendingIntent(source.id, assetA.id, 3)?.status).toBe('saving');
    });

    // A collapsed selection change (e.g. a click elsewhere) must not clear the
    // in-flight intent — the handler reads the live store, never a stale
    // render-time snapshot.
    act(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(getPendingIntent(source.id, assetA.id, 3)?.status).toBe('saving');

    // Resolve the write: exactly one durable annotation, no pending UI.
    act(() => {
      pendingCreate.resolve(realCreate({
        sourceId: source.id,
        assetId: assetA.id,
        page: 3,
        kind: 'highlight',
        anchor: draft.anchor,
      }));
    });
    await waitFor(() => {
      expect(getPendingIntent(source.id, assetA.id, 3)).toBeNull();
    });
    expect(
      await repositories.annotations.getBySourceAssetAndPage(source.id, assetA.id, 3),
    ).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();

    // The opposite direction still holds: a fresh draft IS cleared by a
    // collapsed selection change.
    act(() => {
      putPendingIntent({
        sourceId: source.id,
        assetId: assetA.id,
        page: 3,
        kind: 'highlight',
        anchor: draft.anchor,
        status: 'draft',
      });
    });
    act(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(getPendingIntent(source.id, assetA.id, 3)).toBeNull();
  });

  it('surfaces a typed error message on a failed create instead of a generic failure', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const createModule = await import('@application/annotations/create-annotation');
    const spy = vi
      .spyOn(createModule, 'createSourceAnnotation')
      .mockRejectedValueOnce(new AssetNotLinkedToSourceError(source.id, assetA.id));
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    const text = screen.getByText('Selectable archive quote').firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    Object.defineProperty(range, 'getClientRects', {
      value: () => [{ left: 40, top: 120, width: 160, height: 24 }],
    });
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent(document, new Event('selectionchange'));

    await user.click(await screen.findByRole('button', { name: 'Highlight' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no longer attached to the source/u,
    );
    expect(selection.rangeCount).toBe(1);
    spy.mockRestore();
  });

  it('reloads instead of overwriting when a style update conflicts', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const annotation = await seedHighlight(repositories, source.id, assetA.id);
    repositories.annotations.update = vi.fn(async () => {
      throw new RevisionConflictError('Annotation', annotation.id, 0, 1);
    });
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    await user.click(
      await screen.findByRole('button', { name: /Highlight on page 3/u }),
    );
    await user.click(screen.getByRole('button', { name: 'Use Ochre' }));
    expect(
      await screen.findByText('This annotation changed elsewhere — reloaded.'),
    ).toBeVisible();
    expect((await repositories.annotations.getById(annotation.id))?.style).toEqual({});
  });

  it('offers read retry without touching stored data', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    const annotation = await seedHighlight(repositories, source.id, assetA.id);
    const realRead = repositories.annotations.getBySourceAssetAndPage.bind(
      repositories.annotations,
    );
    repositories.annotations.getBySourceAssetAndPage = vi
      .fn()
      .mockRejectedValueOnce(new Error('induced read failure'))
      .mockImplementation(realRead);
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Stored marks were not deleted',
    );
    expect(await repositories.annotations.getById(annotation.id)).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('button', { name: /Highlight on page 3/u }),
    ).toBeVisible();
  });

  it('renders migrated point and vector ink records as read-only projections', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    await createSourceAnnotation(repositories, {
      sourceId: source.id,
      assetId: assetA.id,
      page: 3,
      kind: 'bookmark',
      anchor: { kind: 'point', point: { x: 0.2, y: 0.3 } },
    });
    await createSourceAnnotation(repositories, {
      sourceId: source.id,
      assetId: assetA.id,
      page: 3,
      kind: 'pen',
      anchor: {
        kind: 'ink',
        strokes: [{ points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.25 }] }],
      },
    });
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );

    const point = await screen.findByRole('button', { name: 'Point on page 3' });
    const ink = screen.getByRole('button', { name: 'Ink drawing on page 3' });
    expect(document.querySelectorAll('.cn-annotation__ink polyline')).toHaveLength(1);
    await user.click(point);
    expect(screen.queryByRole('toolbar')).toBeNull();
    await user.click(ink);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('cancels an active region drag with Escape and returns source focus', async () => {
    const user = userEvent.setup();
    const { source, assetA } = await sourceWithAssets(repositories);
    renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} regionActive />,
      { repositories },
    );
    const layer = await screen.findByTestId('annotation-layer');
    Object.defineProperty(layer, 'setPointerCapture', { value: vi.fn() });
    await user.pointer({
      keys: '[MouseLeft>]',
      target: layer,
      coords: { x: 40, y: 50 },
    });
    await user.keyboard('{Escape}');
    expect(screen.getByRole('region', { name: 'Source pages' })).toHaveFocus();
    expect(await repositories.annotations.getBySource(source.id)).toEqual([]);
  });

  it('does not update state after an in-flight read is unmounted', async () => {
    const { source, assetA } = await sourceWithAssets(repositories);
    let resolve!: (value: Awaited<ReturnType<typeof repositories.annotations.getBySourceAssetAndPage>>) => void;
    const inFlightRead = vi.fn<
      MemoryRepositories['annotations']['getBySourceAssetAndPage']
    >(
      () => new Promise((done) => {
        resolve = done;
      }),
    );
    repositories.annotations.getBySourceAssetAndPage = inFlightRead;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rendered = renderWithProviders(
      <PageHarness sourceId={source.id} assetId={assetA.id} />,
      { repositories },
    );
    await waitFor(() => expect(inFlightRead).toHaveBeenCalledOnce());
    rendered.unmount();
    await act(async () => resolve([]));
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
