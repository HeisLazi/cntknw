import { z } from 'zod';
import { ISODateTimeSchema, RevisionSchema } from '../shared';

export const PomodoroModeSchema = z.enum([
  'focus',
  'short-break',
  'long-break',
]);

export const PomodoroStatusSchema = z.enum([
  'idle',
  'running',
  'paused',
  'completed',
]);

export const PomodoroDurationsSchema = z.object({
  focus: z.number().int().min(1).max(180),
  shortBreak: z.number().int().min(1).max(60),
  longBreak: z.number().int().min(1).max(120),
}).strict();

const PomodoroTimerStateFields = {
  mode: PomodoroModeSchema,
  status: PomodoroStatusSchema,
  durations: PomodoroDurationsSchema,
  remainingSeconds: z.number().int().nonnegative(),
  deadlineAt: z.number().int().positive().nullable(),
} as const;

function validateDeadline(
  timer: { status: z.infer<typeof PomodoroStatusSchema>; deadlineAt: number | null },
  context: z.RefinementCtx,
) {
  if (timer.status === 'running' && timer.deadlineAt === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['deadlineAt'],
      message: 'A running timer requires a wall-clock deadline.',
    });
  }
  if (timer.status !== 'running' && timer.deadlineAt !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['deadlineAt'],
      message: 'Only a running timer may carry a wall-clock deadline.',
    });
  }
}

export const PomodoroTimerStateSchema = z.object(PomodoroTimerStateFields)
  .strict()
  .superRefine(validateDeadline);

export const PomodoroTimerRecordSchema = z.object({
  ...PomodoroTimerStateFields,
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  revision: RevisionSchema,
}).strict().superRefine(validateDeadline);

export type PomodoroMode = z.infer<typeof PomodoroModeSchema>;
export type PomodoroStatus = z.infer<typeof PomodoroStatusSchema>;
export type PomodoroDurations = z.infer<typeof PomodoroDurationsSchema>;
export type PomodoroTimerState = z.infer<typeof PomodoroTimerStateSchema>;
export type PomodoroTimerRecord = z.infer<typeof PomodoroTimerRecordSchema>;
