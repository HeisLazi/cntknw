import type { Annotation } from '@domain/index';

export interface LegacyGeometryPartition {
  positioned: Annotation[];
  fallback: Annotation[];
}

export function isLegacyFallback(annotation: Annotation): boolean {
  return annotation.legacyMigration?.geometryStatus === 'fallback';
}

export function splitAnnotationsByLegacyGeometry(
  annotations: readonly Annotation[],
): LegacyGeometryPartition {
  const positioned: Annotation[] = [];
  const fallback: Annotation[] = [];

  for (const annotation of annotations) {
    (isLegacyFallback(annotation) ? fallback : positioned).push(annotation);
  }

  return { positioned, fallback };
}
