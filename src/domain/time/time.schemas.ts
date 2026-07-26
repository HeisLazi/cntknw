/**
 * CNTKNW Domain — Temporal Primitives
 *
 * Atlas readiness only. No Atlas entity is modelled in this phase.
 *
 * Historical time is not a timestamp. This module separates two
 * axes that are routinely conflated and must not be:
 *
 *   PRECISION   how finely the date is expressed
 *               ("the 3rd century" is century-precise)
 *   UNCERTAINTY how much we trust it
 *               ("circa 1200" is year-precise but uncertain)
 *
 * A date can be precise and uncertain (c. 1204), or imprecise and
 * certain (definitely the 14th century). Collapsing them into one
 * field makes the distinction unrecoverable, and re-encoding every
 * Atlas record later is the most expensive mistake available here.
 * See ADR-0001 §6.
 */
import { z } from 'zod';

// ─── Calendar and Era ────────────────────────────────────────────

/**
 * Calendar system the value is expressed in. Stored rather than
 * normalised: converting a Julian date to Gregorian on write loses
 * what the source actually said.
 */
export const CalendarSystemSchema = z.enum([
  'gregorian',
  'julian',
  'islamic',
  'hebrew',
  'chinese',
  'ethiopian',
  'regnal',
  'other',
]);
export type CalendarSystem = z.infer<typeof CalendarSystemSchema>;

/**
 * Era. `ce` and `bce` are the common cases; `bp` (before present)
 * matters for archaeology and deep history.
 */
export const EraSchema = z.enum(['ce', 'bce', 'bp']);
export type Era = z.infer<typeof EraSchema>;

// ─── Precision ───────────────────────────────────────────────────

/**
 * How finely the value is expressed. Ordered coarse to fine so
 * comparisons and display rounding can rely on the ordering.
 */
export const TemporalPrecisionSchema = z.enum([
  'millennium',
  'century',
  'decade',
  'year',
  'month',
  'day',
  'time',
]);
export type TemporalPrecision = z.infer<typeof TemporalPrecisionSchema>;

/** Coarse-to-fine ordering, for comparison and display logic. */
export const TEMPORAL_PRECISION_ORDER: readonly TemporalPrecision[] = [
  'millennium',
  'century',
  'decade',
  'year',
  'month',
  'day',
  'time',
] as const;

export function isFinerPrecision(
  a: TemporalPrecision,
  b: TemporalPrecision,
): boolean {
  return (
    TEMPORAL_PRECISION_ORDER.indexOf(a) > TEMPORAL_PRECISION_ORDER.indexOf(b)
  );
}

// ─── Uncertainty ─────────────────────────────────────────────────

/**
 * Epistemic qualifier on the date itself.
 *
 * exact     the source states it plainly
 * circa     approximate ("c. 1204", "around the turn of the century")
 * inferred  derived from other evidence, not stated
 * disputed  sources disagree; see `note`
 * unknown   recorded as unknown rather than absent
 */
export const TemporalUncertaintyKindSchema = z.enum([
  'exact',
  'circa',
  'inferred',
  'disputed',
  'unknown',
]);
export type TemporalUncertaintyKind = z.infer<
  typeof TemporalUncertaintyKindSchema
>;

export const TemporalUncertaintySchema = z.object({
  kind: TemporalUncertaintyKindSchema.default('exact'),
  /**
   * Symmetric tolerance in years, where the source supports one.
   * "c. 1204 ± 5" → marginYears: 5.
   */
  marginYears: z.number().nonnegative().optional(),
  /** Free-text explanation, required in practice for `disputed`. */
  note: z.string().optional(),
});
export type TemporalUncertainty = z.infer<typeof TemporalUncertaintySchema>;

// ─── Temporal Point ──────────────────────────────────────────────

/**
 * A single point in historical time.
 *
 * `year` is the anchor and is always positive; direction is carried
 * by `era`, not by a negative number. Storing 1200 BCE as -1200
 * invites off-by-one errors around the year zero, which does not
 * exist in the proleptic Gregorian calendar as historians use it.
 */
export const TemporalPointSchema = z.object({
  year: z.number().int().positive(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  era: EraSchema.default('ce'),
  calendar: CalendarSystemSchema.default('gregorian'),
  precision: TemporalPrecisionSchema.default('year'),
  uncertainty: TemporalUncertaintySchema.default({}),
  /**
   * Regnal or dynastic expression as the source gives it, e.g.
   * "3rd year of Darius". Retained verbatim; never parsed.
   */
  regnalExpression: z.string().optional(),
  /** How the source rendered it, for faithful display. */
  displayText: z.string().optional(),
});
export type TemporalPoint = z.infer<typeof TemporalPointSchema>;

// ─── Temporal Extent ─────────────────────────────────────────────

/**
 * A span of historical time. Either end may be absent, which means
 * genuinely open — an ongoing state, or a beginning nobody records.
 * An absent end is not the same as an unknown end: for the latter,
 * supply the point with uncertainty `unknown`.
 */
export const TemporalExtentSchema = z
  .object({
    start: TemporalPointSchema.optional(),
    end: TemporalPointSchema.optional(),
    /**
     * True when the extent is still open at the time of recording
     * (an institution that still exists, a border still in force).
     */
    ongoing: z.boolean().default(false),
    displayText: z.string().optional(),
  })
  .refine(
    (v) => v.start !== undefined || v.end !== undefined || v.ongoing,
    { message: 'A temporal extent needs a start, an end, or ongoing: true' },
  );
export type TemporalExtent = z.infer<typeof TemporalExtentSchema>;

// ─── Comparison Helpers ──────────────────────────────────────────

/**
 * Signed year on a single axis, for ordering only.
 *
 * BCE years become negative and are shifted by one so that 1 BCE
 * sits immediately before 1 CE with no spurious year zero. Do not
 * persist this value — it is a comparison key, not a date.
 */
export function toComparableYear(point: TemporalPoint): number {
  switch (point.era) {
    case 'bce':
      // Written `1 - year` rather than `-(year - 1)`: the latter
      // yields negative zero for 1 BCE, and -0 fails Object.is
      // against 0, which would make ordering assertions and any
      // future Map keying subtly wrong.
      return 1 - point.year;
    case 'bp':
      // Before Present is conventionally anchored at 1950 CE.
      return 1950 - point.year;
    case 'ce':
    default:
      return point.year;
  }
}
