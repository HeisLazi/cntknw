/**
 * CNTKNW Domain — Source Schemas
 *
 * A Source is the top-level entity for books and artworks.
 * BookDetails and ArtworkDetails attach source-type-specific metadata.
 */
import { z } from 'zod';
import {
  BaseEntityFieldsSchema,
  EntityIdSchema,
  ISODateTimeSchema,
  LegacyMarkerSchema,
  SourceTypeSchema,
} from '../shared';

// NOTE ON READING POSITION
// BookDetails deliberately does NOT carry currentPage or
// currentChapter. WorkspaceState.activeLocation is the single
// canonical reading position (PDD §6.2, WS-001). The v1 prototype
// stored books.currentPage, and a v2 copy of it would be a second
// position that can silently disagree with the first — exactly the
// defect the three-position Read Aloud model must not inherit.
// v1 currentPage maps into WorkspaceState during migration.
// See ADR-0001 §3.

// ─── Source ──────────────────────────────────────────────────────

export const SourceSchema = BaseEntityFieldsSchema.extend({
  type: SourceTypeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  creatorIds: z.array(EntityIdSchema).default([]),
  collectionIds: z.array(EntityIdSchema).default([]),
  tagIds: z.array(EntityIdSchema).default([]),
  archivedAt: ISODateTimeSchema.optional(),
  legacy: LegacyMarkerSchema.optional(),
});
export type Source = z.infer<typeof SourceSchema>;

// ─── Book Details ────────────────────────────────────────────────

export const BookStatusSchema = z.enum([
  'unread',
  'reading',
  'paused',
  'completed',
]);
export type BookStatus = z.infer<typeof BookStatusSchema>;

export const BookDetailsSchema = z.object({
  sourceId: EntityIdSchema,
  authorText: z.string().optional(),
  language: z.string().optional(),
  publicationDate: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  isbn: z.string().optional(),
  subject: z.string().optional(),
  currentStatus: BookStatusSchema.default('unread'),
});
export type BookDetails = z.infer<typeof BookDetailsSchema>;

// ─── Artwork Details ─────────────────────────────────────────────

export const ArtworkDetailsSchema = z.object({
  sourceId: EntityIdSchema,
  artistText: z.string().optional(),
  creationDate: z.string().optional(),
  period: z.string().optional(),
  movement: z.string().optional(),
  medium: z.string().optional(),
  dimensions: z.string().optional(),
  culture: z.string().optional(),
  placeCreated: z.string().optional(),
  currentLocation: z.string().optional(),
});
export type ArtworkDetails = z.infer<typeof ArtworkDetailsSchema>;

// ─── Create Inputs ───────────────────────────────────────────────
// Inputs omit auto-generated fields (id, timestamps, revision).
//
// These use z.input, not z.infer. z.infer yields the OUTPUT type, in
// which every .default() has already been applied and is therefore
// required — the opposite of what a create input means. See ADR-0001 §2.

export const CreateSourceInputSchema = SourceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
});
export type CreateSourceInput = z.input<typeof CreateSourceInputSchema>;

export const CreateBookDetailsInputSchema = BookDetailsSchema.omit({
  sourceId: true,
});
export type CreateBookDetailsInput = z.input<typeof CreateBookDetailsInputSchema>;

export const CreateArtworkDetailsInputSchema = ArtworkDetailsSchema.omit({
  sourceId: true,
});
export type CreateArtworkDetailsInput = z.input<
  typeof CreateArtworkDetailsInputSchema
>;
