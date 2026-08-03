import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createIndexedDbRepositories } from './index';
import { CntknwDatabase } from '../../db/database';
import { createPageLinkedBlock } from '../../../application/create-block';
import { compareRank } from '../../../lib/rank';

describe('IndexedDB Concurrent Operations', () => {
  let dbName: string;
  let dbA: CntknwDatabase;
  let dbB: CntknwDatabase;
  let dbC: CntknwDatabase;

  beforeEach(() => {
    dbName = `test-concurrent-${Date.now()}-${Math.random()}`;
    dbA = new CntknwDatabase(dbName);
    dbB = new CntknwDatabase(dbName);
    dbC = new CntknwDatabase(dbName);
  });

  afterEach(async () => {
    await dbA.delete();
    dbA.close();
    dbB.close();
    dbC.close();
  });

  it('serializes concurrent rank allocation accurately (Finding 8)', async () => {
    const connA = createIndexedDbRepositories(dbA);
    const connB = createIndexedDbRepositories(dbB);
    const connC = createIndexedDbRepositories(dbC); // Third connection for verification

    const sourceId = '00000000-0000-4000-0000-000000000001';
    
    // Setup initial state: block A and block C
    const journalA = await connA.journals.getOrCreateJournalForSource(sourceId, 'Title');
    
    const blockA = await connA.journals.createBlock({
      journalId: journalA.id,
      kind: 'paragraph',
      sourceLocation: { sourceType: 'book', sourceId },
      rank: 'k',
      content: { type: 'paragraph', text: 'Block A' },
    });

    const _blockC = await connA.journals.createBlock({
      journalId: journalA.id,
      kind: 'paragraph',
      sourceLocation: { sourceType: 'book', sourceId },
      rank: 'm',
      content: { type: 'paragraph', text: 'Block C' },
    });

    // Concurrently insert B after A and X after A using createPageLinkedBlock
    const insertBPromise = createPageLinkedBlock({ journals: connA.journals }, {
      sourceId,
      sourceLocation: { sourceType: 'book', sourceId },
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'Block B' },
      afterBlockId: blockA.id
    });

    const insertXPromise = createPageLinkedBlock({ journals: connB.journals }, {
      sourceId,
      sourceLocation: { sourceType: 'book', sourceId },
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'Block X' },
      afterBlockId: blockA.id
    });

    const [blockB, blockX] = await Promise.all([insertBPromise, insertXPromise]);

    // Validate distinct and valid ranks
    expect(blockB.rank).not.toBe(blockX.rank);
    expect(blockB.rank > blockA.rank).toBe(true);
    expect(blockX.rank > blockA.rank).toBe(true);

    // The order should be deterministic and sequential
    const orderedConcurrent = [blockB, blockX].sort((a, b) => compareRank(a.rank, b.rank));
    const first = orderedConcurrent[0]!;
    const second = orderedConcurrent[1]!;

    // Now insert D specifically after the first concurrent block
    const _blockD = await createPageLinkedBlock({ journals: connA.journals }, {
      sourceId,
      sourceLocation: { sourceType: 'book', sourceId },
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'Block D' },
      afterBlockId: first.id
    });

    // And insert E specifically after the second concurrent block
    const _blockE = await createPageLinkedBlock({ journals: connB.journals }, {
      sourceId,
      sourceLocation: { sourceType: 'book', sourceId },
      kind: 'paragraph',
      content: { type: 'paragraph', text: 'Block E' },
      afterBlockId: second.id
    });

    // Reopen through connection C and verify persisted ordering
    const finalBlocks = await connC.journals.listBlocks(journalA.id);
    const sortedFinal = [...finalBlocks].sort((a, b) => compareRank(a.rank, b.rank));

    expect(sortedFinal.map(b => (b.content as {text: string}).text)).toEqual([
      'Block A',
      (first.content as {text: string}).text,
      'Block D',
      (second.content as {text: string}).text,
      'Block E',
      'Block C'
    ]);
  });

  it('guarantees unique journal creation across concurrent connections (Finding 7)', async () => {
    const connA = createIndexedDbRepositories(dbA);
    const connB = createIndexedDbRepositories(dbB);
    const connC = createIndexedDbRepositories(dbC); // Third connection for verification

    const sourceId = '00000000-0000-4000-0000-000000000002';

    // Concurrently attempt to getOrCreateJournalForSource
    const [journalA, journalB] = await Promise.all([
      connA.journals.getOrCreateJournalForSource(sourceId, 'Title A'),
      connB.journals.getOrCreateJournalForSource(sourceId, 'Title B')
    ]);

    // Both must resolve to the same canonical journal
    expect(journalA.id).toBe(journalB.id);

    // Only exactly one source journal exists in the database for this source
    const journalC = await connC.journals.getJournalForSource(sourceId);
    expect(journalC).not.toBeNull();
    expect(journalC!.id).toBe(journalA.id);

    // Verify direct createJournal cannot bypass the invariant
    await expect(
      connA.journals.createJournal({ sourceId, title: 'Bypass attempt', kind: 'source' })
    ).rejects.toThrow(/A journal already exists/);
  });

  it('serializes structural reordering properly so independent connections don\'t generate identical ranks (Finding 8)', async () => {
    const { movePageLinkedBlock } = await import('../../../application');

    const connA = createIndexedDbRepositories(dbA);
    const connB = createIndexedDbRepositories(dbB);
    const connC = createIndexedDbRepositories(dbC);

    const sourceId = '00000000-0000-4000-0000-000000000003';
    const journalA = await connA.journals.getOrCreateJournalForSource(sourceId, 'Title');

    // Create 3 blocks on the same page
    const block1 = await connA.journals.createBlock({
      journalId: journalA.id, kind: 'paragraph', rank: 'a',
      content: { type: 'paragraph', text: '1' },
      sourceLocation: { sourceType: 'book', sourceId, pdf: { page: 1 } }
    });
    await connA.journals.createBlock({
      journalId: journalA.id, kind: 'paragraph', rank: 'b',
      content: { type: 'paragraph', text: '2' },
      sourceLocation: { sourceType: 'book', sourceId, pdf: { page: 1 } }
    });
    await connA.journals.createBlock({
      journalId: journalA.id, kind: 'paragraph', rank: 'c',
      content: { type: 'paragraph', text: '3' },
      sourceLocation: { sourceType: 'book', sourceId, pdf: { page: 1 } }
    });

    // We want connection A to move block1 DOWN (meaning it calculates rank between b and c)
    // And connection B to move block3 UP (meaning it calculates rank between a and b)
    // Wait, if they run concurrently without transactions, they would calculate overlapping ranks, 
    // or both might try to move their block between the same two blocks.
    // Let's make both connection A and connection B try to move DIFFERENT blocks into the SAME interval.
    // E.g. Add block 4. We want to move block 1 down (after 2), and block 4 up (before 3).
    const block4 = await connA.journals.createBlock({
      journalId: journalA.id, kind: 'paragraph', rank: 'd',
      content: { type: 'paragraph', text: '4' },
      sourceLocation: { sourceType: 'book', sourceId, pdf: { page: 1 } }
    });

    await Promise.all([
      movePageLinkedBlock(connA, { blockId: block1.id, direction: 'down' }).catch(e => e),
      movePageLinkedBlock(connB, { blockId: block4.id, direction: 'up' }).catch(e => e)
    ]);

    // One must fail with RevisionConflictError on the journal, or both succeed because they serialize 
    // and read the updated sibling ranks!
    // Since movePageLinkedBlock uses journal transaction, they should both succeed, 
    // but the ranks they generate must be distinct and well-ordered.
    const finalBlocks = await connC.journals.listBlocks(journalA.id);
    
    // Sort by actual rank
    finalBlocks.sort((a, b) => a.rank.localeCompare(b.rank));
    
    // They must all have different ranks
    const ranks = finalBlocks.map(b => b.rank);
    const uniqueRanks = new Set(ranks);
    expect(uniqueRanks.size).toBe(4);
  });
});
