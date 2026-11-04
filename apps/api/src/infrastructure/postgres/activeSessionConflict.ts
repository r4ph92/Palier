import { isUniqueViolationOf } from './uniqueViolation.ts';

const ACTIVE_SESSION_INDEXES = new Set(['parking_session_one_active_per_user_index', 'parking_session_one_active_per_spot_index']);

export function isActiveSessionConflict(error: unknown): boolean {
  return isUniqueViolationOf(error, ACTIVE_SESSION_INDEXES);
}
