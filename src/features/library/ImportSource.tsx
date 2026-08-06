import { useCallback, useRef, useState } from 'react';
import { Button } from '@components/primitives';
import { useToast } from '@components/primitives';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { importPdf, UnsupportedFileError } from '@application/import-pdf';
import { isStorageError } from '@data/errors';
import '@features/reader/reader.css';

export interface ImportSourceProps {
  /** Called after a successful import, so the library can refresh. */
  onImported: (sourceId: string) => void;
}

/**
 * Bring a PDF into the library. AC-001.
 *
 * Two routes in, because neither alone is sufficient: a file picker,
 * which is the only option a keyboard user has, and a drop zone,
 * which is what everyone else reaches for first. The drop zone is
 * not a button — it is a labelled region with a real button inside
 * it, so it is never the only way to do this.
 *
 * The page count and title are read from the PDF **before** the
 * import transaction opens. Reading them inside would put a parse of
 * an arbitrary user file inside a write transaction, where a slow or
 * malformed document would hold the transaction open.
 */
export function ImportSource({ onImported }: ImportSourceProps) {
  const repositories = useRepositories();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        // Read metadata first, outside the transaction. A file that
        // is not a PDF fails here with a clear message; importPdf
        // checks the signature again, because a use case may not
        // assume its caller validated anything.
        let pageCount: number | undefined;
        let title: string | undefined;
        let author: string | undefined;
        let bytes: ArrayBuffer | undefined;
        try {
          // Imported here rather than at module scope: pdf.js is
          // roughly half the application's byte weight, and the
          // Library route would otherwise pay for it on first paint
          // whether or not anyone imports anything.
          const { loadPdfDocument } = await import('@features/reader/pdfjs');
          bytes = await file.arrayBuffer();
          const document = await loadPdfDocument(bytes);
          pageCount = document.pageCount;
          title = document.title;
          author = document.author;
          await document.destroy();
        } catch {
          // A PDF that pdf.js cannot parse may still be worth
          // storing — the bytes are the user's. Import proceeds
          // without metadata rather than refusing the file.
          pageCount = undefined;
        }

        const result = await importPdf(repositories, {
          file,
          bytes,
          metadata: { title, author, pageCount },
        });

        show(`${result.source.title} added to your library`, 'success');
        onImported(result.source.id);
      } catch (cause) {
        const message =
          cause instanceof UnsupportedFileError
            ? cause.message
            : isStorageError(cause)
              ? cause.userMessage
              : cause instanceof Error
                ? cause.message
                : String(cause);
        setError(message);
        show('That file could not be imported', 'danger');
      } finally {
        setBusy(false);
        // Clear the input so re-selecting the same file fires change.
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [repositories, show, onImported],
  );

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) void handleFile(file);
  };

  return (
    <div className="cn-import">
      <div
        className="cn-import__drop"
        data-dragging={dragging}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label="Import a PDF"
      >
        <p>{dragging ? 'Release to import' : 'Drop a PDF here'}</p>
        <Button
          variant="primary"
          loading={busy}
          loadingLabel="Importing…"
          onClick={() => inputRef.current?.click()}
        >
          Choose a PDF
        </Button>
        <p className="cn-import__hint">
          Everything stays on this device. Nothing is uploaded.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="cn-visually-hidden"
          // Labelled by the button that opens it; the input itself is
          // never the thing a user tabs to.
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.item(0);
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error ? (
        <p className="cn-import__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
