import postgres from 'postgres';
import { readDatabaseUrl } from '../config/environment.ts';
import { LOCAL_HOST_NAMES, LOCAL_HOSTS } from '../config/localHosts.ts';

const ALLOWED_ENVIRONMENTS = new Set(['development', 'test']);
// Query parameters that libpq (psql) would connect to; postgres-js only forwards them to the server.
const HOST_PARAMETERS = ['host', 'hostaddr'] as const;

// PGHOST is read from process.env, as postgres-js reads it, not from `variables`.
export function databaseUrlAllowedForSeeding(variables: NodeJS.ProcessEnv): string {
  const environment = variables['NODE_ENV'];
  if (environment === undefined || !ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(`Seeding refused: NODE_ENV must be development or test, got "${environment ?? ''}".`);
  }
  const databaseUrl = readDatabaseUrl(variables);
  const remoteHosts = hostsNamedBy(databaseUrl).filter((host) => !LOCAL_HOSTS.has(host));
  if (remoteHosts.length > 0) {
    throw new Error(`Seeding refused: the database host must be one of ${LOCAL_HOST_NAMES}, got "${remoteHosts.join(', ')}".`);
  }
  return databaseUrl;
}

// Every host postgres-js would try, as it reads them: each host of a list, and PGHOST (from process.env) when the URL names none.
// Building the client opens no connection.
function hostsNamedBy(databaseUrl: string): string[] {
  const { options } = postgres(databaseUrl, { max: 1 });
  // postgres-js cuts an IPv6 host at its first colon, so a lone [::1] comes back as "[".
  const hosts = options.host.length === 1 && options.host[0] === '[' ? [new URL(databaseUrl).hostname] : options.host;
  const connection: Record<string, unknown> = options.connection;
  const hostParameters = HOST_PARAMETERS.map((name) => connection[name]).filter((value) => typeof value === 'string');
  // A host with a "/" makes postgres-js open this Unix socket path instead of any host of the list.
  const socketPaths = typeof options.path === 'string' ? [options.path] : [];
  return [...[...hosts, ...hostParameters].map((host) => host.toLowerCase()), ...socketPaths];
}
