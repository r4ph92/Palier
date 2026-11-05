import { readDatabaseUrl } from '../config/environment.ts';

const ALLOWED_ENVIRONMENTS = new Set(['development', 'test']);
// The names that reach this machine, as URL.hostname writes them; the seed and the load script accept nothing else.
export const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
export const LOCAL_HOST_NAMES = [...LOCAL_HOSTS].join(', ');

export function databaseUrlAllowedForSeeding(variables: NodeJS.ProcessEnv): string {
  const environment = variables['NODE_ENV'];
  if (environment === undefined || !ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(`Seeding refused: NODE_ENV must be development or test, got "${environment ?? ''}".`);
  }
  const databaseUrl = readDatabaseUrl(variables);
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Seeding refused: the database host must be one of ${LOCAL_HOST_NAMES}, got "${host}".`);
  }
  return databaseUrl;
}
