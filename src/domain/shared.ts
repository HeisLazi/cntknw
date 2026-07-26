/**
 * CNTKNW Domain — Shared Primitives
 *
 * All Zod schemas are authoritative. TypeScript types are inferred
 * via z.infer to prevent schema/type drift (amendment 7).
 *
 * Create-input types use z.input, NOT z.infer. z.infer produces the
 * *output* type, in which every .default() field is already applied
 * and therefore REQUIRED. Using it for inputs inverts the meaning of
 * every default in the codebase. See ADR-0001 §2.
 */
import { z } from 'zod';

// ─── Scalar Primitives ───────────────────────────────────────────

/**
 * Entity identifier.
 *
 * Zod's built-in .uuid() only accepts versions 1-5, which would
 * reject UUIDv7 — the version the handoff (§9.1) names as a
 * candidate. This regex accepts versions 1-8 plus the nil UUID so
 * the generation strategy in lib/id.ts can change without a schema
 * migration. See ADR-0001 §5.
 */
const UUID_ANY_VERSION =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

export const EntityIdSchema = z
  .string()
  .regex(UUID_ANY_VERSION, 'Must be a UUID (version 1-8)');
export type EntityId = z.infer<typeof EntityIdSchema>;

export const ISODateTimeSchema = z.string().datetime();
export type ISODateTime = z.infer<typeof ISODateTimeSchema>;

export const RevisionSchema = z.number().int().nonnegative();
export type Revision = z.infer<typeof RevisionSchema>;

// ─── Geometry (page / image space) ───────────────────────────────
// NOTE: these are normalised *document* coordinates. Geographic
// coordinates live in domain/spatial, not here.

export const NormalizedPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>;

export const NormalizedRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type NormalizedRect = z.infer<typeof NormalizedRectSchema>;

// ─── Text Anchor ─────────────────────────────────────────────────
// Resilient pointer into extracted source text. Offsets may shift
// between PDF.js versions, so quote/prefix/suffix provide a
// content-based fallback (handoff §14.3).

export const TextAnchorSchema = z.object({
  page: z.number().int().positive(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  quote: z.string(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  /**
   * Zero-based index of the sentence within the page's cleaned
   * reading stream. Read Aloud readiness only — no playback is
   * implemented in this phase. Never used as the sole anchor:
   * segmentation may change, so quote/prefix/suffix remain
   * authoritative (RA-INV-004).
   */
  sentenceIndex: z.number().int().nonnegative().optional(),
});
export type TextAnchor = z.infer<typeof TextAnchorSchema>;

// ─── Source Location ─────────────────────────────────────────────
// Universal locator for any position within any source type.
// PDF pages are 1-based at the domain boundary.

export const SourceTypeSchema = z.enum([
  'book',
  'artwork',
  'chess-game',
  'chess-position',
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const PdfLocationSchema = z.object({
  page: z.number().int().positive(),
  textAnchor: TextAnchorSchema.optional(),
  /** Read Aloud readiness. See TextAnchor.sentenceIndex. */
  sentenceIndex: z.number().int().nonnegative().optional(),
});
export type PdfLocation = z.infer<typeof PdfLocationSchema>;

export const ArtworkLocationSchema = z.object({
  region: NormalizedRectSchema.optional(),
});
export type ArtworkLocation = z.infer<typeof ArtworkLocationSchema>;

export const ChessLocationSchema = z.object({
  moveNumber: z.number().int().nonnegative().optional(),
  fen: z.string().optional(),
});
export type ChessLocation = z.infer<typeof ChessLocationSchema>;

export const SourceLocationSchema = z.object({
  sourceType: SourceTypeSchema,
  sourceId: EntityIdSchema,
  pdf: PdfLocationSchema.optional(),
  artwork: ArtworkLocationSchema.optional(),
  chess: ChessLocationSchema.optional(),
});
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

// ─── Legacy Marker ───────────────────────────────────────────────
// Tracks where a v2 record originated from during migration.

export const LegacyMarkerSchema = z.object({
  database: z.string(),
  recordId: z.string(),
});
export type LegacyMarker = z.infer<typeof LegacyMarkerSchema>;

// ─── Common Entity Fields ────────────────────────────────────────
// Reusable shape mixed into every domain entity schema.

export const BaseEntityFieldsSchema = z.object({
  id: EntityIdSchema,
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  revision: RevisionSchema,
});
export type BaseEntityFields = z.infer<typeof BaseEntityFieldsSchema>;

/**
 * Soft-deletion marker. PDD §19.3 and NFR-008 require every
 * destructive action to have a recovery path, so records are
 * marked rather than removed.
 */
export const SoftDeletableFieldsSchema = z.object({
  deletedAt: ISODateTimeSchema.optional(),
});
export type SoftDeletableFields = z.infer<typeof SoftDeletableFieldsSchema>;

// ─── Provenance ──────────────────────────────────────────────────

export const ProvenanceSchema = z.enum([
  'user',
  'imported',
  'migration',
  'ai-draft',
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;
