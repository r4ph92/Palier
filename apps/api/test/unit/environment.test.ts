import { describe, expect, it } from 'vitest';
import { readServerEnvironment } from '../../src/config/environment.ts';

const databaseUrl = 'postgres://palier:palier@localhost:5433/palier';

describe('readServerEnvironment', () => {
  it('defaults to 127.0.0.1:3000', () => {
    expect(readServerEnvironment({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
      host: '127.0.0.1',
      port: 3000,
      demoMode: false,
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

  it('refuses a port that is not a positive integer', () => {
    expect(() => readServerEnvironment({ DATABASE_URL: databaseUrl, PORT: 'abc' })).toThrow(/PORT must be/);
  });
});
