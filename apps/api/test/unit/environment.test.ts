import { describe, expect, it } from 'vitest';
import { readMinimumAppVersion, readSecureCookies, readServerEnvironment, readTestSignInEnabled } from '../../src/config/environment.ts';

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
