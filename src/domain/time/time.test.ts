/**
 * Temporal primitive tests.
 *
 * The point of this module is that precision and uncertainty are
 * independent axes. Most of these cases exist to prove that a date
 * can be precise-but-doubtful or vague-but-certain, because
 * collapsing the two is the mistake that would be expensive to
 * unwind later.
 */
import { describe, it, expect } from 'vitest';
import {
  TemporalPointSchema,
  TemporalExtentSchema,
  TemporalPrecisionSchema,
  TemporalUncertaintySchema,
  CalendarSystemSchema,
  EraSchema,
  isFinerPrecision,
  toComparableYear,
  TEMPORAL_PRECISION_ORDER,
} from './time.schemas';

describe('TemporalPrecisionSchema', () => {
  it('accepts every declared precision', () => {
    for (const precision of TEMPORAL_PRECISION_ORDER) {
      expect(TemporalPrecisionSchema.safeParse(precision).success).toBe(true);
    }
  });

  it('rejects an undeclared precision', () => {
    expect(TemporalPrecisionSchema.safeParse('fortnight').success).toBe(false);
  });

  it('orders precision coarse to fine', () => {
    expect(isFinerPrecision('day', 'century')).toBe(true);
    expect(isFinerPrecision('century', 'day')).toBe(false);
    expect(isFinerPrecision('year', 'year')).toBe(false);
  });
});

describe('TemporalUncertaintySchema', () => {
  it('defaults to exact', () => {
    const result = TemporalUncertaintySchema.parse({});
    expect(result.kind).toBe('exact');
  });

  it('accepts a margin in years', () => {
    const result = TemporalUncertaintySchema.parse({
      kind: 'circa',
      marginYears: 5,
    });
    expect(result.marginYears).toBe(5);
  });

  it('rejects a negative margin', () => {
    expect(
      TemporalUncertaintySchema.safeParse({ kind: 'circa', marginYears: -1 })
        .success,
    ).toBe(false);
  });

  it('carries a note for disputed dates', () => {
    const result = TemporalUncertaintySchema.parse({
      kind: 'disputed',
      note: 'Fanon gives 1954; other accounts say 1955.',
    });
    expect(result.note).toContain('1954');
  });
});

describe('TemporalPointSchema', () => {
  it('applies era, calendar and precision defaults', () => {
    const point = TemporalPointSchema.parse({ year: 1961 });
    expect(point.era).toBe('ce');
    expect(point.calendar).toBe('gregorian');
    expect(point.precision).toBe('year');
    expect(point.uncertainty.kind).toBe('exact');
  });

  it('rejects a non-positive year — direction is carried by era', () => {
    expect(TemporalPointSchema.safeParse({ year: 0 }).success).toBe(false);
    expect(TemporalPointSchema.safeParse({ year: -400 }).success).toBe(false);
  });

  it('expresses BCE through era, not a negative year', () => {
    const point = TemporalPointSchema.parse({ year: 399, era: 'bce' });
    expect(point.year).toBe(399);
    expect(point.era).toBe('bce');
  });

  // The two axes are independent — this is the whole design.
  it('represents a precise but uncertain date', () => {
    const point = TemporalPointSchema.parse({
      year: 1204,
      precision: 'year',
      uncertainty: { kind: 'circa', marginYears: 3 },
    });
    expect(point.precision).toBe('year');
    expect(point.uncertainty.kind).toBe('circa');
  });

  it('represents an imprecise but certain date', () => {
    const point = TemporalPointSchema.parse({
      year: 1300,
      precision: 'century',
      uncertainty: { kind: 'exact' },
    });
    expect(point.precision).toBe('century');
    expect(point.uncertainty.kind).toBe('exact');
  });

  it('retains a regnal expression verbatim', () => {
    const point = TemporalPointSchema.parse({
      year: 519,
      era: 'bce',
      calendar: 'regnal',
      regnalExpression: '3rd year of Darius',
    });
    expect(point.regnalExpression).toBe('3rd year of Darius');
  });

  it('rejects an impossible month or day', () => {
    expect(TemporalPointSchema.safeParse({ year: 1961, month: 13 }).success)
      .toBe(false);
    expect(TemporalPointSchema.safeParse({ year: 1961, day: 32 }).success)
      .toBe(false);
  });

  it('accepts non-Gregorian calendars', () => {
    for (const calendar of ['julian', 'islamic', 'hebrew', 'ethiopian']) {
      expect(CalendarSystemSchema.safeParse(calendar).success).toBe(true);
    }
  });

  it('accepts before-present as an era', () => {
    expect(EraSchema.safeParse('bp').success).toBe(true);
  });
});

describe('toComparableYear', () => {
  it('leaves CE years positive', () => {
    expect(toComparableYear(TemporalPointSchema.parse({ year: 1961 }))).toBe(
      1961,
    );
  });

  it('places 1 BCE immediately before 1 CE with no year zero', () => {
    const oneBce = toComparableYear(
      TemporalPointSchema.parse({ year: 1, era: 'bce' }),
    );
    const oneCe = toComparableYear(TemporalPointSchema.parse({ year: 1 }));
    expect(oneBce).toBe(0);
    expect(oneCe).toBe(1);
    expect(oneCe - oneBce).toBe(1);
  });

  it('orders BCE years correctly among themselves', () => {
    const earlier = toComparableYear(
      TemporalPointSchema.parse({ year: 500, era: 'bce' }),
    );
    const later = toComparableYear(
      TemporalPointSchema.parse({ year: 100, era: 'bce' }),
    );
    expect(earlier).toBeLessThan(later);
  });

  it('anchors before-present at 1950 CE', () => {
    expect(
      toComparableYear(TemporalPointSchema.parse({ year: 1000, era: 'bp' })),
    ).toBe(950);
  });
});

describe('TemporalExtentSchema', () => {
  it('accepts a closed range', () => {
    const result = TemporalExtentSchema.safeParse({
      start: { year: 1954 },
      end: { year: 1962 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an open start', () => {
    expect(
      TemporalExtentSchema.safeParse({ end: { year: 1962 } }).success,
    ).toBe(true);
  });

  it('accepts an ongoing extent with no end', () => {
    const result = TemporalExtentSchema.safeParse({
      start: { year: 1948 },
      ongoing: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a wholly empty extent', () => {
    expect(TemporalExtentSchema.safeParse({}).success).toBe(false);
  });

  it('distinguishes an absent end from an unknown one', () => {
    const unknownEnd = TemporalExtentSchema.parse({
      start: { year: 1200 },
      end: { year: 1300, uncertainty: { kind: 'unknown' } },
    });
    expect(unknownEnd.end?.uncertainty.kind).toBe('unknown');

    const openEnd = TemporalExtentSchema.parse({
      start: { year: 1200 },
      ongoing: true,
    });
    expect(openEnd.end).toBeUndefined();
  });

  it('supports a fuzzy range at both ends', () => {
    const result = TemporalExtentSchema.parse({
      start: { year: 1200, uncertainty: { kind: 'circa', marginYears: 25 } },
      end: { year: 1250, uncertainty: { kind: 'circa', marginYears: 25 } },
      displayText: 'c. 1200–1250',
    });
    expect(result.displayText).toBe('c. 1200–1250');
    expect(result.start?.uncertainty.marginYears).toBe(25);
  });
});
