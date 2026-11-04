import { describe, expect, it } from 'vitest';
import { isActiveSessionConflict } from '../../src/infrastructure/postgres/activeSessionConflict.ts';

const oneActivePerUser = { code: '23505', constraint_name: 'parking_session_one_active_per_user_index' };

describe('isActiveSessionConflict', () => {
  it('recognizes the one-active-session violation from Postgres', () => {
    expect(isActiveSessionConflict(oneActivePerUser)).toBe(true);
  });

  it('recognizes the one-active-session-per-spot violation as the same conflict', () => {
    expect(isActiveSessionConflict({ code: '23505', constraint_name: 'parking_session_one_active_per_spot_index' })).toBe(true);
  });

  it('finds it under the error Drizzle wraps around it', () => {
    expect(isActiveSessionConflict(new Error('Failed query', { cause: oneActivePerUser }))).toBe(true);
  });

  it.each([
    ['another unique index', { code: '23505', constraint_name: 'parking_session_user_email_index' }],
    ['another error code on the same index', { code: '23503', constraint_name: 'parking_session_one_active_per_user_index' }],
    ['an error without Postgres fields', new Error('connection reset')],
    ['something that is not an error', 'boom'],
    ['nothing', null],
  ])('does not take %s for it', (_case, error) => {
    expect(isActiveSessionConflict(error)).toBe(false);
  });

  it('stops on an error that is its own cause', () => {
    const looping = new Error('loop');
    Object.assign(looping, { cause: looping });

    expect(isActiveSessionConflict(looping)).toBe(false);
  });
});
