import { describe, it, expect } from 'vitest';
import { createEntityId } from '@lib/id';

describe('createEntityId', () => {
  it('returns a valid UUID string', () => {
    const id = createEntityId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createEntityId()));
    expect(ids.size).toBe(100);
  });
});
