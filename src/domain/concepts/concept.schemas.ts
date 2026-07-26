/**
 * CNTKNW Domain — Concept and Glossary Schemas
 */
import { z } from 'zod';
import {
  BaseEntityFieldsSchema,
  EntityIdSchema,
  SourceLocationSchema,
} from '../shared';

// ─── Concept ─────────────────────────────────────────────────────

export const ConceptSchema = BaseEntityFieldsSchema.extend({
  title: z.string().min(1),
  summary: z.string().optional(),
  aliases: z.array(z.string()).default([]),
  parentConceptIds: z.array(EntityIdSchema).default([]),
});
export type Concept = z.infer<typeof ConceptSchema>;

// ─── Glossary Entry ──────────────────────────────────────────────
// Three layers of meaning: dictionary, source, personal.

export const SourceMeaningSchema = z.object({
  sourceId: EntityIdSchema,
  meaning: z.string(),
});
export type SourceMeaning = z.infer<typeof SourceMeaningSchema>;

export const GlossaryEntrySchema = BaseEntityFieldsSchema.extend({
  term: z.string().min(1),
  language: z.string().default('en'),
  dictionaryPackId: EntityIdSchema.optional(),
  dictionarySenseIds: z.array(z.string()).default([]),
  sourceMeanings: z.array(SourceMeaningSchema).default([]),
  personalMeaning: z.string().optional(),
  occurrenceLocations: z.array(SourceLocationSchema).default([]),
  /**
   * Preferred pronunciation, applied to all future readings of this
   * term across every source (RA-013, RA-014). Stored as a plain
   * respelling ("KWAH-meh en-KROO-mah") rather than SSML, because
   * browser speech engines do not reliably support SSML phonemes —
   * it is applied as a substitution in the reading pipeline.
   * Canonical user data; included in backups (RA-015).
   */
  preferredPronunciation: z.string().optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

// ─── Create Inputs ───────────────────────────────────────────────

export const CreateConceptInputSchema = ConceptSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
});
export type CreateConceptInput = z.input<typeof CreateConceptInputSchema>;

export const CreateGlossaryEntryInputSchema = GlossaryEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
});
export type CreateGlossaryEntryInput = z.input<
  typeof CreateGlossaryEntryInputSchema
>;
