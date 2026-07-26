/**
 * Read Aloud domain-readiness tests.
 *
 * No playback is implemented in this phase. These verify only that
 * the domain can already express separate reading and listening
 * progress, and that the two cannot silently overwrite one another.
 */
import { describe, it, expect } from 'vitest';
import { createEntityId } from '@lib/id';
import {
  WorkspaceStateSchema,
  LayoutModeSchema,
  PlaybackCapabilitySchema,
  PlaybackPositionCacheSchema,
  positionsDiverge,
} from './workspace/workspace.schemas';
import {
  StudySessionSchema,
  ActivityModeSchema,
} from './sessions/session.schemas';
import { TextAnchorSchema, SourceLocationSchema } from './shared';
import { GlossaryEntrySchema } from './concepts/concept.schemas';

const id = createEntityId;
const now = new Date().toISOString();
const baseFields = () => ({
  id: id(),
  createdAt: now,
  updatedAt: now,
  revision: 0,
});

function locationAt(sourceId: string, page: number) {
  return { sourceType: 'book' as const, sourceId, pdf: { page } };
}

// ─── Three positions ─────────────────────────────────────────────

describe('WorkspaceState positions', () => {
  it('defaults to visual position only', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 67),
    });
    expect(state.listenLocation).toBeUndefined();
    expect(state.furthestLocation).toBeUndefined();
  });

  it('holds visual, listening and furthest positions independently', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 67),
      listenLocation: locationAt(sourceId, 82),
      furthestLocation: locationAt(sourceId, 82),
    });
    expect(state.activeLocation.pdf?.page).toBe(67);
    expect(state.listenLocation?.pdf?.page).toBe(82);
    expect(state.furthestLocation?.pdf?.page).toBe(82);
  });

  it('does not let listening progress overwrite reading progress', () => {
    // RA-022: the two are separate fields, so advancing one leaves
    // the other exactly where it was.
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 67),
      listenLocation: locationAt(sourceId, 82),
    });
    const advanced = WorkspaceStateSchema.parse({
      ...state,
      listenLocation: locationAt(sourceId, 95),
    });
    expect(advanced.activeLocation.pdf?.page).toBe(67);
    expect(advanced.listenLocation?.pdf?.page).toBe(95);
  });
});

describe('positionsDiverge', () => {
  it('is false when there is no listening position', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 67),
    });
    expect(positionsDiverge(state)).toBe(false);
  });

  it('is false when both positions agree — no prompt (RA-024)', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 67),
      listenLocation: locationAt(sourceId, 67),
    });
    expect(positionsDiverge(state)).toBe(false);
  });

  it('is true when the positions differ — offer a choice (RA-023)', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 67),
      listenLocation: locationAt(sourceId, 82),
    });
    expect(positionsDiverge(state)).toBe(true);
  });
});

// ─── Listen layout mode ──────────────────────────────────────────

describe('LayoutModeSchema', () => {
  it('includes listen as a layout mode, not a route', () => {
    expect(LayoutModeSchema.safeParse('listen').success).toBe(true);
  });

  it('retains every original layout mode', () => {
    for (const mode of ['split', 'source-focus', 'journal-focus', 'compare']) {
      expect(LayoutModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it('remembers the layout to restore when leaving listen', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 1),
      layout: { mode: 'listen', previousMode: 'split' },
    });
    expect(state.layout.mode).toBe('listen');
    expect(state.layout.previousMode).toBe('split');
  });
});

// ─── Playback capability ─────────────────────────────────────────

describe('PlaybackCapabilitySchema', () => {
  it('defaults to unknown until detected', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 1),
    });
    expect(state.playbackCapability).toBe('unknown');
    expect(state.awayMode).toBe(false);
  });

  it('distinguishes web best-effort from desktop-reliable playback', () => {
    expect(PlaybackCapabilitySchema.safeParse('web-best-effort').success)
      .toBe(true);
    expect(PlaybackCapabilitySchema.safeParse('desktop-reliable').success)
      .toBe(true);
  });
});

describe('PlaybackPositionCacheSchema', () => {
  it('records the voice and rate the offset was measured against', () => {
    // The offset is only meaningful alongside these, which is
    // exactly why it is a cache and not an anchor (RA-INV-004).
    const cache = PlaybackPositionCacheSchema.parse({
      offsetSeconds: 1109.5,
      voiceId: 'en-GB-local',
      rate: 1.25,
    });
    expect(cache.offsetSeconds).toBeCloseTo(1109.5);
    expect(cache.rate).toBe(1.25);
  });

  it('rejects a negative offset', () => {
    expect(
      PlaybackPositionCacheSchema.safeParse({ offsetSeconds: -1 }).success,
    ).toBe(false);
  });

  it('is optional — a workspace need never have one', () => {
    const sourceId = id();
    const state = WorkspaceStateSchema.parse({
      ...baseFields(),
      sourceId,
      activeLocation: locationAt(sourceId, 1),
    });
    expect(state.playbackPositionCache).toBeUndefined();
  });
});

// ─── Sentence anchoring ──────────────────────────────────────────

describe('sentence-level anchoring', () => {
  it('carries a sentence index alongside the durable quote anchor', () => {
    const anchor = TextAnchorSchema.parse({
      page: 42,
      quote: 'National liberation, national renaissance...',
      prefix: 'The naked truth of decolonization. ',
      sentenceIndex: 3,
    });
    expect(anchor.sentenceIndex).toBe(3);
    expect(anchor.quote).toContain('National liberation');
  });

  it('keeps the quote anchor usable without a sentence index', () => {
    // Segmentation may change; quote/prefix/suffix stay authoritative.
    const anchor = TextAnchorSchema.parse({
      page: 42,
      quote: 'National liberation, national renaissance...',
    });
    expect(anchor.sentenceIndex).toBeUndefined();
    expect(anchor.quote).toBeTruthy();
  });

  it('records a sentence on a source location', () => {
    const location = SourceLocationSchema.parse({
      sourceType: 'book',
      sourceId: id(),
      pdf: { page: 42, sentenceIndex: 3 },
    });
    expect(location.pdf?.sentenceIndex).toBe(3);
  });

  it('rejects a negative sentence index', () => {
    expect(
      TextAnchorSchema.safeParse({ page: 1, quote: 'x', sentenceIndex: -1 })
        .success,
    ).toBe(false);
  });
});

// ─── Activity mode and listening time ────────────────────────────

describe('StudySession activity mode', () => {
  it('defaults to reading', () => {
    const session = StudySessionSchema.parse({
      id: id(),
      sourceId: id(),
      startedAt: now,
      startLocation: locationAt(id(), 1),
    });
    expect(session.activityMode).toBe('reading');
    expect(session.listenedSeconds).toBe(0);
  });

  it('declares reading, listening and mixed', () => {
    for (const mode of ['reading', 'listening', 'mixed']) {
      expect(ActivityModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it('keeps listening time separable from total focused time', () => {
    // RA-INV-008: listening counts as study, but remains
    // distinguishable from active visual reading.
    const sourceId = id();
    const session = StudySessionSchema.parse({
      id: id(),
      sourceId,
      startedAt: now,
      startLocation: locationAt(sourceId, 1),
      activityMode: 'mixed',
      focusedSeconds: 3600,
      listenedSeconds: 1200,
    });
    expect(session.listenedSeconds).toBeLessThan(session.focusedSeconds);
    expect(session.focusedSeconds - session.listenedSeconds).toBe(2400);
  });

  it('records pages reached by listening only', () => {
    const sourceId = id();
    const session = StudySessionSchema.parse({
      id: id(),
      sourceId,
      startedAt: now,
      startLocation: locationAt(sourceId, 67),
      activityMode: 'listening',
      listenedLocations: [locationAt(sourceId, 68), locationAt(sourceId, 69)],
    });
    expect(session.listenedLocations).toHaveLength(2);
    expect(session.visitedLocations).toEqual([]);
  });

  it('retains every original v0.2 session field', () => {
    // The Read Aloud brief sketched a reduced session shape; the
    // canonical accounting fields must survive intact.
    const sourceId = id();
    const session = StudySessionSchema.parse({
      id: id(),
      sourceId,
      startedAt: now,
      startLocation: locationAt(sourceId, 1),
    });
    expect(session.breakSeconds).toBe(0);
    expect(session.manualPauseSeconds).toBe(0);
    expect(session.removedIdleSeconds).toBe(0);
    expect(session.createdAnnotationIds).toEqual([]);
    expect(session.createdConnectionIds).toEqual([]);
    expect(session.dictionaryLookupIds).toEqual([]);
  });
});

// ─── Pronunciation ───────────────────────────────────────────────

describe('GlossaryEntry pronunciation', () => {
  it('stores a preferred pronunciation as plain respelling', () => {
    const entry = GlossaryEntrySchema.parse({
      ...baseFields(),
      term: 'Kwame Nkrumah',
      preferredPronunciation: 'KWAH-meh en-KROO-mah',
    });
    expect(entry.preferredPronunciation).toBe('KWAH-meh en-KROO-mah');
  });

  it('is optional', () => {
    const entry = GlossaryEntrySchema.parse({
      ...baseFields(),
      term: 'eudaimonia',
    });
    expect(entry.preferredPronunciation).toBeUndefined();
  });
});
