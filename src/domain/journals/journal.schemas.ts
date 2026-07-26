/**
 * CNTKNW Domain — Journal and Block Schemas
 *
 * The journal is the central intellectual workspace. Each source
 * has one continuous journal. JournalBlock is the atomic unit.
 * BlockContent is a discriminated union validated by Zod — never
 * a single optional-field object for every block type.
 */
import { z } from 'zod';
import {
  BaseEntityFieldsSchema,
  EntityIdSchema,
  ProvenanceSchema,
  SoftDeletableFieldsSchema,
  SourceLocationSchema,
  TextAnchorSchema,
} from '../shared';

// ─── Journal ─────────────────────────────────────────────────────

export const JournalKindSchema = z.enum(['source', 'standalone']);
export type JournalKind = z.infer<typeof JournalKindSchema>;

export const JournalSchema = BaseEntityFieldsSchema.extend({
  sourceId: EntityIdSchema.optional(),
  title: z.string(),
  kind: JournalKindSchema,
});
export type Journal = z.infer<typeof JournalSchema>;

// ─── Block Kind ──────────────────────────────────────────────────

export const BlockKindSchema = z.enum([
  'paragraph',
  'heading',
  'quote',
  'question',
  'claim',
  'evidence',
  'objection',
  'definition',
  'drawing',
  'argument-map',
  'image',
  'connection-embed',
  'divider',
  'callout',
]);
export type BlockKind = z.infer<typeof BlockKindSchema>;

// ─── Block Content (Discriminated Union) ─────────────────────────
// Each block type has its own validated content shape.
// ProseMirrorJSON is left as z.record for now — the exact schema
// will be refined after the editor spike (Phase 0E).

const ProseMirrorJSONSchema = z.record(z.unknown());

export const ParagraphContentSchema = z.object({
  type: z.literal('paragraph'),
  doc: ProseMirrorJSONSchema.optional(),
  text: z.string().default(''),
});
export type ParagraphContent = z.infer<typeof ParagraphContentSchema>;

export const HeadingContentSchema = z.object({
  type: z.literal('heading'),
  level: z.number().int().min(1).max(4).default(2),
  text: z.string(),
});
export type HeadingContent = z.infer<typeof HeadingContentSchema>;

export const QuoteContentSchema = z.object({
  type: z.literal('quote'),
  quote: z.string(),
  anchor: TextAnchorSchema.optional(),
  commentary: z.string().optional(),
});
export type QuoteContent = z.infer<typeof QuoteContentSchema>;

export const QuestionContentSchema = z.object({
  type: z.literal('question'),
  text: z.string(),
  resolved: z.boolean().default(false),
  resolution: z.string().optional(),
});
export type QuestionContent = z.infer<typeof QuestionContentSchema>;

export const ClaimContentSchema = z.object({
  type: z.literal('claim'),
  text: z.string(),
  supportingBlockIds: z.array(EntityIdSchema).default([]),
});
export type ClaimContent = z.infer<typeof ClaimContentSchema>;

export const EvidenceContentSchema = z.object({
  type: z.literal('evidence'),
  text: z.string(),
  claimBlockId: EntityIdSchema.optional(),
});
export type EvidenceContent = z.infer<typeof EvidenceContentSchema>;

export const ObjectionContentSchema = z.object({
  type: z.literal('objection'),
  text: z.string(),
  targetBlockId: EntityIdSchema.optional(),
});
export type ObjectionContent = z.infer<typeof ObjectionContentSchema>;

export const DefinitionContentSchema = z.object({
  type: z.literal('definition'),
  term: z.string(),
  dictionaryEntryId: EntityIdSchema.optional(),
  sourceMeaning: z.string().optional(),
  personalMeaning: z.string().optional(),
});
export type DefinitionContent = z.infer<typeof DefinitionContentSchema>;

export const DrawingContentSchema = z.object({
  type: z.literal('drawing'),
  /** Editable vector/object data — NOT a flattened raster. */
  drawingData: z.record(z.unknown()),
  previewDataUrl: z.string().optional(),
});
export type DrawingContent = z.infer<typeof DrawingContentSchema>;

export const ArgumentMapContentSchema = z.object({
  type: z.literal('argument-map'),
  mapViewId: EntityIdSchema.optional(),
});
export type ArgumentMapContent = z.infer<typeof ArgumentMapContentSchema>;

export const ImageContentSchema = z.object({
  type: z.literal('image'),
  assetId: EntityIdSchema.optional(),
  dataUrl: z.string().optional(),
  caption: z.string().optional(),
  alt: z.string().optional(),
});
export type ImageContent = z.infer<typeof ImageContentSchema>;

export const ConnectionEmbedContentSchema = z.object({
  type: z.literal('connection-embed'),
  connectionId: EntityIdSchema,
});
export type ConnectionEmbedContent = z.infer<typeof ConnectionEmbedContentSchema>;

export const DividerContentSchema = z.object({
  type: z.literal('divider'),
});
export type DividerContent = z.infer<typeof DividerContentSchema>;

export const CalloutContentSchema = z.object({
  type: z.literal('callout'),
  text: z.string(),
  style: z.enum(['neutral', 'important', 'warning']).default('neutral'),
});
export type CalloutContent = z.infer<typeof CalloutContentSchema>;

// ─── Block Content Union ─────────────────────────────────────────

export const BlockContentSchema = z.discriminatedUnion('type', [
  ParagraphContentSchema,
  HeadingContentSchema,
  QuoteContentSchema,
  QuestionContentSchema,
  ClaimContentSchema,
  EvidenceContentSchema,
  ObjectionContentSchema,
  DefinitionContentSchema,
  DrawingContentSchema,
  ArgumentMapContentSchema,
  ImageContentSchema,
  ConnectionEmbedContentSchema,
  DividerContentSchema,
  CalloutContentSchema,
]);

/**
 * Stored block content: every `.default()` has been applied, so
 * `resolved`, `supportingBlockIds` and friends are present. This is
 * what a repository returns.
 */
export type BlockContent = z.infer<typeof BlockContentSchema>;

/**
 * Block content as a caller supplies it, with defaulted fields
 * optional. Anything accepting content from a caller must use this,
 * not `BlockContent` — using the output type as an input requires
 * callers to supply the very fields the defaults exist to provide.
 * See ADR-0001 §2.
 */
export type BlockContentInput = z.input<typeof BlockContentSchema>;

// ─── Journal Block ───────────────────────────────────────────────

export const JournalBlockSchema = BaseEntityFieldsSchema.merge(
  SoftDeletableFieldsSchema,
).extend({
  journalId: EntityIdSchema,
  kind: BlockKindSchema,
  sourceLocation: SourceLocationSchema.optional(),
  parentBlockId: EntityIdSchema.optional(),
  rank: z.string(),
  content: BlockContentSchema,
  conceptIds: z.array(EntityIdSchema).default([]),
  provenance: ProvenanceSchema.default('user'),
  /**
   * Set when this block has been promoted to a canonical
   * EpistemicClaim. The block remains ordinary journal content;
   * promotion links, it does not convert. Absent for the vast
   * majority of blocks, which is the intended default — nothing is
   * promoted automatically. See ADR-0001 §4.
   */
  epistemicClaimId: EntityIdSchema.optional(),
});
export type JournalBlock = z.infer<typeof JournalBlockSchema>;

// ─── Create Inputs ───────────────────────────────────────────────

export const CreateBlockInputSchema = JournalBlockSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
  deletedAt: true,
});
export type CreateBlockInput = z.input<typeof CreateBlockInputSchema>;

export const CreateJournalInputSchema = JournalSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
});
export type CreateJournalInput = z.input<typeof CreateJournalInputSchema>;

export const UpdateBlockInputSchema = z.object({
  id: EntityIdSchema,
  content: BlockContentSchema.optional(),
  kind: BlockKindSchema.optional(),
  conceptIds: z.array(EntityIdSchema).optional(),
  parentBlockId: EntityIdSchema.nullable().optional(),
  rank: z.string().optional(),
  epistemicClaimId: EntityIdSchema.nullable().optional(),
});
export type UpdateBlockInput = z.input<typeof UpdateBlockInputSchema>;

export const MoveBlockInputSchema = z.object({
  blockId: EntityIdSchema,
  newJournalId: EntityIdSchema.optional(),
  newParentBlockId: EntityIdSchema.nullable().optional(),
  newRank: z.string(),
  newSourceLocation: SourceLocationSchema.optional(),
});
export type MoveBlockInput = z.infer<typeof MoveBlockInputSchema>;
