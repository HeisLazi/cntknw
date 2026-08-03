/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConflictKeepSaved, resolveConflictUseMyVersion } from './resolution';

describe('Conflict Resolution Failure Paths', () => {
  let mockRepos: any;
  let mockClearDraft: any;
  let pending: Map<string, any>;
  let timers: Map<string, any>;
  let revisions: Map<string, number>;
  let mockSetBlocks: any;
  let mockSetConflictData: any;
  let mockSetResetKeys: any;
  let mockSetResolutionErrors: any;

  beforeEach(() => {
    mockRepos = {
      journals: {
        getBlockById: vi.fn(),
        updateBlock: vi.fn(),
      }
    };
    mockClearDraft = vi.fn();
    pending = new Map();
    timers = new Map();
    revisions = new Map();
    mockSetBlocks = vi.fn();
    mockSetConflictData = vi.fn();
    mockSetResetKeys = vi.fn();
    mockSetResolutionErrors = vi.fn((updater) => {
      // Simulate state update if needed, or just track calls
      // The function passed to setResolutionErrors is executed with a dummy Set
      updater(new Set());
    });
  });

  it('A. Keep saved remote-read failure: keeps conflict and drafts', async () => {
    const blockId = 'block-1';
    
    // Simulate pending local state
    pending.set(blockId, { type: 'paragraph', text: 'local text' });
    timers.set(blockId, setTimeout(() => {}, 1000));
    
    // Mock fetch failure
    mockRepos.journals.getBlockById.mockRejectedValue(new Error('Network error'));
    
    await resolveConflictKeepSaved(
      blockId,
      mockRepos,
      mockClearDraft,
      pending,
      timers,
      revisions,
      mockSetBlocks,
      mockSetConflictData,
      mockSetResetKeys,
      mockSetResolutionErrors
    );
    
    // Failure should be caught and error state set
    expect(mockSetResolutionErrors).toHaveBeenCalledTimes(2);
    // Drafts and pending should NOT be cleared
    expect(mockClearDraft).not.toHaveBeenCalled();
    expect(pending.has(blockId)).toBe(true);
    expect(timers.has(blockId)).toBe(true);
    // Conflict should NOT be removed
    expect(mockSetConflictData).not.toHaveBeenCalled();
  });

  it('B. Use my version write failure: keeps conflict and drafts, allows successful retry', async () => {
    const blockId = 'block-2';
    
    // Simulate pending local state
    pending.set(blockId, { type: 'paragraph', text: 'local text' });
    timers.set(blockId, setTimeout(() => {}, 1000));
    
    // Mock remote block existing
    mockRepos.journals.getBlockById.mockResolvedValue({
      id: blockId,
      revision: 2,
      content: { type: 'paragraph', text: 'remote text' }
    });
    
    // Mock write failure on FIRST try
    mockRepos.journals.updateBlock.mockRejectedValueOnce(new Error('Write failed'));
    
    await resolveConflictUseMyVersion(
      blockId,
      mockRepos,
      mockClearDraft,
      pending,
      timers,
      revisions,
      mockSetBlocks,
      mockSetConflictData,
      mockSetResetKeys,
      mockSetResolutionErrors
    );
    
    // Failure should be caught
    expect(mockSetResolutionErrors).toHaveBeenCalledTimes(2);
    
    // Drafts and pending should NOT be cleared
    expect(mockClearDraft).not.toHaveBeenCalled();
    expect(pending.has(blockId)).toBe(true);
    // Conflict should NOT be removed
    expect(mockSetConflictData).not.toHaveBeenCalled();
    
    // --- C. successful retry ---
    
    // Mock write success on SECOND try
    mockRepos.journals.updateBlock.mockResolvedValueOnce({
      id: blockId,
      revision: 3,
      content: { type: 'paragraph', text: 'local text' }
    });
    
    await resolveConflictUseMyVersion(
      blockId,
      mockRepos,
      mockClearDraft,
      pending,
      timers,
      revisions,
      mockSetBlocks,
      mockSetConflictData,
      mockSetResetKeys,
      mockSetResolutionErrors
    );
    
    // Drafts and pending should be cleared now
    expect(mockClearDraft).toHaveBeenCalledWith(blockId);
    expect(pending.has(blockId)).toBe(false);
    expect(timers.has(blockId)).toBe(false);
    // Conflict should be removed
    expect(mockSetConflictData).toHaveBeenCalled();
    // Blocks array should be updated
    expect(mockSetBlocks).toHaveBeenCalled();
  });
});
