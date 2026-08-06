import {
  CreateAnnotationInputSchema,
  type Annotation,
  type AnnotationAnchor,
  type AnnotationKind,
  type AnnotationStyle,
  type EntityId,
} from '@domain/index';
import type { Repositories } from '@data/repositories';
import {
  AssetNotFoundError,
  AssetNotLinkedToSourceError,
  SourceNotFoundError,
} from '@data/errors';

export interface CreateSourceAnnotationInput {
  sourceId: EntityId;
  assetId: EntityId;
  page: number;
  kind: AnnotationKind;
  anchor: AnnotationAnchor;
  style?: AnnotationStyle;
}

/**
 * Create source markup only after validating the exact source/asset membership.
 * Cross-repository reference integrity belongs here, not in an adapter.
 */
export async function createSourceAnnotation(
  repositories: Repositories,
  input: CreateSourceAnnotationInput,
): Promise<Annotation> {
  const source = await repositories.sources.getById(input.sourceId);
  if (!source) throw new SourceNotFoundError(input.sourceId);

  const asset = await repositories.assets.getById(input.assetId);
  if (!asset) throw new AssetNotFoundError(input.assetId);

  const sourceAssets = await repositories.assets.getAssetsForSource(input.sourceId);
  if (!sourceAssets.some((candidate) => candidate.id === input.assetId)) {
    throw new AssetNotLinkedToSourceError(input.sourceId, input.assetId);
  }

  if (!Number.isInteger(input.page) || input.page <= 0) {
    throw new RangeError('Annotation page must be a positive integer');
  }

  const createInput = CreateAnnotationInputSchema.parse({
    sourceId: input.sourceId,
    assetId: input.assetId,
    page: input.page,
    kind: input.kind,
    anchor: input.anchor,
    style: input.style ?? {},
  });

  return repositories.annotations.create(createInput);
}
