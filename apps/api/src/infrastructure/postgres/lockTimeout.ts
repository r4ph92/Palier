import { sql } from 'drizzle-orm';
import { postgresErrorOf } from './postgresError.ts';

const LOCK_NOT_AVAILABLE = '55P03';

// Past it, a request waiting on a lot lock gives up with a retryable refusal instead of holding a pool connection.
export const LIMIT_LOCK_WAIT = sql`set local lock_timeout = '3s'`;

export function isLockTimeout(error: unknown): boolean {
  return postgresErrorOf(error)?.code === LOCK_NOT_AVAILABLE;
}
