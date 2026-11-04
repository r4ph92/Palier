// Bounds the walk down the causes, so an error that is its own cause cannot loop forever.
const MAX_CAUSE_DEPTH = 5;

export interface PostgresErrorFields {
  readonly code: string;
  readonly constraintName: string | null;
}

// Drizzle wraps the driver's error, so the Postgres fields are looked for on the error and on its causes.
export function postgresErrorOf(error: unknown): PostgresErrorFields | null {
  let candidate: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof candidate === 'object' && candidate !== null; depth += 1) {
    if ('code' in candidate && typeof candidate.code === 'string') {
      return { code: candidate.code, constraintName: constraintNameOf(candidate) };
    }
    candidate = 'cause' in candidate ? candidate.cause : undefined;
  }
  return null;
}

function constraintNameOf(candidate: object): string | null {
  return 'constraint_name' in candidate && typeof candidate.constraint_name === 'string' ? candidate.constraint_name : null;
}
