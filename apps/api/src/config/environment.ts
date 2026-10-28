export interface ServerEnvironment {
  readonly databaseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly testSignInEnabled: boolean;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const TEST_SIGN_IN_ENVIRONMENTS = new Set(['development', 'test']);

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
    testSignInEnabled: readTestSignInEnabled(variables),
  };
}

// Test sign-in exists only when NODE_ENV says local or test; anything else, unset included, is treated as production.
export function readTestSignInEnabled(variables: NodeJS.ProcessEnv): boolean {
  const environment = variables['NODE_ENV'];
  return environment !== undefined && TEST_SIGN_IN_ENVIRONMENTS.has(environment);
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
