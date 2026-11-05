import { describe, expect, it } from 'vitest';
import { isLockTimeout } from '../../src/infrastructure/postgres/lockTimeout.ts';
import { postgresErrorOf } from '../../src/infrastructure/postgres/postgresError.ts';

describe('postgresErrorOf', () => {
  it('reads the code and the constraint under the error Drizzle wraps around it', () => {
    const driverError = { code: '23505', constraint_name: 'parking_session_one_active_per_user_index' };

    expect(postgresErrorOf(new Error('Failed query', { cause: driverError }))).toEqual({
      code: '23505',
      constraintName: 'parking_session_one_active_per_user_index',
    });
  });

  it('reads a code without a constraint', () => {
    expect(postgresErrorOf({ code: '55P03' })).toEqual({ code: '55P03', constraintName: null });
  });

  it.each([['an error without Postgres fields', new Error('boom')], ['nothing', null], ['a string', 'boom']])('finds nothing in %s', (_case, error) => {
    expect(postgresErrorOf(error)).toBeNull();
  });
});

describe('isLockTimeout', () => {
  it('recognizes lock_not_available, what Postgres raises past lock_timeout', () => {
    expect(isLockTimeout(new Error('Failed query', { cause: { code: '55P03' } }))).toBe(true);
  });

  it('does not take a unique violation for it', () => {
    expect(isLockTimeout({ code: '23505' })).toBe(false);
  });
});
