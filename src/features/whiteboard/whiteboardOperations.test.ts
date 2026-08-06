import { describe, expect, it, vi } from 'vitest';
import { WhiteboardCommandHistory } from './commandHistory';
import { deleteCanonicalBoardObject, withoutLayoutEntry } from './whiteboardOperations';

describe('canonical whiteboard operations', () => {
  it('whole-object erasing deletes the block before removing its layout', async () => {
    const calls: string[] = [];
    const deleteBlock = vi.fn(async () => { calls.push('block'); });
    const commitLayout = vi.fn(() => { calls.push('layout'); });
    const layout = { blockA: { x: 10, y: 20 }, blockB: { x: 30, y: 40 } };

    const next = await deleteCanonicalBoardObject({ deleteBlock, commitLayout }, 'blockA', layout);

    expect(calls).toEqual(['block', 'layout']);
    expect(deleteBlock).toHaveBeenCalledWith('blockA');
    expect(next).toEqual({ blockB: { x: 30, y: 40 } });
    expect(layout).toHaveProperty('blockA');
  });

  it('a failed canonical delete cannot silently delete only the projection', async () => {
    const commitLayout = vi.fn();
    await expect(deleteCanonicalBoardObject({
      deleteBlock: vi.fn(async () => { throw new Error('guarded delete failed'); }),
      commitLayout,
    }, 'blockA', { blockA: { x: 1, y: 2 } })).rejects.toThrow('guarded delete failed');
    expect(commitLayout).not.toHaveBeenCalled();

    expect(withoutLayoutEntry({ blockA: { x: 1, y: 2 } }, 'blockA')).toEqual({});
  });

  it('undo and redo restore both block truth and layout while history stays bounded', async () => {
    const history = new WhiteboardCommandHistory(2);
    const liveBlocks = new Set<string>();
    const layout: Record<string, { x: number; y: number }> = {};
    const restore = async () => { liveBlocks.add('blockA'); layout.blockA = { x: 5, y: 7 }; };
    const remove = async () => { liveBlocks.delete('blockA'); delete layout.blockA; };

    await restore();
    history.push({ label: 'create object', undo: remove, redo: restore });
    expect(await history.undo()).toBe('create object');
    expect(liveBlocks.has('blockA')).toBe(false);
    expect(layout).toEqual({});
    expect(await history.redo()).toBe('create object');
    expect(liveBlocks.has('blockA')).toBe(true);
    expect(layout.blockA).toEqual({ x: 5, y: 7 });

    history.push({ label: 'move one', undo: async () => undefined, redo: async () => undefined });
    history.push({ label: 'move two', undo: async () => undefined, redo: async () => undefined });
    expect(history.undoCount).toBe(2);
  });
});
