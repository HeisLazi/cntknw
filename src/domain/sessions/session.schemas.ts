/**
 * CNTKNW Domain — Study Session Schemas
 */
import { z } from 'zod';
import {
  EntityIdSchema,
  ISODateTimeSchema,
  RevisionSchema,
  SourceLocationSchema,
} from '../shared';

// ─── Timer Mode ──────────────────────────────────────────────────

export const TimerModeSchema = z.enum([
  'manual',
  'pomodoro-25',
  'deep-50',
  'custom',
  'stopwatch',
]);
export type TimerMode = z.infer<typeof TimerModeSchema>;

// ─── Activity Mode ───────────────────────────────────────────────

/**
 * How the source was studied during this session.
 *
 * Read Aloud readiness. Listening counts as study time — the user
 * was engaging with the source — but it must stay distinguishable
 * from active visual reading, because the two are not equivalent
 * intellectual activities and the statistics should not pretend
 * they are (RA-INV-008, PDD §18.3).
 *
 * `mixed` covers follow-along reading, where the user reads the
 * page while the text is spoken.
 *
 * No playback is implemented in this phase. This field exists so
 * that adding it later requires no migration.
 */
export const ActivityModeSchema = z.enum(['reading', 'listening', 'mixed']);
export type ActivityMode = z.infer<typeof ActivityModeSchema>;

// ─── Study Session ───────────────────────────────────────────────

export const StudySessionSchema = z.object({
  id: EntityIdSchema,
  sourceId: EntityIdSchema,
  mode: TimerModeSchema.default('manual'),
  activityMode: ActivityModeSchema.default('reading'),
  startedAt: ISODateTimeSchema,
  endedAt: ISODateTimeSchema.optional(),
  focusedSeconds: z.number().int().nonnegative().default(0),
  /**
   * Seconds of that focused time spent with audio playing.
   * A subset of focusedSeconds, not an addition to it: a
   * follow-along session is simultaneously read and listened.
   */
  listenedSeconds: z.number().int().nonnegative().default(0),
  breakSeconds: z.number().int().nonnegative().default(0),
  manualPauseSeconds: z.number().int().nonnegative().default(0),
  removedIdleSeconds: z.number().int().nonnegative().default(0),
  startLocation: SourceLocationSchema,
  endLocation: SourceLocationSchema.optional(),
  visitedLocations: z.array(SourceLocationSchema).default([]),
  /**
   * Locations reached by listening only, never visually studied.
   * Supports the "pages only listened to" statistic without
   * inferring it after the fact.
   */
  listenedLocations: z.array(SourceLocationSchema).default([]),
  createdBlockIds: z.array(EntityIdSchema).default([]),
  createdAnnotationIds: z.array(EntityIdSchema).default([]),
  createdConnectionIds: z.array(EntityIdSchema).default([]),
  dictionaryLookupIds: z.array(EntityIdSchema).default([]),
  reflection: z.string().optional(),
  revision: RevisionSchema.default(0),
});
export type StudySession = z.infer<typeof StudySessionSchema>;

// StudySession has no createdAt/updatedAt: startedAt and endedAt
// already describe its lifetime, and a second pair of timestamps
// would be redundant and liable to disagree. Adapters must not add
// them (audit defect A-5).

// ─── Create Input ────────────────────────────────────────────────

export const CreateSessionInputSchema = StudySessionSchema.omit({
  id: true,
  endedAt: true,
  focusedSeconds: true,
  listenedSeconds: true,
  breakSeconds: true,
  manualPauseSeconds: true,
  removedIdleSeconds: true,
  endLocation: true,
  visitedLocations: true,
  listenedLocations: true,
  createdBlockIds: true,
  createdAnnotationIds: true,
  createdConnectionIds: true,
  dictionaryLookupIds: true,
  reflection: true,
  revision: true,
});
export type CreateSessionInput = z.input<typeof CreateSessionInputSchema>;
