import { postgresErrorOf } from './postgresError.ts';

const UNIQUE_VIOLATION = '23505';

// The unique constraint or index that refused the write; null for any other failure.
export function violatedUniqueConstraintOf(error: unknown): string | null {
  const fields = postgresErrorOf(error);
  return fields?.code === UNIQUE_VIOLATION ? fields.constraintName : null;
}

export function isUniqueViolationOf(error: unknown, constraintNames: ReadonlySet<string>): boolean {
  const constraintName = violatedUniqueConstraintOf(error);
  return constraintName !== null && constraintNames.has(constraintName);
}
