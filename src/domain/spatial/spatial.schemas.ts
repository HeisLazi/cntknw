/**
 * CNTKNW Domain — Spatial Primitives
 *
 * Atlas readiness only. No Place, Region, Polity or boundary entity
 * is modelled in this phase.
 *
 * Distinct from the normalised page/image geometry in shared.ts:
 * those coordinates describe positions on a document, these
 * describe positions on the Earth.
 */
import { z } from 'zod';
import { EntityIdSchema } from '../shared';
import { TemporalExtentSchema } from '../time/time.schemas';

// ─── Geodetic Datum ──────────────────────────────────────────────

/**
 * Reference frame the coordinate is expressed in. WGS 84 is the
 * default and covers modern data; historical maps are frequently
 * georeferenced against something else, and silently assuming
 * WGS 84 introduces errors of hundreds of metres.
 */
export const GeodeticDatumSchema = z.enum(['wgs84', 'etrs89', 'nad83', 'osgb36', 'other']);
export type GeodeticDatum = z.infer<typeof GeodeticDatumSchema>;

// ─── Coordinate ──────────────────────────────────────────────────

export const GeoCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Metres above the datum's reference surface. */
  elevationMetres: z.number().optional(),
  datum: GeodeticDatumSchema.default('wgs84'),
  /**
   * Radius of positional uncertainty in metres. A settlement known
   * only to "somewhere in this valley" is a real and common case.
   */
  uncertaintyMetres: z.number().nonnegative().optional(),
});
export type GeoCoordinate = z.infer<typeof GeoCoordinateSchema>;

// ─── Geometry Reference ──────────────────────────────────────────

export const GeoGeometryKindSchema = z.enum([
  'point',
  'line',
  'polygon',
  'multi-polygon',
  'collection',
]);
export type GeoGeometryKind = z.infer<typeof GeoGeometryKindSchema>;

/**
 * An opaque, typed pointer to geometry held elsewhere.
 *
 * Coastlines and historical borders are far too large to embed in a
 * domain record, and PDD §19.1 requires binary/bulk data to live
 * apart from domain records. The geometry payload will be an Asset;
 * this is only the reference to it.
 */
export const GeoGeometryRefSchema = z.object({
  kind: GeoGeometryKindSchema,
  /** Asset holding the geometry payload (GeoJSON or similar). */
  assetId: EntityIdSchema.optional(),
  /** Identifier within an external gazetteer, e.g. a Pleiades or GeoNames ID. */
  externalId: z.string().optional(),
  /** Bounding box [west, south, east, north] for cheap culling. */
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),

  /**
   * The period this geometry was valid for.
   *
   * Atlas SDD: "Historical borders must be time-aware and must not
   * pretend certainty." A border is not a fact about a place, it is
   * a fact about a place during an interval — and usually a
   * contested one. A geometry without a temporal extent silently
   * asserts that the shape is timeless, which for any historical
   * boundary is false.
   *
   * Optional because modern coastlines and physical geography
   * genuinely are stable at the scale this system cares about.
   * Absent means "not time-scoped", never "valid for all time".
   *
   * Uncertainty rides on the TemporalExtent's own points, so a
   * border known only to "sometime in the 1880s" expresses that
   * without inventing precision.
   */
  validFor: TemporalExtentSchema.optional(),

  /**
   * Where this geometry came from — a treaty map, an atlas plate, a
   * modern reconstruction. Historical boundaries are interpretive,
   * and two sources will disagree. Free text; the authoritative
   * link is a Connection to the Source or EpistemicClaim.
   */
  attribution: z.string().optional(),
});
export type GeoGeometryRef = z.infer<typeof GeoGeometryRefSchema>;

// ─── Spatial Reference ───────────────────────────────────────────

/**
 * How a record points at somewhere on Earth.
 *
 * `named` is deliberately first-class: most historical sources give
 * a name and nothing else, and forcing a coordinate would fabricate
 * precision the source does not support.
 */
export const SpatialRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('coordinate'), coordinate: GeoCoordinateSchema }),
  z.object({ type: z.literal('geometry'), geometry: GeoGeometryRefSchema }),
  z.object({
    type: z.literal('named'),
    /** Place name exactly as the source gives it. */
    name: z.string().min(1),
    /** Resolved knowledge entity, once one exists. Absent is normal. */
    placeEntityId: EntityIdSchema.optional(),
  }),
]);
export type SpatialRef = z.infer<typeof SpatialRefSchema>;
