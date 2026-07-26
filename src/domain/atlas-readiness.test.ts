/**
 * Atlas-readiness tests.
 *
 * These verify that the shared primitives will not BLOCK the Atlas
 * later. They deliberately do not test Person, Place, Polity or any
 * other historical entity — none of those are modelled in this
 * phase.
 */
import { describe, it, expect } from 'vitest';
import { createEntityId } from '@lib/id';
import {
  GeoCoordinateSchema,
  GeoGeometryRefSchema,
  SpatialRefSchema,
} from './spatial/spatial.schemas';
import {
  KnowledgeEntityKindSchema,
  KnowledgeEntityRefSchema,
  StudyStatusSchema,
} from './knowledge/knowledge.schemas';
import {
  EpistemicClaimSchema,
  ConfidenceLevelSchema,
  KnowledgeStatusSchema,
  EpistemicRelationshipSchema,
} from './epistemics/epistemics.schemas';
import {
  ReferenceSchema,
  referenceKey,
  referencesMatch,
  isKnownRelationship,
} from './connections/connection.schemas';

const id = createEntityId;
const now = new Date().toISOString();
const baseFields = () => ({
  id: id(),
  createdAt: now,
  updatedAt: now,
  revision: 0,
});

// ─── Spatial ─────────────────────────────────────────────────────

describe('GeoCoordinateSchema', () => {
  it('accepts a valid coordinate and defaults the datum', () => {
    const result = GeoCoordinateSchema.parse({
      latitude: -26.2041,
      longitude: 28.0473,
    });
    expect(result.datum).toBe('wgs84');
  });

  it('rejects out-of-range latitude and longitude', () => {
    expect(
      GeoCoordinateSchema.safeParse({ latitude: 91, longitude: 0 }).success,
    ).toBe(false);
    expect(
      GeoCoordinateSchema.safeParse({ latitude: 0, longitude: 181 }).success,
    ).toBe(false);
  });

  it('carries positional uncertainty for imprecisely located places', () => {
    const result = GeoCoordinateSchema.parse({
      latitude: 12.0,
      longitude: 8.5,
      uncertaintyMetres: 5000,
    });
    expect(result.uncertaintyMetres).toBe(5000);
  });

  it('accepts a non-WGS84 datum for historical georeferencing', () => {
    const result = GeoCoordinateSchema.parse({
      latitude: 51.5,
      longitude: -0.1,
      datum: 'osgb36',
    });
    expect(result.datum).toBe('osgb36');
  });
});

describe('GeoGeometryRefSchema', () => {
  it('references geometry by asset rather than embedding it', () => {
    const result = GeoGeometryRefSchema.parse({
      kind: 'polygon',
      assetId: id(),
      bounds: [-20, -35, 52, 38],
    });
    expect(result.assetId).toBeDefined();
    expect(result.bounds).toHaveLength(4);
  });

  it('supports an external gazetteer identifier', () => {
    const result = GeoGeometryRefSchema.parse({
      kind: 'point',
      externalId: 'pleiades:491741',
    });
    expect(result.externalId).toBe('pleiades:491741');
  });

  it('scopes a historical border to the period it was valid for', () => {
    // Atlas SDD: historical borders must be time-aware.
    const border = GeoGeometryRefSchema.parse({
      kind: 'polygon',
      assetId: id(),
      validFor: { start: { year: 1884 }, end: { year: 1919 } },
      attribution: 'Berlin Conference partition, as mapped in 1885',
    });
    expect(border.validFor?.start?.year).toBe(1884);
    expect(border.validFor?.end?.year).toBe(1919);
    expect(border.attribution).toContain('Berlin');
  });

  it('carries border uncertainty without inventing precision', () => {
    // "Sometime in the 1880s" stays vague rather than being
    // rounded to a date the source never gave.
    const border = GeoGeometryRefSchema.parse({
      kind: 'polygon',
      validFor: {
        start: {
          year: 1885,
          precision: 'decade',
          uncertainty: { kind: 'circa', marginYears: 5 },
        },
        ongoing: false,
        end: { year: 1900, uncertainty: { kind: 'disputed', note: 'Sources differ' } },
      },
    });
    expect(border.validFor?.start?.uncertainty.kind).toBe('circa');
    expect(border.validFor?.end?.uncertainty.kind).toBe('disputed');
  });

  it('leaves stable geography untimed', () => {
    // Absent validFor means "not time-scoped", never "valid for
    // all time". Coastlines genuinely are stable at this scale.
    const coastline = GeoGeometryRefSchema.parse({
      kind: 'line',
      externalId: 'naturalearth:coastline',
    });
    expect(coastline.validFor).toBeUndefined();
  });

  it('supports an ongoing boundary', () => {
    const border = GeoGeometryRefSchema.parse({
      kind: 'polygon',
      validFor: { start: { year: 1994 }, ongoing: true },
    });
    expect(border.validFor?.ongoing).toBe(true);
    expect(border.validFor?.end).toBeUndefined();
  });
});

describe('SpatialRefSchema', () => {
  it('accepts a bare place name with no coordinate', () => {
    // The common historical case: a source names somewhere and
    // gives nothing else. Forcing a coordinate would fabricate
    // precision the source does not support.
    const result = SpatialRefSchema.safeParse({
      type: 'named',
      name: 'Timbuktu',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a named place resolved to an entity', () => {
    const result = SpatialRefSchema.parse({
      type: 'named',
      name: 'Timbuktu',
      placeEntityId: id(),
    });
    expect(result.type).toBe('named');
  });

  it('rejects an empty place name', () => {
    expect(
      SpatialRefSchema.safeParse({ type: 'named', name: '' }).success,
    ).toBe(false);
  });

  it('rejects an unknown reference type', () => {
    expect(
      SpatialRefSchema.safeParse({ type: 'address', value: 'x' }).success,
    ).toBe(false);
  });
});

// ─── Knowledge entity references ─────────────────────────────────

describe('KnowledgeEntityKindSchema', () => {
  it('declares every structured object in the Atlas SDD', () => {
    for (const kind of [
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
    ]) {
      expect(KnowledgeEntityKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it('does not duplicate Source or Claim as Atlas kinds', () => {
    // Both are already first-class CNTKNW entities with their own
    // Reference endpoints. Atlas copies would fork the models.
    expect(KnowledgeEntityKindSchema.safeParse('source').success).toBe(false);
    expect(KnowledgeEntityKindSchema.safeParse('claim').success).toBe(false);
  });

  it('treats routes as one kind, not trade versus migration', () => {
    // Same shape — a path with waypoints and a period of use. The
    // distinction is an entity attribute, not a reference kind.
    expect(KnowledgeEntityKindSchema.safeParse('route').success).toBe(true);
    expect(KnowledgeEntityKindSchema.safeParse('trade-route').success).toBe(false);
    expect(KnowledgeEntityKindSchema.safeParse('migration-route').success)
      .toBe(false);
  });

  it('is closed — unknown kinds are rejected', () => {
    expect(KnowledgeEntityKindSchema.safeParse('spaceship').success).toBe(false);
  });
});

describe('StudyStatusSchema', () => {
  it('declares the engagement states from the Atlas filter list', () => {
    for (const status of [
      'not-studied', 'in-progress', 'studied', 'needs-review',
    ]) {
      expect(StudyStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('is separate from KnowledgeStatus — two different questions', () => {
    // "Have I engaged with this" is not "how settled is this".
    // A claim can be thoroughly studied and still contested.
    expect(StudyStatusSchema.safeParse('contested').success).toBe(false);
    expect(KnowledgeStatusSchema.safeParse('studied').success).toBe(false);
  });

  it('maps the SDD "disputed" filter onto KnowledgeStatus.contested', () => {
    expect(KnowledgeStatusSchema.safeParse('contested').success).toBe(true);
    expect(StudyStatusSchema.safeParse('disputed').success).toBe(false);
  });
});

describe('KnowledgeEntityRefSchema', () => {
  it('points at an entity that is not yet modelled', () => {
    const result = KnowledgeEntityRefSchema.parse({
      kind: 'polity',
      id: id(),
      label: 'Kingdom of Kongo',
    });
    expect(result.kind).toBe('polity');
    expect(result.label).toBe('Kingdom of Kongo');
  });

  it('works without a cached label', () => {
    expect(
      KnowledgeEntityRefSchema.safeParse({ kind: 'person', id: id() }).success,
    ).toBe(true);
  });
});

// ─── Epistemics ──────────────────────────────────────────────────

describe('EpistemicClaimSchema', () => {
  it('applies confidence and status defaults', () => {
    const claim = EpistemicClaimSchema.parse({
      ...baseFields(),
      statement: 'National consciousness is distinct from nationalism.',
    });
    expect(claim.confidence).toBe('moderate');
    expect(claim.status).toBe('open');
    expect(claim.originBlockIds).toEqual([]);
    expect(claim.aboutEntities).toEqual([]);
  });

  it('rejects an empty statement', () => {
    expect(
      EpistemicClaimSchema.safeParse({ ...baseFields(), statement: '' }).success,
    ).toBe(false);
  });

  it('accepts several origin blocks — one claim, many passages', () => {
    const claim = EpistemicClaimSchema.parse({
      ...baseFields(),
      statement: 'Colonial administration depended on extracted labour.',
      originBlockIds: [id(), id(), id()],
    });
    expect(claim.originBlockIds).toHaveLength(3);
  });

  it('carries temporal and spatial context for the Atlas', () => {
    const claim = EpistemicClaimSchema.parse({
      ...baseFields(),
      statement: 'The railway reshaped regional trade.',
      temporalExtent: { start: { year: 1890 }, end: { year: 1910 } },
      spatialRef: { type: 'named', name: 'Southern Africa' },
      aboutEntities: [{ kind: 'route', id: id() }],
    });
    expect(claim.temporalExtent?.start?.year).toBe(1890);
    expect(claim.spatialRef?.type).toBe('named');
    expect(claim.aboutEntities).toHaveLength(1);
  });

  it('groups competing interpretations by thread', () => {
    const thread = 'cause-of-decolonisation-timing';
    const a = EpistemicClaimSchema.parse({
      ...baseFields(),
      statement: 'Economic exhaustion drove the timing.',
      interpretationThread: thread,
    });
    const b = EpistemicClaimSchema.parse({
      ...baseFields(),
      statement: 'Organised resistance drove the timing.',
      interpretationThread: thread,
    });
    expect(a.interpretationThread).toBe(b.interpretationThread);
  });

  it('separates confidence from status', () => {
    // A contested claim may still be held confidently.
    const claim = EpistemicClaimSchema.parse({
      ...baseFields(),
      statement: 'x',
      confidence: 'high',
      status: 'contested',
    });
    expect(claim.confidence).toBe('high');
    expect(claim.status).toBe('contested');
  });

  it('declares the full confidence and status vocabularies', () => {
    for (const level of ['speculative', 'low', 'moderate', 'high', 'near-certain']) {
      expect(ConfidenceLevelSchema.safeParse(level).success).toBe(true);
    }
    for (const status of [
      'open', 'supported', 'contested', 'superseded', 'settled', 'abandoned',
    ]) {
      expect(KnowledgeStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('mirrors the PDD §8.5 argument-map edge semantics', () => {
    for (const rel of [
      'supports', 'objects-to', 'rebuts', 'qualifies',
      'depends-on', 'concludes', 'example-of', 'definition-of',
    ]) {
      expect(EpistemicRelationshipSchema.safeParse(rel).success).toBe(true);
    }
  });
});

// ─── Extended connection endpoints ───────────────────────────────

describe('ReferenceSchema extensions', () => {
  it('still accepts every original v0.2 endpoint', () => {
    for (const type of [
      'source', 'block', 'annotation', 'concept', 'glossary-entry',
    ]) {
      expect(ReferenceSchema.safeParse({ type, id: id() }).success).toBe(true);
    }
  });

  it('accepts a formal claim as an endpoint', () => {
    expect(
      ReferenceSchema.safeParse({ type: 'epistemic-claim', id: id() }).success,
    ).toBe(true);
  });

  it('accepts an Atlas entity as an endpoint', () => {
    const result = ReferenceSchema.safeParse({
      type: 'knowledge-entity',
      ref: { kind: 'place', id: id() },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown endpoint type', () => {
    expect(
      ReferenceSchema.safeParse({ type: 'spreadsheet', id: id() }).success,
    ).toBe(false);
  });

  it('connects an Atlas entity to an original source page', () => {
    // The requirement the Atlas depends on: entities must be able to
    // link back to the passage that produced them.
    const sourceId = id();
    const from = ReferenceSchema.parse({
      type: 'knowledge-entity',
      ref: { kind: 'event', id: id() },
    });
    const to = ReferenceSchema.parse({
      type: 'location',
      location: { sourceType: 'book', sourceId, pdf: { page: 42 } },
    });
    expect(referencesMatch(from, to)).toBe(false);
    expect(referenceKey(to)).toContain('42');
  });
});

describe('referenceKey / referencesMatch', () => {
  it('matches identical id references', () => {
    const shared = id();
    expect(
      referencesMatch(
        ReferenceSchema.parse({ type: 'block', id: shared }),
        ReferenceSchema.parse({ type: 'block', id: shared }),
      ),
    ).toBe(true);
  });

  it('does not match across endpoint types with the same id', () => {
    const shared = id();
    expect(
      referencesMatch(
        ReferenceSchema.parse({ type: 'block', id: shared }),
        ReferenceSchema.parse({ type: 'concept', id: shared }),
      ),
    ).toBe(false);
  });

  it('distinguishes knowledge entities of different kinds', () => {
    const shared = id();
    expect(
      referencesMatch(
        ReferenceSchema.parse({
          type: 'knowledge-entity',
          ref: { kind: 'place', id: shared },
        }),
        ReferenceSchema.parse({
          type: 'knowledge-entity',
          ref: { kind: 'person', id: shared },
        }),
      ),
    ).toBe(false);
  });

  it('matches locations by page', () => {
    const sourceId = id();
    const a = ReferenceSchema.parse({
      type: 'location',
      location: { sourceType: 'book', sourceId, pdf: { page: 5 } },
    });
    const b = ReferenceSchema.parse({
      type: 'location',
      location: { sourceType: 'book', sourceId, pdf: { page: 5 } },
    });
    const c = ReferenceSchema.parse({
      type: 'location',
      location: { sourceType: 'book', sourceId, pdf: { page: 6 } },
    });
    expect(referencesMatch(a, b)).toBe(true);
    expect(referencesMatch(a, c)).toBe(false);
  });
});

describe('isKnownRelationship', () => {
  it('recognises the v0.2 vocabulary', () => {
    expect(isKnownRelationship('same-theme')).toBe(true);
    expect(isKnownRelationship('contradicts')).toBe(true);
  });

  it('recognises the epistemic vocabulary', () => {
    expect(isKnownRelationship('rebuts')).toBe(true);
    expect(isKnownRelationship('competes-with')).toBe(true);
  });

  it('reports a coined relationship as unknown without rejecting it', () => {
    expect(isKnownRelationship('reminds-me-of')).toBe(false);
  });
});
