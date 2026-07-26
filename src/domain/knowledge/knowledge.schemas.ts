/**
 * CNTKNW Domain — Knowledge Entity References
 *
 * Atlas readiness only.
 *
 * This module declares WHICH kinds of historical entity the Atlas
 * will eventually model, and provides a stable way to point at one.
 * It does NOT model any of them. There is no Person schema, no
 * Place schema, no Polity schema. Adding those is a later phase.
 *
 * The purpose is narrow: make sure Connection endpoints, source
 * locations and journal blocks can already refer to an Atlas entity,
 * so that introducing the entities later is additive rather than a
 * breaking change to the connection model. See ADR-0001 §7, §13.
 */
import { z } from 'zod';
import { EntityIdSchema } from '../shared';

// ─── Entity Kind ─────────────────────────────────────────────────

/**
 * The structured objects named in the Atlas SDD §"Knowledge Objects".
 *
 * Closed enum, deliberately. A closed set gives exhaustiveness
 * checking at every switch, and adding a member later is a one-line
 * change with no data migration — existing records simply never
 * carry the new kind.
 *
 * DECLARING A KIND IS NOT MODELLING AN ENTITY. This enum only says
 * "the Atlas will have things of this sort, and here is how to point
 * at one". Whether `conflict` ends up as its own table or as an
 * Event with a subtype is an open question for the Atlas modelling
 * phase, and changing that decision does not require changing this
 * enum.
 *
 * TWO ATLAS SDD OBJECTS ARE DELIBERATELY ABSENT:
 *
 *   Source — already a first-class CNTKNW entity (PDD §22.1) and
 *            already a Reference endpoint (`type: 'source'`).
 *   Claim  — already modelled as EpistemicClaim and already a
 *            Reference endpoint (`type: 'epistemic-claim'`).
 *
 * Adding Atlas-specific copies would fork the source and claim
 * models, which is exactly what the one-claim-model rule forbids.
 * The Atlas gets both for free through the existing endpoints.
 *
 * ROUTES ARE ONE KIND, NOT TWO. The Atlas SDD lists "Trade route"
 * and "Migration route" separately, but they are the same shape — a
 * path with waypoints and a period of use — and splitting them here
 * would force every consumer to handle two kinds that behave
 * identically. Trade versus migration is an attribute of the Route
 * entity when it is modelled, not a reference-level distinction.
 */
export const KnowledgeEntityKindSchema = z.enum([
  'person',
  'place',
  'region',
  'period',
  'event',
  'conflict',
  'organisation',
  'institution',
  'movement',
  'polity',
  'religion',
  'ideology',
  'commodity',
  'route',
]);
export type KnowledgeEntityKind = z.infer<typeof KnowledgeEntityKindSchema>;

// ─── Entity Reference ────────────────────────────────────────────

/**
 * A stable pointer to an Atlas entity.
 *
 * Carrying `kind` alongside `id` lets a connection, a map node or a
 * journal block render a meaningful placeholder for an entity that
 * has not been loaded — or one whose schema does not yet exist.
 */
export const KnowledgeEntityRefSchema = z.object({
  kind: KnowledgeEntityKindSchema,
  id: EntityIdSchema,
  /**
   * Cached display label. Convenience only: the entity record is
   * authoritative once it exists, and this may be stale.
   */
  label: z.string().optional(),
});
export type KnowledgeEntityRef = z.infer<typeof KnowledgeEntityRefSchema>;

// ─── Study Status ────────────────────────────────────────────────

/**
 * How far the user has engaged with something.
 *
 * DISTINCT FROM KnowledgeStatus, and deliberately so. The Atlas SDD
 * §Filtering lists "studied / not studied / needs review / disputed
 * / personal interpretation" under one heading, but those are two
 * different questions:
 *
 *   StudyStatus     have I engaged with this yet?
 *   KnowledgeStatus how settled is the claim itself?
 *
 * A claim can be thoroughly studied and still contested; an
 * unstudied claim is not thereby unsettled. Collapsing the two
 * would repeat, in a different place, the precision-versus-
 * uncertainty conflation that the temporal model exists to avoid.
 *
 * "Disputed" from the SDD list maps to KnowledgeStatus.contested.
 * "Personal interpretation" is expressed by an EpistemicClaim whose
 * originBlockIds point at the user's own journal blocks, not by a
 * status value.
 */
export const StudyStatusSchema = z.enum([
  'not-studied',
  'in-progress',
  'studied',
  'needs-review',
]);
export type StudyStatus = z.infer<typeof StudyStatusSchema>;
