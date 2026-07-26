/**
 * CNTKNW Domain — Workspace State Schemas
 *
 * For every source, CNTKNW persists the exact workspace state
 * so reopening restores the previous context (AC-002, WS-001).
 */
import { z } from 'zod';
import {
  BaseEntityFieldsSchema,
  EntityIdSchema,
  SourceLocationSchema,
} from '../shared';

// ─── Source View ─────────────────────────────────────────────────

export const SourceViewModeSchema = z.enum([
  'continuous',
  'single',
  'spread',
  'artwork',
]);
export type SourceViewMode = z.infer<typeof SourceViewModeSchema>;

export const SourceViewSchema = z.object({
  mode: SourceViewModeSchema.default('continuous'),
  zoom: z.number().positive().default(1),
  scrollOffset: z.number().nonnegative().default(0),
});
export type SourceView = z.infer<typeof SourceViewSchema>;

// ─── Journal View ────────────────────────────────────────────────

export const JournalViewSchema = z.object({
  scrollOffset: z.number().nonnegative().default(0),
  activeBlockId: EntityIdSchema.optional(),
});
export type JournalView = z.infer<typeof JournalViewSchema>;

// ─── Layout ──────────────────────────────────────────────────────

/**
 * `listen` is a LAYOUT MODE, not a route.
 *
 * Listen-Only hides the source pane, but it remains the same
 * Study Workspace at the same /study/:sourceId location. Making it
 * a route would create a fourth destination and violate INV-001,
 * IA-001 and RA-INV-001. Leaving `listen` restores the previous
 * layout mode.
 */
export const LayoutModeSchema = z.enum([
  'split',
  'source-focus',
  'journal-focus',
  'compare',
  'listen',
]);
export type LayoutMode = z.infer<typeof LayoutModeSchema>;

export const WorkspaceLayoutSchema = z.object({
  mode: LayoutModeSchema.default('split'),
  splitRatio: z.number().min(0).max(1).default(0.5),
  sourceCollapsed: z.boolean().default(false),
  journalCollapsed: z.boolean().default(false),
  /** Layout to restore when leaving `listen`. */
  previousMode: LayoutModeSchema.optional(),
});
export type WorkspaceLayout = z.infer<typeof WorkspaceLayoutSchema>;

// ─── Open Panel ──────────────────────────────────────────────────

export const OpenPanelSchema = z
  .enum(['dictionary', 'connections', 'search', 'contents'])
  .optional();
export type OpenPanel = z.infer<typeof OpenPanelSchema>;

// ─── Listening State (Read Aloud readiness) ──────────────────────

/**
 * Whether reliable background playback is available.
 *
 * The web build can only make a best effort: browsers may throttle
 * or suspend speech when a tab is hidden, and behaviour differs by
 * engine. A future desktop build can guarantee it. Detected at
 * runtime and persisted so the last known value survives a reload —
 * and so the same record survives the desktop wrap unchanged.
 * See ADR-0001 §8.
 */
export const PlaybackCapabilitySchema = z.enum([
  'unknown',
  'web-best-effort',
  'desktop-reliable',
]);
export type PlaybackCapability = z.infer<typeof PlaybackCapabilitySchema>;

/**
 * Cached audio offset for the current listening position.
 *
 * DISPOSABLE. Audio offsets shift with voice and playback speed, so
 * this must never be the anchor for a note or a bookmark — the
 * sentence-level TextAnchor is authoritative (RA-INV-004). Kept
 * only so playback can resume mid-sentence without recomputation,
 * and safe to discard at any time.
 */
export const PlaybackPositionCacheSchema = z.object({
  offsetSeconds: z.number().nonnegative(),
  voiceId: z.string().optional(),
  rate: z.number().positive().optional(),
  capturedAt: z.string().datetime().optional(),
});
export type PlaybackPositionCache = z.infer<typeof PlaybackPositionCacheSchema>;

// ─── Workspace State ─────────────────────────────────────────────

export const WorkspaceStateSchema = BaseEntityFieldsSchema.extend({
  sourceId: EntityIdSchema,

  /**
   * Canonical visual reading position. The single source of truth
   * for "where the user is reading" — BookDetails deliberately does
   * not duplicate it. See ADR-0001 §3.
   */
  activeLocation: SourceLocationSchema,

  /**
   * Where Read Aloud last spoke. Tracked separately because
   * listening and careful reading diverge, and merging them would
   * silently destroy the user's real reading position (RA-INV-002,
   * RA-021, RA-022).
   */
  listenLocation: SourceLocationSchema.optional(),

  /**
   * Furthest point reached by any means. Monotonic — it only ever
   * advances, so it is never a substitute for either position above.
   */
  furthestLocation: SourceLocationSchema.optional(),

  sourceView: SourceViewSchema.default({}),
  journalView: JournalViewSchema.default({}),
  layout: WorkspaceLayoutSchema.default({}),
  openPanel: OpenPanelSchema,

  /** Playback continues while the workspace is unfocused. */
  awayMode: z.boolean().default(false),
  playbackCapability: PlaybackCapabilitySchema.default('unknown'),
  playbackPositionCache: PlaybackPositionCacheSchema.optional(),
});
export type WorkspaceState = z.infer<typeof WorkspaceStateSchema>;

// ─── Create Input ────────────────────────────────────────────────

export const CreateWorkspaceStateInputSchema = WorkspaceStateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
});
export type CreateWorkspaceStateInput = z.input<
  typeof CreateWorkspaceStateInputSchema
>;

// ─── Resume Choice ───────────────────────────────────────────────

/**
 * When visual and listening positions differ, the user is asked
 * which to resume from (RA-023). When they agree, no prompt is
 * shown (RA-024).
 */
export function positionsDiverge(state: WorkspaceState): boolean {
  const listen = state.listenLocation;
  if (!listen) return false;
  const active = state.activeLocation;
  if (listen.sourceId !== active.sourceId) return true;
  return (listen.pdf?.page ?? null) !== (active.pdf?.page ?? null);
}
