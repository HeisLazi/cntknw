import type { SourceRepository } from '@data/repositories/SourceRepository';
import type { AssetRepository } from '@data/repositories/AssetRepository';
import type { JournalRepository } from '@data/repositories/JournalRepository';
import type { WorkspaceStateRepository } from '@data/repositories/WorkspaceStateRepository';
import type { UnitOfWork } from '@data/repositories/UnitOfWork';
import type { Source, Asset, Journal, WorkspaceState } from '@domain/index';
import { createEntityId } from '@lib/id';

export interface ImportPdfDeps {
  sources: SourceRepository;
  assets: AssetRepository;
  journals: JournalRepository;
  workspaceStates: WorkspaceStateRepository;
  unitOfWork: UnitOfWork;
}

export interface ImportPdfInput {
  file: File;
  /** Bytes already read by a caller that needs to inspect the PDF first. */
  bytes?: ArrayBuffer;
  metadata?: {
    title?: string;
    author?: string;
    pageCount?: number;
    subject?: string;
  };
}

export interface ImportPdfResult {
  source: Source;
  asset: Asset;
  journal: Journal;
  workspaceState: WorkspaceState;
}

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileError';
  }
}

const PDF_MAGIC = '%PDF-';

/**
 * Verify the file really is a PDF rather than trusting its
 * extension or reported MIME type. Handoff §11.1 requires
 * validating the signature before anything is written.
 */
async function assertPdfSignature(file: File, suppliedBytes?: ArrayBuffer): Promise<ArrayBuffer> {
  const buffer = suppliedBytes ?? (await file.arrayBuffer());
  const head = new Uint8Array(buffer.slice(0, PDF_MAGIC.length));
  const magic = String.fromCharCode(...head);
  if (magic !== PDF_MAGIC) {
    throw new UnsupportedFileError(
      `${file.name} is not a PDF (expected "${PDF_MAGIC}" signature)`,
    );
  }
  return buffer;
}

export async function importPdf(
  deps: ImportPdfDeps,
  input: ImportPdfInput,
): Promise<ImportPdfResult> {
  // Validate before writing anything.
  const buffer = await assertPdfSignature(input.file, input.bytes);
  const title = input.metadata?.title || cleanFilename(input.file.name);

  // Every write happens inside one transaction. A failure part-way
  // through must not leave an asset without a source, or a source
  // without a journal (handoff §10, §11.1).
  return deps.unitOfWork.run(async () => {
    // storageKey is decided up front so the asset record is never
    // written with a placeholder that a later step has to patch.
    const storageKey = `asset/${createEntityId()}`;

    const asset = await deps.assets.create({
      kind: 'pdf',
      mimeType: 'application/pdf',
      originalName: input.file.name,
      sizeBytes: input.file.size,
      storageKey,
    });

    await deps.assets.storeBinary(asset.id, buffer);

    const source = await deps.sources.create({
      type: 'book',
      title,
    });

    await deps.sources.upsertBookDetails(source.id, {
      authorText: input.metadata?.author,
      pageCount: input.metadata?.pageCount,
      subject: input.metadata?.subject,
      currentStatus: 'unread',
    });

    await deps.assets.linkToSource(source.id, asset.id, 'primary');

    const journal = await deps.journals.getOrCreateJournalForSource(
      source.id,
      title,
    );

    const timestamp = new Date().toISOString();
    const initialLocation = {
      sourceType: 'book' as const,
      sourceId: source.id,
      pdf: { page: 1 },
    };

    // `create`, not an upsert: the source was minted a few lines up,
    // so this is unambiguously the first state for it. An upsert here
    // would silently overwrite if the id ever collided (ADR-0003).
    const workspaceState = await deps.workspaceStates.create({
      id: createEntityId(),
      sourceId: source.id,
      activeLocation: initialLocation,
      furthestLocation: initialLocation,
      sourceView: {
        mode: 'continuous',
        zoom: 1,
        scrollOffset: 0,
        annotationTool: 'select',
      },
      journalView: { scrollOffset: 0 },
      layout: {
        mode: 'split',
        splitRatio: 0.5,
        sourceCollapsed: false,
        journalCollapsed: false,
      },
      awayMode: false,
      playbackCapability: 'unknown',
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
    });

    return { source, asset, journal, workspaceState };
  });
}

function cleanFilename(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
