/**
 * CNTKNW Domain — Annotation Schemas
 *
 * Annotations overlay source assets (PDFs, images). They use
 * normalised coordinates in unrotated page space. Legacy
 * annotations without viewport data are preserved as-is
 * (amendment 11).
 */
import { z } from 'zod';
import {
  BaseEntityFieldsSchema,
  EntityIdSchema,
  TextAnchorSchema,
} from '../shared';

// ─── Annotation Kind ─────────────────────────────────────────────

export const AnnotationKindSchema = z.enum([
  'highlight',
  'underline',
  'strike',
  'pen',
  'rect',
  'ellipse',
  'arrow',
  'text',
  'region',
  'bookmark',
]);
export type AnnotationKind = z.infer<typeof AnnotationKindSchema>;

// ─── Annotation Style ────────────────────────────────────────────

export const AnnotationStyleSchema = z.object({
  color: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  strokeWidth: z.number().nonnegative().optional(),
  fontSize: z.number().positive().optional(),
});
export type AnnotationStyle = z.infer<typeof AnnotationStyleSchema>;

// ─── Geometry ────────────────────────────────────────────────────
// Geometry is stored as an opaque validated-by-kind object.
// Normalised coordinates are used when viewport dimensions
// are available. Legacy geometry is preserved unchanged.

export const AnnotationGeometrySchema = z.object({
  /** Whether coordinates are normalised (0-1) or raw pixels. */
  normalized: z.boolean().default(false),
  /** Raw geometry data — shape varies by annotation kind. */
  data: z.record(z.unknown()),
  /** Viewport dimensions at creation, if known. */
  viewportWidth: z.number().positive().optional(),
  viewportHeight: z.number().positive().optional(),
});
export type AnnotationGeometry = z.infer<typeof AnnotationGeometrySchema>;

// ─── Annotation ──────────────────────────────────────────────────

export const AnnotationSchema = BaseEntityFieldsSchema.extend({
  sourceId: EntityIdSchema,
  assetId: EntityIdSchema,
  page: z.number().int().positive(),
  kind: AnnotationKindSchema,
  geometry: AnnotationGeometrySchema,
  style: AnnotationStyleSchema.default({}),
  textAnchor: TextAnchorSchema.optional(),
  linkedBlockIds: z.array(EntityIdSchema).default([]),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

// ─── Create Input ────────────────────────────────────────────────

export const CreateAnnotationInputSchema = AnnotationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
});
export type CreateAnnotationInput = z.input<typeof CreateAnnotationInputSchema>;

// Annotations are addressed by (sourceId, assetId, page). There is
// no `location` field: the v1 prototype's habit of keying
// annotations by book rather than by the actual PDF asset is the
// defect handoff §5.3 and §26 call out. Adapters must query `page`
// directly (audit defect A-2).
