/**
 * CNTKNW Domain — Connection Schemas
 *
 * Connections are explicit, typed relationships between any two
 * domain endpoints. Every connection produces a backlink —
 * backlinks are queried from Connection records, not stored
 * as separate mutable arrays.
 */
import { z } from 'zod';
import {
  BaseEntityFieldsSchema,
  EntityIdSchema,
  SourceLocationSchema,
} from '../shared';
import { KnowledgeEntityRefSchema } from '../knowledge/knowledge.schemas';
import { EpistemicRelationshipSchema } from '../epistemics/epistemics.schemas';

// ─── Reference (Connection Endpoint) ─────────────────────────────
//
// The extension point for everything that comes later. Adding an
// endpoint kind here is what allows the Atlas and formal claims to
// participate in the existing connection and backlink machinery
// without altering Connection itself. See ADR-0001 §7.

export const ReferenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('source'), id: EntityIdSchema }),
  z.object({ type: z.literal('location'), location: SourceLocationSchema }),
  z.object({ type: z.literal('block'), id: EntityIdSchema }),
  z.object({ type: z.literal('annotation'), id: EntityIdSchema }),
  z.object({ type: z.literal('concept'), id: EntityIdSchema }),
  z.object({ type: z.literal('glossary-entry'), id: EntityIdSchema }),
  /** Formal claim. Shared by journal, argument maps and the Atlas. */
  z.object({ type: z.literal('epistemic-claim'), id: EntityIdSchema }),
  /**
   * Atlas entity. Carries `kind` so an endpoint can be rendered
   * before — or without — the entity schema existing.
   */
  z.object({
    type: z.literal('knowledge-entity'),
    ref: KnowledgeEntityRefSchema,
  }),
]);
export type Reference = z.infer<typeof ReferenceSchema>;

/** Endpoint kinds that carry a plain `id`. Useful for narrowing. */
export type IdReference = Extract<Reference, { id: string }>;

/**
 * Stable comparison key for a reference. Adapters use this instead
 * of casting to `any` to reach an `id` (audit defect A-7).
 */
export function referenceKey(ref: Reference): string {
  switch (ref.type) {
    case 'location':
      return `location:${ref.location.sourceId}:${ref.location.pdf?.page ?? ''}:${
        ref.location.artwork?.region
          ? JSON.stringify(ref.location.artwork.region)
          : ''
      }`;
    case 'knowledge-entity':
      return `knowledge-entity:${ref.ref.kind}:${ref.ref.id}`;
    default:
      return `${ref.type}:${ref.id}`;
  }
}

export function referencesMatch(a: Reference, b: Reference): boolean {
  return referenceKey(a) === referenceKey(b);
}

// ─── Relationship Types ──────────────────────────────────────────

/** The v0.2 §14.2 vocabulary for source-to-source relationships. */
export const RelationshipTypeSchema = z.enum([
  'same-theme',
  'supports',
  'contradicts',
  'develops',
  'resolves',
  'example-of',
  'influenced-by',
  'question-answered-by',
  'visually-represents',
  'comparison-with',
  'custom',
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

/**
 * The full relationship vocabulary: the v0.2 set plus the
 * argument-map/epistemic set from PDD §8.5. Free strings remain
 * permitted so the user can coin their own — PDD §14.2 lists
 * `custom` explicitly — but the known values are enumerated so the
 * UI can offer them and so `RelationshipTypeSchema` is no longer
 * decorative (audit defect A-11).
 */
export const KnownRelationshipSchema = z.union([
  RelationshipTypeSchema,
  EpistemicRelationshipSchema,
]);
export type KnownRelationship = z.infer<typeof KnownRelationshipSchema>;

export function isKnownRelationship(value: string): value is KnownRelationship {
  return KnownRelationshipSchema.safeParse(value).success;
}

// ─── Connection Direction ────────────────────────────────────────

export const ConnectionDirectionSchema = z.enum(['directed', 'undirected']);
export type ConnectionDirection = z.infer<typeof ConnectionDirectionSchema>;

// ─── Connection ──────────────────────────────────────────────────

export const ConnectionSchema = BaseEntityFieldsSchema.extend({
  from: ReferenceSchema,
  to: ReferenceSchema,
  /**
   * Free string by design (PDD §14.2 permits `custom`), but should
   * be a KnownRelationship wherever possible. Use
   * isKnownRelationship() to distinguish.
   */
  relationship: z.string().min(1),
  direction: ConnectionDirectionSchema.default('directed'),
  note: z.string().optional(),
});
export type Connection = z.infer<typeof ConnectionSchema>;

// ─── Create Input ────────────────────────────────────────────────

export const CreateConnectionInputSchema = ConnectionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
});
export type CreateConnectionInput = z.input<typeof CreateConnectionInputSchema>;
