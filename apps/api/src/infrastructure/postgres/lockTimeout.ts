import { postgresErrorOf } from './postgresError.ts';

const LOCK_NOT_AVAILABLE = '55P03';

export function isLockTimeout(error: unknown): boolean {
  return postgresErrorOf(error)?.code === LOCK_NOT_AVAILABLE;
}
