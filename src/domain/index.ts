/**
 * CNTKNW Domain — Public API
 *
 * Re-exports all domain schemas and inferred types.
 */

// Shared primitives
export * from './shared';

// Atlas-readiness primitives.
// These provide the shared vocabulary the Atlas will need later.
// No Atlas ENTITY is modelled in this phase — see ADR-0001 §7.
export * from './time/time.schemas';
export * from './spatial/spatial.schemas';
export * from './knowledge/knowledge.schemas';
export * from './epistemics/epistemics.schemas';

// Domain entities
export * from './sources/source.schemas';
export * from './assets/asset.schemas';
export * from './journals/journal.schemas';
export * from './annotations/annotation.schemas';
export * from './connections/connection.schemas';
export * from './concepts/concept.schemas';
export * from './sessions/session.schemas';
export * from './workspace/workspace.schemas';
