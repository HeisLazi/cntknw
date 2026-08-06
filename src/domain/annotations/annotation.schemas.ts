/**
 * CNTKNW Domain — Annotation Schemas
 *
 * Annotation anchors use strict, normalized coordinates in the PDF page's
 * unrotated frame. Rendered CSS pixels are projections, never persisted.
 * See ADR-0007.
 */
import { z } from 'zod';
import { BaseEntityFieldsSchema, EntityIdSchema } from '../shared';

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

// ─── Annotation-local normalized geometry ───────────────────────

const UnitCoordinateSchema = z.number().finite().min(0).max(1);

export const AnnotationPointSchema = z.object({
  x: UnitCoordinateSchema,
  y: UnitCoordinateSchema,
});
export type AnnotationPoint = z.infer<typeof AnnotationPointSchema>;

export const AnnotationRectSchema = z
  .object({
    x: UnitCoordinateSchema,
    y: UnitCoordinateSchema,
    width: UnitCoordinateSchema,
    height: UnitCoordinateSchema,
  })
  .refine((rect) => rect.x + rect.width <= 1, {
    message: 'Rectangle must not extend beyond the right page edge',
    path: ['width'],
  })
  .refine((rect) => rect.y + rect.height <= 1, {
    message: 'Rectangle must not extend beyond the bottom page edge',
    path: ['height'],
  });
export type AnnotationRect = z.infer<typeof AnnotationRectSchema>;

function containsRect(
  outer: AnnotationRect,
  inner: AnnotationRect,
): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}

// ─── Explicit anchor union ───────────────────────────────────────

export const TextAnnotationAnchorSchema = z.object({
  kind: z.literal('text'),
  quote: z.string(),
  rects: z.array(AnnotationRectSchema).min(1),
  boundingRect: AnnotationRectSchema,
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

function enforceTextAnchor(
  anchor: z.infer<typeof TextAnnotationAnchorSchema>,
  context: z.RefinementCtx,
): void {
  if (
    anchor.startOffset !== undefined &&
    anchor.endOffset !== undefined &&
    anchor.startOffset > anchor.endOffset
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startOffset must not exceed endOffset',
      path: ['endOffset'],
    });
  }
  anchor.rects.forEach((rect, index) => {
    if (!containsRect(anchor.boundingRect, rect)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'boundingRect must contain every text rectangle',
        path: ['rects', index],
      });
    }
  });
}

export const AreaAnnotationAnchorSchema = z.object({
  kind: z.literal('area'),
  rect: AnnotationRectSchema,
});

export const PointAnnotationAnchorSchema = z.object({
  kind: z.literal('point'),
  point: AnnotationPointSchema,
});

export const InkStrokeSchema = z.object({
  points: z.array(AnnotationPointSchema).min(1),
});

export const InkAnnotationAnchorSchema = z.object({
  kind: z.literal('ink'),
  strokes: z.array(InkStrokeSchema).min(1),
});

export const AnnotationAnchorSchema = z
  .discriminatedUnion('kind', [
    TextAnnotationAnchorSchema,
    AreaAnnotationAnchorSchema,
    PointAnnotationAnchorSchema,
    InkAnnotationAnchorSchema,
  ])
  .superRefine((anchor, context) => {
    if (anchor.kind === 'text') enforceTextAnchor(anchor, context);
  });
export type AnnotationAnchor = z.infer<typeof AnnotationAnchorSchema>;
export type TextAnnotationAnchor = z.infer<typeof TextAnnotationAnchorSchema>;
export type AreaAnnotationAnchor = z.infer<typeof AreaAnnotationAnchorSchema>;
export type PointAnnotationAnchor = z.infer<typeof PointAnnotationAnchorSchema>;
export type InkAnnotationAnchor = z.infer<typeof InkAnnotationAnchorSchema>;
export type InkStroke = z.infer<typeof InkStrokeSchema>;

// ─── Annotation Style ────────────────────────────────────────────

export const AnnotationStyleSchema = z.object({
  color: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  strokeWidth: z.number().nonnegative().optional(),
  fontSize: z.number().positive().optional(),
});
export type AnnotationStyle = z.infer<typeof AnnotationStyleSchema>;

/** Explicitly marks the precision of schema-v1 opaque-geometry conversion. */
export const AnnotationLegacyMigrationSchema = z.object({
  fromSchemaVersion: z.literal(1),
  geometryStatus: z.enum(['converted', 'fallback']),
});
export type AnnotationLegacyMigration = z.infer<
  typeof AnnotationLegacyMigrationSchema
>;

const AnnotationFieldsSchema = BaseEntityFieldsSchema.extend({
  sourceId: EntityIdSchema,
  assetId: EntityIdSchema,
  /** PDF page number; always 1-based at the domain boundary. */
  page: z.number().int().positive(),
  kind: AnnotationKindSchema,
  anchor: AnnotationAnchorSchema,
  style: AnnotationStyleSchema.default({}),
  linkedBlockIds: z.array(EntityIdSchema).default([]),
  legacyMigration: AnnotationLegacyMigrationSchema.optional(),
});

const REQUIRED_ANCHOR_BY_KIND: Readonly<
  Record<AnnotationKind, AnnotationAnchor['kind']>
> = {
  highlight: 'text',
  underline: 'text',
  strike: 'text',
  pen: 'ink',
  rect: 'area',
  ellipse: 'area',
  arrow: 'ink',
  text: 'area',
  region: 'area',
  bookmark: 'point',
};

function enforceKindAnchor(
  value: {
    kind: AnnotationKind;
    anchor: AnnotationAnchor;
    legacyMigration?: AnnotationLegacyMigration;
  },
  context: z.RefinementCtx,
): void {
  const required = REQUIRED_ANCHOR_BY_KIND[value.kind];
  if (value.anchor.kind !== required) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Annotation kind ${value.kind} requires a ${required} anchor`,
      path: ['anchor', 'kind'],
    });
  }
  if (
    value.anchor.kind === 'text' &&
    value.anchor.quote.length === 0 &&
    value.legacyMigration === undefined
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New text annotations require the selected quote',
      path: ['anchor', 'quote'],
    });
  }
}

export const AnnotationSchema = AnnotationFieldsSchema.superRefine(
  enforceKindAnchor,
);
export type Annotation = z.infer<typeof AnnotationSchema>;

// ─── Create Input ────────────────────────────────────────────────

export const CreateAnnotationInputSchema = AnnotationFieldsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
  legacyMigration: true,
}).superRefine(enforceKindAnchor);
export type CreateAnnotationInput = z.input<typeof CreateAnnotationInputSchema>;

// Annotations are addressed by (sourceId, assetId, page). There is no
// viewport, virtual-page, scroll-offset or DOM identity in this record.
