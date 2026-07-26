import '@testing-library/jest-dom';

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
