const UNIQUE_VIOLATION = '23505';
// Bounds the walk down the causes, so an error that is its own cause cannot loop forever.
const MAX_CAUSE_DEPTH = 5;

// Drizzle wraps the driver's error, so the Postgres fields are looked for on the error and on its causes.
export function isUniqueViolationOf(error: unknown, constraintNames: ReadonlySet<string>): boolean {
  let candidate: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof candidate === 'object' && candidate !== null; depth += 1) {
    if (violates(candidate, constraintNames)) {
      return true;
    }
    candidate = 'cause' in candidate ? candidate.cause : undefined;
  }
  return false;
}

function violates(candidate: object, constraintNames: ReadonlySet<string>): boolean {
  return (
    'code' in candidate &&
    candidate.code === UNIQUE_VIOLATION &&
    'constraint_name' in candidate &&
    typeof candidate.constraint_name === 'string' &&
    constraintNames.has(candidate.constraint_name)
  );
}
