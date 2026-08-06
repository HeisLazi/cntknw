import {
  AnnotationKindSchema,
  AnnotationSchema,
  type Annotation,
  type AnnotationAnchor,
  type AnnotationKind,
  type AnnotationPoint,
  type AnnotationRect,
  type TextAnnotationAnchor,
} from '@domain/annotations/annotation.schemas';
import { boundingRectFor } from '@lib/geometry';

type UnknownRecord = Record<string, unknown>;

interface LegacyGeometry {
  normalized: boolean;
  data: UnknownRecord;
  viewportWidth?: number;
  viewportHeight?: number;
}

const ZERO_POINT: AnnotationPoint = { x: 0, y: 0 };
const ZERO_RECT: AnnotationRect = { x: 0, y: 0, width: 0, height: 0 };

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonnegativeInteger(value: unknown): number | undefined {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function legacyGeometry(value: unknown): LegacyGeometry {
  const geometry = record(value) ?? {};
  const viewportWidth = finiteNumber(geometry.viewportWidth);
  const viewportHeight = finiteNumber(geometry.viewportHeight);
  return {
    normalized: geometry.normalized === true,
    data: record(geometry.data) ?? {},
    viewportWidth:
      viewportWidth !== null && viewportWidth > 0 ? viewportWidth : undefined,
    viewportHeight:
      viewportHeight !== null && viewportHeight > 0 ? viewportHeight : undefined,
  };
}

function normalizeX(value: number, geometry: LegacyGeometry): number | null {
  if (geometry.normalized) return clamp(value);
  if (geometry.viewportWidth === undefined) return null;
  return clamp(value / geometry.viewportWidth);
}

function normalizeY(value: number, geometry: LegacyGeometry): number | null {
  if (geometry.normalized) return clamp(value);
  if (geometry.viewportHeight === undefined) return null;
  return clamp(value / geometry.viewportHeight);
}

function pointFrom(value: unknown, geometry: LegacyGeometry): AnnotationPoint | null {
  const candidate = record(value);
  if (!candidate) return null;
  const rawX = finiteNumber(candidate.x);
  const rawY = finiteNumber(candidate.y);
  if (rawX === null || rawY === null) return null;
  const x = normalizeX(rawX, geometry);
  const y = normalizeY(rawY, geometry);
  return x === null || y === null ? null : { x, y };
}

function rectFrom(value: unknown, geometry: LegacyGeometry): AnnotationRect | null {
  const candidate = record(value);
  if (!candidate) return null;
  const rawX = finiteNumber(candidate.x);
  const rawY = finiteNumber(candidate.y);
  const rawWidth = finiteNumber(candidate.width ?? candidate.w);
  const rawHeight = finiteNumber(candidate.height ?? candidate.h);
  if (
    rawX === null ||
    rawY === null ||
    rawWidth === null ||
    rawHeight === null ||
    rawWidth < 0 ||
    rawHeight < 0
  ) {
    return null;
  }
  const x = normalizeX(rawX, geometry);
  const y = normalizeY(rawY, geometry);
  const width = normalizeX(rawWidth, geometry);
  const height = normalizeY(rawHeight, geometry);
  if (x === null || y === null || width === null || height === null) return null;
  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
  };
}

function rectCandidates(geometry: LegacyGeometry): AnnotationRect[] {
  const rawRects = Array.isArray(geometry.data.rects)
    ? geometry.data.rects
    : [];
  const convertedLines = rawRects
    .map((candidate) => rectFrom(candidate, geometry))
    .filter((candidate): candidate is AnnotationRect => candidate !== null);
  const converted =
    convertedLines.length > 0
      ? convertedLines
      : [geometry.data.boundingRect, geometry.data.rect, geometry.data]
          .map((candidate) => rectFrom(candidate, geometry))
          .filter((candidate): candidate is AnnotationRect => candidate !== null);
  return converted.filter(
    (candidate, index) =>
      converted.findIndex(
        (other) =>
          other.x === candidate.x &&
          other.y === candidate.y &&
          other.width === candidate.width &&
          other.height === candidate.height,
      ) === index,
  );
}

function textContext(value: unknown): Omit<TextAnnotationAnchor, 'kind' | 'rects' | 'boundingRect'> {
  const anchor = record(value) ?? {};
  const startOffset = nonnegativeInteger(anchor.startOffset);
  const candidateEndOffset = nonnegativeInteger(anchor.endOffset);
  const endOffset =
    startOffset === undefined ||
    candidateEndOffset === undefined ||
    startOffset <= candidateEndOffset
      ? candidateEndOffset
      : undefined;
  const prefix = optionalString(anchor.prefix);
  const suffix = optionalString(anchor.suffix);
  return {
    quote: optionalString(anchor.quote) ?? '',
    ...(startOffset !== undefined ? { startOffset } : {}),
    ...(endOffset !== undefined ? { endOffset } : {}),
    ...(prefix !== undefined ? { prefix } : {}),
    ...(suffix !== undefined ? { suffix } : {}),
  };
}

function textAnchor(
  geometry: LegacyGeometry,
  oldTextAnchor: unknown,
): { anchor: AnnotationAnchor; converted: boolean } {
  const rects = rectCandidates(geometry);
  const selected = rects.length > 0 ? rects : [ZERO_RECT];
  return {
    anchor: {
      kind: 'text',
      ...textContext(oldTextAnchor),
      rects: selected,
      boundingRect: boundingRectFor(selected),
    },
    converted: rects.length > 0,
  };
}

function areaAnchor(geometry: LegacyGeometry) {
  const rects = rectCandidates(geometry);
  const rect = rects.length > 0 ? boundingRectFor(rects) : undefined;
  return {
    anchor: { kind: 'area', rect: rect ?? ZERO_RECT } satisfies AnnotationAnchor,
    converted: rects.length > 0,
  };
}

function pointAnchor(geometry: LegacyGeometry) {
  const direct = pointFrom(geometry.data.point, geometry);
  const area = rectCandidates(geometry)[0];
  const point =
    direct ??
    (area
      ? { x: area.x + area.width / 2, y: area.y + area.height / 2 }
      : undefined);
  return {
    anchor: { kind: 'point', point: point ?? ZERO_POINT } satisfies AnnotationAnchor,
    converted: direct !== null,
  };
}

function pointsFrom(value: unknown, geometry: LegacyGeometry): AnnotationPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((candidate) => pointFrom(candidate, geometry))
    .filter((candidate): candidate is AnnotationPoint => candidate !== null);
}

function inkAnchor(geometry: LegacyGeometry) {
  const rawStrokes = Array.isArray(geometry.data.strokes)
    ? geometry.data.strokes
    : [];
  const strokes = rawStrokes
    .map((candidate) => pointsFrom(record(candidate)?.points, geometry))
    .filter((points) => points.length > 0)
    .map((points) => ({ points }));
  const directPoints = pointsFrom(geometry.data.points, geometry);
  if (strokes.length === 0 && directPoints.length > 0) {
    strokes.push({ points: directPoints });
  }
  return {
    anchor: {
      kind: 'ink',
      strokes: strokes.length > 0 ? strokes : [{ points: [ZERO_POINT] }],
    } satisfies AnnotationAnchor,
    converted: strokes.length > 0,
  };
}

function anchorFor(
  kind: AnnotationKind,
  geometry: LegacyGeometry,
  oldTextAnchor: unknown,
): { anchor: AnnotationAnchor; converted: boolean } {
  switch (kind) {
    case 'highlight':
    case 'underline':
    case 'strike':
      return textAnchor(geometry, oldTextAnchor);
    case 'pen':
    case 'arrow':
      return inkAnchor(geometry);
    case 'rect':
    case 'ellipse':
    case 'text':
    case 'region':
      return areaAnchor(geometry);
    case 'bookmark':
      return pointAnchor(geometry);
  }
}

/** Convert one schema-v1 opaque annotation without dropping its identity. */
export function migrateAnnotationV1ToV2(value: unknown): Annotation {
  const raw = record(value);
  if (!raw) throw new TypeError('Legacy annotation must be an object');
  const kind = AnnotationKindSchema.parse(raw.kind);
  const converted = anchorFor(kind, legacyGeometry(raw.geometry), raw.textAnchor);
  const { geometry: _geometry, textAnchor: _textAnchor, ...unchanged } = raw;
  return AnnotationSchema.parse({
    ...unchanged,
    kind,
    anchor: converted.anchor,
    legacyMigration: {
      fromSchemaVersion: 1,
      geometryStatus: converted.converted ? 'converted' : 'fallback',
    },
  });
}
