import { beforeEach, describe, expect, it } from 'vitest';
import { createEntityId } from '@lib/id';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import {
  AssetNotFoundError,
  AssetNotLinkedToSourceError,
  SourceNotFoundError,
} from '@data/errors';
import { createSourceAnnotation } from './create-annotation';

const textAnchor = {
  kind: 'text' as const,
  quote: 'A selected line',
  rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
  boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
};

let repositories: MemoryRepositories;

beforeEach(() => {
  repositories = createMemoryRepositories();
});

async function sourceAndAsset(link = true) {
  const source = await repositories.sources.create({
    type: 'book',
    title: 'The Archive',
  });
  const asset = await repositories.assets.create({
    kind: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: 128,
    storageKey: `asset/${createEntityId()}`,
  });
  if (link) await repositories.assets.linkToSource(source.id, asset.id, 'primary');
  return { source, asset };
}

describe('createSourceAnnotation', () => {
  it('persists the exact source, asset, and 1-based page', async () => {
    const { source, asset } = await sourceAndAsset();

    const saved = await createSourceAnnotation(repositories, {
      sourceId: source.id,
      assetId: asset.id,
      page: 7,
      kind: 'highlight',
      anchor: textAnchor,
    });

    expect(saved).toMatchObject({
      sourceId: source.id,
      assetId: asset.id,
      page: 7,
      kind: 'highlight',
      style: {},
    });
    expect(
      await repositories.annotations.getBySourceAssetAndPage(source.id, asset.id, 7),
    ).toEqual([saved]);
  });

  it('rejects an existing asset that is not linked to the source', async () => {
    const { source, asset } = await sourceAndAsset(false);

    await expect(
      createSourceAnnotation(repositories, {
        sourceId: source.id,
        assetId: asset.id,
        page: 1,
        kind: 'highlight',
        anchor: textAnchor,
      }),
    ).rejects.toBeInstanceOf(AssetNotLinkedToSourceError);
    expect(await repositories.annotations.getBySource(source.id)).toEqual([]);
  });

  it('rejects an asset linked to a different source', async () => {
    const { source, asset } = await sourceAndAsset(false);
    const other = await repositories.sources.create({ type: 'book', title: 'Other' });
    await repositories.assets.linkToSource(other.id, asset.id, 'primary');

    await expect(
      createSourceAnnotation(repositories, {
        sourceId: source.id,
        assetId: asset.id,
        page: 1,
        kind: 'highlight',
        anchor: textAnchor,
      }),
    ).rejects.toBeInstanceOf(AssetNotLinkedToSourceError);
    expect(await repositories.annotations.getBySource(source.id)).toEqual([]);
  });

  it('reports a missing source with a typed error and writes nothing', async () => {
    const asset = await repositories.assets.create({
      kind: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
      storageKey: 'asset/missing-source',
    });
    const missingSourceId = createEntityId();

    await expect(
      createSourceAnnotation(repositories, {
        sourceId: missingSourceId,
        assetId: asset.id,
        page: 1,
        kind: 'highlight',
        anchor: textAnchor,
      }),
    ).rejects.toBeInstanceOf(SourceNotFoundError);
    expect(await repositories.annotations.getBySource(missingSourceId)).toEqual([]);
  });

  it('reports a missing asset with a typed error and writes nothing', async () => {
    const source = await repositories.sources.create({ type: 'book', title: 'Source' });

    await expect(
      createSourceAnnotation(repositories, {
        sourceId: source.id,
        assetId: createEntityId(),
        page: 1,
        kind: 'highlight',
        anchor: textAnchor,
      }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
    expect(await repositories.annotations.getBySource(source.id)).toEqual([]);
  });

  it.each([0, -1, 1.5])('rejects invalid page %s before writing', async (page) => {
    const { source, asset } = await sourceAndAsset();
    await expect(
      createSourceAnnotation(repositories, {
        sourceId: source.id,
        assetId: asset.id,
        page,
        kind: 'highlight',
        anchor: textAnchor,
      }),
    ).rejects.toBeInstanceOf(RangeError);
    expect(await repositories.annotations.getBySource(source.id)).toEqual([]);
  });

  it('relies on the domain schema to reject incompatible kind and anchor', async () => {
    const { source, asset } = await sourceAndAsset();
    await expect(
      createSourceAnnotation(repositories, {
        sourceId: source.id,
        assetId: asset.id,
        page: 1,
        kind: 'region',
        anchor: textAnchor,
      }),
    ).rejects.toThrow(/requires a area anchor/u);
    expect(await repositories.annotations.getBySource(source.id)).toEqual([]);
  });
});
