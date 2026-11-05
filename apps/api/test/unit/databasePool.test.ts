import { describe, expect, it } from 'vitest';
import { readDatabasePoolMax } from '../../src/config/databasePool.ts';

describe('readDatabasePoolMax', () => {
  it.each([undefined, ''])('keeps five connections when DATABASE_POOL_MAX is %j', (rawMax) => {
    expect(readDatabasePoolMax({ DATABASE_POOL_MAX: rawMax })).toBe(5);
  });

  it('reads a larger pool', () => {
    expect(readDatabasePoolMax({ DATABASE_POOL_MAX: '20' })).toBe(20);
  });

  it.each(['0', '-3', '2.5', '1e1', ' 5', 'many'])('refuses DATABASE_POOL_MAX=%j', (rawMax) => {
    expect(() => readDatabasePoolMax({ DATABASE_POOL_MAX: rawMax })).toThrow(/DATABASE_POOL_MAX must be a positive whole number/);
  });
});
