import { useCallback, useEffect, useState } from 'react';

export type AsyncResource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; value: T };

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * Load something asynchronous into a route.
 *
 * Three states, always all three. A hook that only models "value or
 * undefined" pushes every caller into inventing its own loading and
 * error handling, and the error branch is the one that gets skipped.
 *
 * Two details that are easy to get wrong and expensive to debug:
 *
 * **Returning to `loading` happens during render, not in an effect.**
 * Resetting inside the effect would paint one frame of the *previous*
 * source's data under the new URL before the loading state appeared —
 * briefly showing the wrong document. Adjusting state during render
 * when an input changes is React's documented pattern for exactly
 * this, and it also keeps the hook clear of `set-state-in-effect`.
 *
 * **The `current` flag is not optional.** Without it a slow request
 * for source A can resolve after a fast one for source B and
 * overwrite it, leaving the wrong content under the right URL.
 */
export function useAsyncResource<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
): { resource: AsyncResource<T>; reload: () => void } {
  const [resource, setResource] = useState<AsyncResource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // State, not a ref: the previous inputs are read during render, and
  // a ref read during render is exactly the stale-value trap
  // `react-hooks/refs` exists to catch.
  const [previousDeps, setPreviousDeps] = useState(deps);

  if (!sameDeps(previousDeps, deps)) {
    setPreviousDeps(deps);
    setResource({ status: 'loading' });
  }

  const reload = useCallback(() => {
    setResource({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let current = true;

    load()
      .then((value) => {
        if (current) setResource({ status: 'ready', value });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setResource({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    return () => {
      current = false;
    };
    // `load` is excluded deliberately: callers pass an inline
    // closure, so including it would re-run the effect on every
    // render. The dependency array the caller supplies is the
    // contract, and `sameDeps` above keeps the reset in step with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { resource, reload };
}
