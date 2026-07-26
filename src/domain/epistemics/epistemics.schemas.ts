/**
 * CNTKNW Domain — Epistemics
 *
 * One formal claim model, shared by the journal, argument maps and
 * the future Atlas. PDD §7.3 already defines `claim`, `evidence` and
 * `objection` as journal block kinds; this module does NOT replace
 * them and does not duplicate them.
 *
 * The relationship is promotion, not conversion:
 *
 *   1. A journal claim block stays ordinary journal content.
 *      Most claims never leave the journal, and nothing is
 *      automatically promoted.
 *   2. When the user decides a claim deserves formal treatment,
 *      the block is PROMOTED: an EpistemicClaim is created and the
 *      block gains `epistemicClaimId`.
 *   3. The block keeps its identity, rank, source location, history
 *      and backlinks. Nothing is rewritten.
 *
 * Promotion links rather than transforms so that one claim can be
 * asserted from several passages, in several sources. A transform
 * (PDD §7.5) replaces a block's type in place and cannot express
 * that many-to-one relationship. See ADR-0001 §4.
 *
 * Evidence, objections and competing interpretations attach through
 * Connection records, never through mutable arrays on the claim
 * (INV-007: backlinks are queried, not stored).
 */
import { z } from 'zod';
import {
  BaseEntityFieldsSchema,
  EntityIdSchema,
  SoftDeletableFieldsSchema,
  SourceLocationSchema,
} from '../shared';
import { TemporalExtentSchema } from '../time/time.schemas';
import { SpatialRefSchema } from '../spatial/spatial.schemas';
import { KnowledgeEntityRefSchema } from '../knowledge/knowledge.schemas';

// ─── Confidence ──────────────────────────────────────────────────

/**
 * The user's confidence in the claim. Coarse and ordinal on
 * purpose: a numeric percentage would imply a calibration nobody
 * actually has when reading history or philosophy.
 */
export const ConfidenceLevelSchema = z.enum([
  'speculative',
  'low',
  'moderate',
  'high',
  'near-certain',
]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const CONFIDENCE_ORDER: readonly ConfidenceLevel[] = [
  'speculative',
  'low',
  'moderate',
  'high',
  'near-certain',
] as const;

// ─── Knowledge Status ────────────────────────────────────────────

/**
 * Where the claim stands in the user's thinking. This is the
 * claim's lifecycle, distinct from how confident they feel: a
 * contested claim may still be held with high confidence.
 */
export const KnowledgeStatusSchema = z.enum([
  'open',
  'supported',
  'contested',
  'superseded',
  'settled',
  'abandoned',
]);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusSchema>;

// ─── Epistemic Claim ─────────────────────────────────────────────

export const EpistemicClaimSchema = BaseEntityFieldsSchema.merge(
  SoftDeletableFieldsSchema,
).extend({
  /** The proposition, stated plainly. */
  statement: z.string().min(1),

  /** Optional elaboration; not a substitute for the statement. */
  elaboration: z.string().optional(),

  confidence: ConfidenceLevelSchema.default('moderate'),
  status: KnowledgeStatusSchema.default('open'),

  /**
   * Journal blocks this claim was promoted from. Many-to-one: the
   * same claim may be asserted at several passages across sources.
   * Empty is valid — a claim may be authored directly in a map or,
   * later, in the Atlas.
   */
  originBlockIds: z.array(EntityIdSchema).default([]),

  /**
   * Where the claim was first made. Preserved so a formal claim can
   * always be traced back to a page.
   */
  primaryLocation: SourceLocationSchema.optional(),

  /**
   * Atlas readiness. A claim may be *about* historical entities,
   * a period, or a place — none of which are modelled yet. These
   * fields exist so the Atlas can attach without a schema change.
   */
  aboutEntities: z.array(KnowledgeEntityRefSchema).default([]),
  temporalExtent: TemporalExtentSchema.optional(),
  spatialRef: SpatialRefSchema.optional(),

  /**
   * Free tags for grouping competing interpretations of the same
   * question. Two claims sharing a thread are rival answers.
   */
  interpretationThread: z.string().optional(),
});
export type EpistemicClaim = z.infer<typeof EpistemicClaimSchema>;

// ─── Epistemic Relationship Types ────────────────────────────────

/**
 * Relationship vocabulary for connections whose endpoints include a
 * formal claim. Mirrors the argument-map semantics in PDD §8.5 so
 * that a map edge and a claim relationship are the same thing.
 */
export const EpistemicRelationshipSchema = z.enum([
  'supports',
  'objects-to',
  'rebuts',
  'qualifies',
  'depends-on',
  'concludes',
  'example-of',
  'definition-of',
  'competes-with',
]);
export type EpistemicRelationship = z.infer<typeof EpistemicRelationshipSchema>;

// ─── Create Input ────────────────────────────────────────────────
// z.input: .default() fields must remain optional on the way in.

export const CreateEpistemicClaimInputSchema = EpistemicClaimSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
  deletedAt: true,
});
export type CreateEpistemicClaimInput = z.input<
  typeof CreateEpistemicClaimInputSchema
>;

// ─── Promotion Input ─────────────────────────────────────────────

/**
 * Promote an existing journal block to a formal claim. The block is
 * not modified beyond gaining `epistemicClaimId`.
 */
export const PromoteBlockToClaimInputSchema = z.object({
  blockId: EntityIdSchema,
  /** Defaults to the block's own text when omitted. */
  statement: z.string().min(1).optional(),
  confidence: ConfidenceLevelSchema.optional(),
  status: KnowledgeStatusSchema.optional(),
});
export type PromoteBlockToClaimInput = z.input<
  typeof PromoteBlockToClaimInputSchema
>;
