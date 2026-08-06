export * from './SourceRepository';
export * from './JournalRepository';
export * from './AssetRepository';
export * from './AnnotationRepository';
export * from './ConnectionRepository';
export * from './SessionRepository';
export * from './WorkspaceStateRepository';
export * from './PomodoroRepository';
export * from './ConceptRepository';
export * from './GlossaryRepository';
export * from './EpistemicClaimRepository';
export * from './UnitOfWork';
export * from './concurrency';

import type { SourceRepository } from './SourceRepository';
import type { JournalRepository } from './JournalRepository';
import type { AssetRepository } from './AssetRepository';
import type { AnnotationRepository } from './AnnotationRepository';
import type { ConnectionRepository } from './ConnectionRepository';
import type { SessionRepository } from './SessionRepository';
import type { WorkspaceStateRepository } from './WorkspaceStateRepository';
import type { PomodoroRepository } from './PomodoroRepository';
import type { ConceptRepository } from './ConceptRepository';
import type { GlossaryRepository } from './GlossaryRepository';
import type { EpistemicClaimRepository } from './EpistemicClaimRepository';
import type { UnitOfWork } from './UnitOfWork';

/**
 * The complete persistence surface, as interfaces.
 *
 * This is what the UI depends on — never a concrete adapter. INV-014
 * says components do not write arbitrary database records; the way
 * that is made true rather than merely intended is that no component
 * can name a Dexie table, because nothing it can import exposes one.
 *
 * Exactly one module chooses an implementation
 * (`app/composition/production.ts`), and tests inject the memory
 * adapter instead. `architecture.test.ts` enforces both.
 */
export interface Repositories {
  sources: SourceRepository;
  journals: JournalRepository;
  assets: AssetRepository;
  annotations: AnnotationRepository;
  connections: ConnectionRepository;
  concepts: ConceptRepository;
  glossary: GlossaryRepository;
  claims: EpistemicClaimRepository;
  sessions: SessionRepository;
  workspaceStates: WorkspaceStateRepository;
  pomodoro: PomodoroRepository;
  unitOfWork: UnitOfWork;
}
