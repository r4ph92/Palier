import { readDatabaseUrl } from '../config/environment.ts';

const ALLOWED_ENVIRONMENTS = new Set(['development', 'test']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export function databaseUrlAllowedForSeeding(variables: NodeJS.ProcessEnv): string {
  const environment = variables['NODE_ENV'];
  if (environment === undefined || !ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(`Seeding refused: NODE_ENV must be development or test, got "${environment ?? ''}".`);
  }
  const databaseUrl = readDatabaseUrl(variables);
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Seeding refused: the database host must be localhost or 127.0.0.1, got "${host}".`);
  }
  return databaseUrl;
}
