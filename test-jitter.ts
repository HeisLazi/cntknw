import { rankBetween, INITIAL_RANK } from './src/lib/rank';

function testJitter() {
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const BASE = ALPHABET.length;
  
  function randomJitter(): string {
    let j = '';
    for (let i = 0; i < 4; i++) {
      j += ALPHABET[Math.floor(Math.random() * BASE)];
    }
    return j;
  }

  // Generate 10,000 random rank pairs, ensure jittered rank is strictly between bounds
  for (let i = 0; i < 10000; i++) {
    // We simulate creating blocks randomly
    let before: string | null = null;
    let after: string | null = null;
    // Just to get realistic ranks, we generate a random sequence
    let current = INITIAL_RANK;
    for (let step = 0; step < 5; step++) {
      if (Math.random() > 0.5) {
        before = current;
        current = rankBetween(current, null) + randomJitter();
      } else {
        after = current;
        current = rankBetween(null, current) + randomJitter();
      }
    }
    
    // Now we have a current rank. Let's create another one close to it.
    let next = rankBetween(current, null) + randomJitter();
    
    // Test rankBetween(current, next)
    let mid = rankBetween(current, next);
    let midJittered = mid + randomJitter();
    
    if (midJittered <= current || midJittered >= next) {
      console.error(`FAILED! before=${current}, after=${next}`);
      console.error(`mid=${mid}, midJittered=${midJittered}`);
      process.exit(1);
    }
  }
  console.log("All 10000 jittered ranks are strictly between their bounds!");
}
testJitter();
