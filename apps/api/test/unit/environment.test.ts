import { describe, expect, it } from 'vitest';
import {
  readDashboardUrl,
  readMinimumAppVersion,
  readSecureCookies,
  readServerEnvironment,
  readStripeWebhookSecret,
  readSimulateStripeUnreachable,
  readTestSignInEnabled,
} from '../../src/config/environment.ts';

const databaseUrl = 'postgres://palier:palier@localhost:5433/palier';

describe('readServerEnvironment', () => {
  it('defaults to 127.0.0.1:3000 without test sign-in or demo mode', () => {
    expect(readServerEnvironment({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
      host: '127.0.0.1',
      port: 3000,
      testSignInEnabled: false,
      demoMode: false,
      secureCookies: true,
    });
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('reads DEMO_MODE=%s', (rawDemoMode, expected) => {
    expect(readServerEnvironment({ DATABASE_URL: databaseUrl, DEMO_MODE: rawDemoMode }).demoMode).toBe(expected);
  });

  it.each(['1', 'yes', 'TRUE', ''])('refuses DEMO_MODE=%s', (rawDemoMode) => {
    expect(() => readServerEnvironment({ DATABASE_URL: databaseUrl, DEMO_MODE: rawDemoMode })).toThrow(/DEMO_MODE must be/);
  });

  it('reads the minimum app version when it is set', () => {
    expect(readServerEnvironment({ DATABASE_URL: databaseUrl, MINIMUM_APP_VERSION: '1.2.0' }).minimumAppVersion).toBe('1.2.0');
  });

  it('refuses a minimum app version that is not dotted numbers', () => {
    expect(() => readMinimumAppVersion('latest')).toThrow(/MINIMUM_APP_VERSION must look like/);
  });

  it('refuses a port that is not a positive integer', () => {
    expect(() => readServerEnvironment({ DATABASE_URL: databaseUrl, PORT: 'abc' })).toThrow(/PORT must be/);
  });
});

describe('readTestSignInEnabled', () => {
  it.each(['development', 'test'])('enables test sign-in when NODE_ENV is %s', (environment) => {
    expect(readTestSignInEnabled({ NODE_ENV: environment })).toBe(true);
  });

  it.each(['production', 'staging', ''])('disables test sign-in when NODE_ENV is "%s"', (environment) => {
    expect(readTestSignInEnabled({ NODE_ENV: environment })).toBe(false);
  });

  it('disables test sign-in when NODE_ENV is not set', () => {
    expect(readTestSignInEnabled({})).toBe(false);
  });
});

describe('readSecureCookies', () => {
  it('sends cookies over plain http only in development', () => {
    expect(readSecureCookies({ NODE_ENV: 'development' })).toBe(false);
  });

  it.each(['production', 'test', ''])('keeps cookies Secure when NODE_ENV is "%s"', (environment) => {
    expect(readSecureCookies({ NODE_ENV: environment })).toBe(true);
  });

  it('keeps cookies Secure when NODE_ENV is not set', () => {
    expect(readSecureCookies({})).toBe(true);
  });
});

describe('readSimulateStripeUnreachable', () => {
  it.each([{}, { SIMULATE_STRIPE_UNREACHABLE: 'false' }])('keeps Stripe reachable by default (%o)', (variables) => {
    expect(readSimulateStripeUnreachable({ NODE_ENV: 'development', ...variables })).toBe(false);
  });

  it.each(['development', 'test'])('simulates Stripe unreachable when NODE_ENV is %s', (environment) => {
    expect(readSimulateStripeUnreachable({ NODE_ENV: environment, SIMULATE_STRIPE_UNREACHABLE: 'true' })).toBe(true);
  });

  it.each([{ NODE_ENV: 'production' }, {}])('refuses to start with the switch on outside a test environment (%o)', (variables) => {
    expect(() => readSimulateStripeUnreachable({ ...variables, SIMULATE_STRIPE_UNREACHABLE: 'true' })).toThrow(/only allowed/);
  });

  it.each(['1', 'yes', ''])('refuses SIMULATE_STRIPE_UNREACHABLE=%s', (rawSwitch) => {
    expect(() => readSimulateStripeUnreachable({ NODE_ENV: 'development', SIMULATE_STRIPE_UNREACHABLE: rawSwitch })).toThrow(/must be "true" or "false"/);
  });
});

describe('readStripeWebhookSecret', () => {
  it.each([{}, { STRIPE_WEBHOOK_SECRET: '' }])('serves no webhook when the secret is unset (%o)', (variables) => {
    expect(readStripeWebhookSecret(variables)).toBeNull();
  });

  it('reads a whsec_ signing secret', () => {
    expect(readStripeWebhookSecret({ STRIPE_WEBHOOK_SECRET: 'whsec_abc' })).toBe('whsec_abc');
  });

  it.each(['sk_test_abc', 'abc'])('refuses %s, which is not a signing secret', (secret) => {
    expect(() => readStripeWebhookSecret({ STRIPE_WEBHOOK_SECRET: secret })).toThrow(/whsec_/);
  });
});

describe('readDashboardUrl', () => {
  it.each(['development', 'test'])('defaults to the local dashboard when NODE_ENV is %s', (environment) => {
    expect(readDashboardUrl({ NODE_ENV: environment })).toBe('http://localhost:5173');
  });

  it.each([{ NODE_ENV: 'production' }, {}])('has no default outside a test environment (%o)', (variables) => {
    expect(readDashboardUrl(variables)).toBeNull();
  });

  it('keeps only the origin of the address it is given', () => {
    expect(readDashboardUrl({ DASHBOARD_URL: 'https://dashboard.palier.example/some/path?x=1' })).toBe('https://dashboard.palier.example');
  });

  it.each(['not a url', 'javascript:alert(1)', 'ftp://dashboard.example'])('refuses %s', (rawUrl) => {
    expect(() => readDashboardUrl({ DASHBOARD_URL: rawUrl })).toThrow(/http\(s\) address/);
  });
});
