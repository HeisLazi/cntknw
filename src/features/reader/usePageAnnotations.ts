import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import type { Annotation, EntityId } from '@domain/index';

export interface PageAnnotationsState {
  annotations: Annotation[];
  reload: () => Promise<void>;
  error: Error | null;
  loading: boolean;
}

/** Exact-asset, mount-scoped annotation projection data for one PDF page. */
export function usePageAnnotations(
  sourceId: EntityId,
  assetId: EntityId,
  pageNumber: number,
): PageAnnotationsState {
  const { annotations: repository } = useRepositories();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const found = await repository.getBySourceAssetAndPage(
        sourceId,
        assetId,
        pageNumber,
      );
      if (mounted.current && currentGeneration === generation.current) {
        setAnnotations(found);
      }
    } catch (cause) {
      if (mounted.current && currentGeneration === generation.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    } finally {
      if (mounted.current && currentGeneration === generation.current) {
        setLoading(false);
      }
    }
  }, [assetId, pageNumber, repository, sourceId]);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
      generation.current += 1;
    };
  }, [reload]);

  return { annotations, reload, error, loading };
}
