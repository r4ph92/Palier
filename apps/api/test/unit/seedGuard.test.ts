import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('allows a local host written in capitals', () => {
    const url = 'postgres://palier:palier@LOCALHOST:5433/palier';

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

  it('allows the work lanes on port 5434', () => {
    const url = 'postgres://palier:palier@localhost:5434/palier';

    expect(databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: url })).toBe(url);
  });

  it('refuses a host list that hides a remote first host behind a local one', () => {
    const url = 'postgres://u:p@db.example.com,@localhost:5433/palier';

    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: url })).toThrow(
      /got "db\.example\.com, @localhost"/,
    );
  });

  it.each([
    ['postgres://u:p@localhost,db.example.com/palier', 'db.example.com'],
    ['postgres://u:p@db.example.com,localhost/palier', 'db.example.com'],
    ['postgres://u:p@127.0.0.1:5433,10.0.0.5:5432/palier', '10.0.0.5'],
    ['postgres://u:p@10.0.0.5:5432,127.0.0.1:5433/palier', '10.0.0.5'],
  ])('refuses %s and names %s', (url, remoteHost) => {
    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: url })).toThrow(
      `got "${remoteHost}"`,
    );
  });

  it.each(['host', 'hostaddr'])('refuses a remote host passed as ?%s', (parameter) => {
    const url = `postgres://palier:palier@localhost:5433/palier?${parameter}=db.example.com`;

    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: url })).toThrow(
      'got "db.example.com"',
    );
  });

  it('allows a local host passed as ?host', () => {
    const url = 'postgres://palier:palier@localhost:5433/palier?host=127.0.0.1';

    expect(databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: url })).toBe(url);
  });

  it('refuses a host that makes postgres-js open a Unix socket', () => {
    const url = 'postgres://a@localhost:%2Ftmp%2Fsock,localhost:@localhost:5433/palier';

    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: url })).toThrow(/\.s\.PGSQL\.5433/);
  });

  describe('with PGHOST set', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('refuses a URL without a host when PGHOST is remote', () => {
      vi.stubEnv('PGHOST', 'db.example.com');

      expect(() =>
        databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: 'postgres:///palier' }),
      ).toThrow('got "db.example.com"');
    });

    it('refuses a PGHOST that hides a Unix socket behind localhost', () => {
      vi.stubEnv('PGHOST', 'localhost:/tmp/evil');

      expect(() =>
        databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: 'postgres:///palier' }),
      ).toThrow('/tmp/evil');
    });

    it('allows a local URL, which PGHOST does not override', () => {
      vi.stubEnv('PGHOST', 'db.example.com');

      expect(databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: localUrl })).toBe(localUrl);
    });
  });

  it('still refuses production with a local address', () => {
    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'production', DATABASE_URL: localUrl })).toThrow(
      /NODE_ENV must be development or test/,
    );
  });

  it('refuses when DATABASE_URL is missing', () => {
    expect(() => databaseUrlAllowedForSeeding({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL is not set/);
  });
});
