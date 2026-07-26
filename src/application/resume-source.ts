import type { SourceRepository } from '@data/repositories/SourceRepository';
import type { AssetRepository } from '@data/repositories/AssetRepository';
import type { JournalRepository } from '@data/repositories/JournalRepository';
import type { WorkspaceStateRepository } from '@data/repositories/WorkspaceStateRepository';
import type { 
  Source, 
  BookDetails, 
  ArtworkDetails, 
  Asset, 
  Journal, 
  WorkspaceState, 
  JournalBlock,
  EntityId
} from '@domain/index';
import { positionsDiverge } from '@domain/index';

export interface ResumeSourceDeps {
  sources: SourceRepository;
  assets: AssetRepository;
  journals: JournalRepository;
  workspaceStates: WorkspaceStateRepository;
}

export interface ResumedSourceContext {
  source: Source;
  bookDetails: BookDetails | null;
  artworkDetails: ArtworkDetails | null;
  primaryAsset: Asset | null;
  journal: Journal;
  workspaceState: WorkspaceState | null;
  nearbyBlocks: JournalBlock[];
  /**
   * True when the visual reading position and the listening
   * position differ, and the user should be asked which to resume
   * from (RA-023). False when they agree — no prompt is shown
   * (RA-024). Neither position is modified here: choosing is the
   * caller's job, and the unchosen one must survive (RA-022).
   */
  offerResumeChoice: boolean;
}

export async function resumeSource(
  deps: ResumeSourceDeps,
  sourceId: EntityId
): Promise<ResumedSourceContext> {
  // 1. Load source
  const source = await deps.sources.getById(sourceId);
  if (!source) {
    throw new Error(`Source with ID ${sourceId} not found`);
  }

  // 2. Load details based on source type
  let bookDetails: BookDetails | null = null;
  let artworkDetails: ArtworkDetails | null = null;
  if (source.type === 'book') {
    bookDetails = await deps.sources.getBookDetails(sourceId);
  } else if (source.type === 'artwork') {
    artworkDetails = await deps.sources.getArtworkDetails(sourceId);
  }

  // 3. Load primary asset
  const primaryAsset = await deps.assets.getPrimaryAsset(sourceId);

  // 4. Get journal for source
  const journal = await deps.journals.getOrCreateJournalForSource(
    sourceId,
    source.title
  );

  // 5. Load workspace state
  const workspaceState = await deps.workspaceStates.getBySource(sourceId);

  // 6. Load nearby blocks
  // If workspace state has an active pdf page, get blocks for that page
  let nearbyBlocks: JournalBlock[] = [];
  if (workspaceState?.activeLocation?.pdf?.page) {
    nearbyBlocks = await deps.journals.listBlocksByPage(
      journal.id,
      workspaceState.activeLocation.pdf.page
    );
  } else {
    // Just get some recent blocks
    nearbyBlocks = await deps.journals.listBlocks(journal.id);
  }

  return {
    source,
    bookDetails,
    artworkDetails,
    primaryAsset,
    journal,
    workspaceState,
    nearbyBlocks,
    offerResumeChoice: workspaceState
      ? positionsDiverge(workspaceState)
      : false,
  };
}
