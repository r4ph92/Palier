import { describe, expect, it } from 'vitest';
import { readServerEnvironment, readTestSignInEnabled } from '../../src/config/environment.ts';

const databaseUrl = 'postgres://palier:palier@localhost:5433/palier';

describe('readServerEnvironment', () => {
  it('defaults to 127.0.0.1:3000 without test sign-in', () => {
    expect(readServerEnvironment({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
      host: '127.0.0.1',
      port: 3000,
      testSignInEnabled: false,
    });
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
