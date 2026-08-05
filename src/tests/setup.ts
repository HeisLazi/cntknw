import '@testing-library/jest-dom';

// Node 22 can expose an incomplete experimental localStorage global when
// Vitest starts without --localstorage-file. Keep tests deterministic without
// changing the browser-facing storage code.
if (typeof globalThis.localStorage === 'undefined') {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    } satisfies Storage,
  });
}

/**
 * jsdom does not implement `Blob.prototype.arrayBuffer`, which
 * `File` inherits. Real browsers have had it since 2019, so
 * production code is right to use it — this fills the gap in the
 * test environment rather than distorting the source to suit a
 * shortcoming of the runner.
 *
 * Remove once jsdom implements it natively.
 */
if (
  typeof Blob !== 'undefined' &&
  typeof Blob.prototype.arrayBuffer !== 'function'
) {
  Blob.prototype.arrayBuffer = function arrayBuffer(
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
