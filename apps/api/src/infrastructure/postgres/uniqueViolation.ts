import { postgresErrorOf } from './postgresError.ts';

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolationOf(error: unknown, constraintNames: ReadonlySet<string>): boolean {
  const fields = postgresErrorOf(error);
  return fields?.code === UNIQUE_VIOLATION && fields.constraintName !== null && constraintNames.has(fields.constraintName);
}
