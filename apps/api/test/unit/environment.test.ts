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
      entryCancellation: { confirmationWindowSeconds: 60, cancellationPeriodSeconds: 30 },
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

describe('entry cancellation timing', () => {
  function timingOf(variables: NodeJS.ProcessEnv) {
    return readServerEnvironment({ DATABASE_URL: databaseUrl, ...variables }).entryCancellation;
  }

  it('reads the confirmation window and the cancellation period in seconds', () => {
    expect(timingOf({ ENTRY_CONFIRMATION_WINDOW_SECONDS: '45', ENTRY_CANCELLATION_PERIOD_SECONDS: '15' })).toEqual({
      confirmationWindowSeconds: 45,
      cancellationPeriodSeconds: 15,
    });
  });

  it.each(['abc', '0', '-5', '1.5'])('refuses a window of "%s"', (rawSeconds) => {
    expect(() => timingOf({ ENTRY_CONFIRMATION_WINDOW_SECONDS: rawSeconds })).toThrow(/ENTRY_CONFIRMATION_WINDOW_SECONDS must be a positive whole number/);
  });

  it('refuses a window under 30 seconds, shorter than an entry still being admitted', () => {
    expect(() => timingOf({ ENTRY_CONFIRMATION_WINDOW_SECONDS: '29', ENTRY_CANCELLATION_PERIOD_SECONDS: '10' })).toThrow(/must be at least 30/);
  });

  it('accepts a window of exactly 30 seconds', () => {
    expect(timingOf({ ENTRY_CONFIRMATION_WINDOW_SECONDS: '30', ENTRY_CANCELLATION_PERIOD_SECONDS: '10' }).confirmationWindowSeconds).toBe(30);
  });

  it('refuses a period longer than the window', () => {
    expect(() => timingOf({ ENTRY_CONFIRMATION_WINDOW_SECONDS: '40', ENTRY_CANCELLATION_PERIOD_SECONDS: '41' })).toThrow(/must not exceed the confirmation window/);
  });

  it('refuses a window plus period above 110 seconds, after the app stops polling the entry', () => {
    expect(() => timingOf({ ENTRY_CONFIRMATION_WINDOW_SECONDS: '80', ENTRY_CANCELLATION_PERIOD_SECONDS: '31' })).toThrow(/must not exceed 110, got 111/);
  });

  it('accepts a window plus period of exactly 110 seconds', () => {
    expect(timingOf({ ENTRY_CONFIRMATION_WINDOW_SECONDS: '80', ENTRY_CANCELLATION_PERIOD_SECONDS: '30' }).cancellationPeriodSeconds).toBe(30);
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
