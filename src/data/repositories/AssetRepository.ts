import type { EntityId, Asset, SourceAsset, CreateAssetInput, AssetRole } from '@domain/index';

export interface AssetRepository {
  getById(id: EntityId): Promise<Asset | null>;
  create(input: CreateAssetInput): Promise<Asset>;
  delete(id: EntityId): Promise<void>;
  // Binary data
  storeBinary(id: EntityId, data: ArrayBuffer): Promise<void>;
  getBinary(id: EntityId): Promise<ArrayBuffer | null>;
  // Source-asset links
  linkToSource(sourceId: EntityId, assetId: EntityId, role: AssetRole): Promise<SourceAsset>;
  getAssetsForSource(sourceId: EntityId): Promise<(Asset & { role: AssetRole })[]>;
  getPrimaryAsset(sourceId: EntityId): Promise<Asset | null>;
}
