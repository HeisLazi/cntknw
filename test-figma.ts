import { rankBetween, INITIAL_RANK } from './src/lib/rank';

function sortKey(rank: string, id: string): string {
  return rank + id.replace(/-/g, '');
}

function testFigmaModel() {
  const B = { id: '1111', rank: 'k' };
  const C = { id: '2222', rank: 'k' };

  // Sort B and C
  const sorted = [B, C].sort((a, b) => sortKey(a.rank, a.id).localeCompare(sortKey(b.rank, b.id)));
  console.log("Sorted:", sorted.map(x => x.id));

  // Insert D after B
  const beforeKey = sortKey(B.rank, B.id);
  const afterKey = sortKey(C.rank, C.id);
  
  const dRank = rankBetween(beforeKey, afterKey);
  console.log("D rank generated:", dRank);

  const D = { id: '3333', rank: dRank };

  const finalSorted = [B, C, D].sort((a, b) => sortKey(a.rank, a.id).localeCompare(sortKey(b.rank, b.id)));
  console.log("Final sorted:", finalSorted.map(x => x.id));
}

testFigmaModel();
