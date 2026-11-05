import { readPositiveWholeNumber } from './readPositiveWholeNumber.ts';

export const DEFAULT_DATABASE_POOL_MAX = 5;

// An entry waiting on a busy lot holds one of these connections for up to its 3 s lock timeout (docs/decisions/014).
export function readDatabasePoolMax(variables: NodeJS.ProcessEnv): number {
  const rawMax = variables['DATABASE_POOL_MAX'];
  if (rawMax === undefined || rawMax === '') {
    return DEFAULT_DATABASE_POOL_MAX;
  }
  const max = readPositiveWholeNumber(rawMax);
  if (max === null) {
    throw new Error(`DATABASE_POOL_MAX must be a positive whole number of connections, got "${rawMax}".`);
  }
  return max;
}
