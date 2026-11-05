import { describe, expect, it } from 'vitest';
import { databaseUrlAllowedForSeeding } from '../../src/seed/seedGuard.ts';

const localUrl = 'postgres://palier:palier@localhost:5433/palier';

describe('databaseUrlAllowedForSeeding', () => {
  it.each(['development', 'test'])('allows a local database in %s', (environment) => {
    expect(databaseUrlAllowedForSeeding({ NODE_ENV: environment, DATABASE_URL: localUrl })).toBe(localUrl);
  });

  it.each(['127.0.0.1', '[::1]'])('allows %s', (host) => {
    const url = `postgres://palier:palier@${host}:5433/palier`;

    expect(databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: url })).toBe(url);
  });

  it.each([undefined, 'production', 'staging'])('refuses NODE_ENV %s', (environment) => {
    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: environment, DATABASE_URL: localUrl })).toThrow(
      /NODE_ENV must be development or test/,
    );
  });

  it('refuses a remote database host', () => {
    const remoteUrl = 'postgres://palier:palier@db.example.com:5432/palier';

    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: remoteUrl })).toThrow(
      /must be one of localhost, 127.0.0.1, \[::1\]/,
    );
  });

  it('refuses when DATABASE_URL is missing', () => {
    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL is not set/);
  });
});
