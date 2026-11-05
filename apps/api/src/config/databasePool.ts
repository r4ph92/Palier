export const DEFAULT_DATABASE_POOL_MAX = 5;

const WHOLE_NUMBER = /^\d+$/;

// An entry waiting on a busy lot holds one of these connections for up to its 3 s lock timeout (docs/decisions/014).
export function readDatabasePoolMax(variables: NodeJS.ProcessEnv): number {
  const rawMax = variables['DATABASE_POOL_MAX'];
  if (rawMax === undefined || rawMax === '') {
    return DEFAULT_DATABASE_POOL_MAX;
  }
  const max = Number(rawMax);
  if (!WHOLE_NUMBER.test(rawMax) || max < 1) {
    throw new Error(`DATABASE_POOL_MAX must be a positive whole number of connections, got "${rawMax}".`);
  }
  return max;
}
