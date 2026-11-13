import { sql } from 'drizzle-orm';
import { LOT_LOCK_WAIT_SECONDS } from '../../domain/lots/lotLockWait.ts';
import { postgresErrorOf } from './postgresError.ts';

const LOCK_NOT_AVAILABLE = '55P03';

// Past it, a request waiting on a lot lock gives up with a retryable refusal instead of holding a pool connection.
export const LIMIT_LOCK_WAIT = sql.raw(`set local lock_timeout = '${LOT_LOCK_WAIT_SECONDS}s'`);

export function isLockTimeout(error: unknown): boolean {
  return postgresErrorOf(error)?.code === LOCK_NOT_AVAILABLE;
}
