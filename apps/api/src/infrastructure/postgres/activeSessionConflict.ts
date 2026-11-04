const UNIQUE_VIOLATION = '23505';
const ONE_ACTIVE_SESSION_PER_USER = 'parking_session_one_active_per_user_index';
// Bounds the walk down the causes, so an error that is its own cause cannot loop forever.
const MAX_CAUSE_DEPTH = 5;

// Drizzle wraps the driver's error, so the Postgres fields are looked for on the error and on its causes.
export function isActiveSessionConflict(error: unknown): boolean {
  let candidate: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof candidate === 'object' && candidate !== null; depth += 1) {
    if (isOneActiveSessionViolation(candidate)) {
      return true;
    }
    candidate = 'cause' in candidate ? candidate.cause : undefined;
  }
  return false;
}

function isOneActiveSessionViolation(candidate: object): boolean {
  return (
    'code' in candidate &&
    candidate.code === UNIQUE_VIOLATION &&
    'constraint_name' in candidate &&
    candidate.constraint_name === ONE_ACTIVE_SESSION_PER_USER
  );
}
