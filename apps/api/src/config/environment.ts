export interface ServerEnvironment {
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly demoMode: boolean;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

export function readDatabaseUrl(variables: NodeJS.ProcessEnv): string {
  const databaseUrl = variables['DATABASE_URL'];
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env.');
  }
  return databaseUrl;
}

export function readServerEnvironment(variables: NodeJS.ProcessEnv): ServerEnvironment {
  return {
    databaseUrl: readDatabaseUrl(variables),
    host: variables['HOST'] ?? DEFAULT_HOST,
    port: readPort(variables['PORT']),
    demoMode: readDemoMode(variables['DEMO_MODE']),
  };
}

function readPort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got "${rawPort}".`);
  }
  return port;
}

function readDemoMode(rawDemoMode: string | undefined): boolean {
  if (rawDemoMode === undefined || rawDemoMode === 'false') {
    return false;
  }
  if (rawDemoMode === 'true') {
    return true;
  }
  throw new Error(`DEMO_MODE must be "true" or "false", got "${rawDemoMode}".`);
}
