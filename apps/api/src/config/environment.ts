import { VERSION_PATTERN } from '@palier/shared-types/appVersion';
import { readDatabasePoolMax } from './databasePool.ts';
import { readEntryCancellationTiming, type EntryCancellationTiming } from './entryCancellationTiming.ts';
import { readHoldExpiryPeriodSeconds } from './holdExpiryTiming.ts';
import { readSilentSessionCheckPeriodSeconds } from './silentSessionTiming.ts';

export interface ServerEnvironment {
  readonly databaseUrl: string;
  readonly databasePoolMax: number;
  readonly host: string;
  readonly port: number;
  readonly testSignInEnabled: boolean;
  readonly minimumAppVersion: string | undefined;
  readonly demoMode: boolean;
  readonly secureCookies: boolean;
  readonly entryCancellation: EntryCancellationTiming;
  readonly holdExpiryPeriodSeconds: number;
  readonly silentSessionCheckPeriodSeconds: number;
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
    databasePoolMax: readDatabasePoolMax(variables),
    host: variables['HOST'] ?? DEFAULT_HOST,
    port: readPort(variables['PORT']),
    testSignInEnabled: readTestSignInEnabled(variables),
    minimumAppVersion: readMinimumAppVersion(variables['MINIMUM_APP_VERSION']),
    demoMode: readDemoMode(variables['DEMO_MODE']),
    secureCookies: readSecureCookies(variables),
    entryCancellation: readEntryCancellationTiming(variables),
    holdExpiryPeriodSeconds: readHoldExpiryPeriodSeconds(variables),
    silentSessionCheckPeriodSeconds: readSilentSessionCheckPeriodSeconds(variables),
  };
}

// Unset means every app version is accepted; set, it is the lowest app version the API still serves.
export function readMinimumAppVersion(rawVersion: string | undefined): string | undefined {
  if (rawVersion === undefined || rawVersion === '') {
    return undefined;
  }
  if (!VERSION_PATTERN.test(rawVersion)) {
    throw new Error(`MINIMUM_APP_VERSION must look like 1.2.0, got "${rawVersion}".`);
  }
  return rawVersion;
}

// Test sign-in exists only when NODE_ENV says local or test; anything else, unset included, is treated as production.
export function readTestSignInEnabled(variables: NodeJS.ProcessEnv): boolean {
  const environment = variables['NODE_ENV'];
  return environment !== undefined && TEST_SIGN_IN_ENVIRONMENTS.has(environment);
}

// Browsers drop a Secure cookie over plain http, so only local development turns it off.
export function readSecureCookies(variables: NodeJS.ProcessEnv): boolean {
  return variables['NODE_ENV'] !== 'development';
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

const STRIPE_ACCOUNT_PREFIX = 'acct_';

// The seed writes it on Stationnements Lavoie so entry holds go to that connected test account; unset leaves none.
export function readDemoOperatorStripeAccountId(variables: NodeJS.ProcessEnv): string | null {
  const accountId = variables['DEMO_OPERATOR_STRIPE_ACCOUNT_ID'];
  if (accountId === undefined || accountId === '') {
    return null;
  }
  if (!accountId.startsWith(STRIPE_ACCOUNT_PREFIX)) {
    throw new Error(`DEMO_OPERATOR_STRIPE_ACCOUNT_ID must be a Stripe account id (acct_…), got "${accountId}".`);
  }
  return accountId;
}

const WEBHOOK_SECRET_PREFIX = 'whsec_';

// The signing secret of Palier's Stripe webhook endpoint (`stripe listen` prints it locally). Unset means the endpoint is not served.
export function readStripeWebhookSecret(variables: NodeJS.ProcessEnv): string | null {
  const secret = variables['STRIPE_WEBHOOK_SECRET'];
  if (secret === undefined || secret === '') {
    return null;
  }
  if (!secret.startsWith(WEBHOOK_SECRET_PREFIX)) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret (whsec_…).');
  }
  return secret;
}

const LOCAL_DASHBOARD_URL = 'http://localhost:5173';

// Where Stripe sends the operator back after onboarding. Local development has the Vite default; elsewhere unset means no onboarding.
export function readDashboardUrl(variables: NodeJS.ProcessEnv): string | null {
  const rawUrl = variables['DASHBOARD_URL'];
  if (rawUrl === undefined || rawUrl === '') {
    return readTestSignInEnabled(variables) ? LOCAL_DASHBOARD_URL : null;
  }
  const url = URL.canParse(rawUrl) ? new URL(rawUrl) : null;
  if (url === null || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    throw new Error(`DASHBOARD_URL must be an http(s) address, got "${rawUrl}".`);
  }
  return url.origin;
}
