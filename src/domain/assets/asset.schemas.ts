/**
 * CNTKNW Domain — Asset Schemas
 *
 * Assets are binary files (PDFs, images, dictionary packs).
 * SourceAssets link assets to sources with a role.
 */
import { z } from 'zod';
import { EntityIdSchema, ISODateTimeSchema } from '../shared';

// ─── Asset ───────────────────────────────────────────────────────

export const AssetKindSchema = z.enum([
  'pdf',
  'image',
  'thumbnail',
  'dictionary-pack',
  'legacy-raster',
]);
export type AssetKind = z.infer<typeof AssetKindSchema>;

export const AssetSchema = z.object({
  id: EntityIdSchema,
  kind: AssetKindSchema,
  mimeType: z.string(),
  originalName: z.string().optional(),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().optional(),
  storageKey: z.string(),
  createdAt: ISODateTimeSchema,
});
export type Asset = z.infer<typeof AssetSchema>;

// ─── Source-Asset Link ───────────────────────────────────────────

export const AssetRoleSchema = z.enum([
  'primary',
  'cover',
  'thumbnail',
  'supplement',
]);
export type AssetRole = z.infer<typeof AssetRoleSchema>;

export const SourceAssetSchema = z.object({
  sourceId: EntityIdSchema,
  assetId: EntityIdSchema,
  role: AssetRoleSchema,
});
export type SourceAsset = z.infer<typeof SourceAssetSchema>;

// ─── Create Inputs ───────────────────────────────────────────────

export const CreateAssetInputSchema = AssetSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateAssetInput = z.input<typeof CreateAssetInputSchema>;

// Asset carries createdAt but deliberately has no updatedAt or
// revision: a stored binary is immutable. Replacing content means
// creating a new Asset. SourceAsset is a pure join record and has
// no identity of its own. Adapters must not write base entity
// fields onto either (audit defects A-3, A-4).
