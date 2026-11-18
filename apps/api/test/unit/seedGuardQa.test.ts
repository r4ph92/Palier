import { describe, expect, it } from 'vitest';
import { databaseUrlAllowedForSeeding } from '../../src/seed/seedGuard.ts';

function guardAllows(databaseUrl: string): boolean {
  try {
    databaseUrlAllowedForSeeding({ NODE_ENV: 'development', DATABASE_URL: databaseUrl });
    return true;
  } catch {
    return false;
  }
}

describe('the seed guard against hosts written in unusual ways', () => {
  it.each(['LocalHost', 'LOCALHOST', '127.0.0.1', '[::1]', '[0:0:0:0:0:0:0:1]'])('allows the local host %s', (host) => {
    expect(guardAllows(`postgres://palier:palier@${host}:5433/palier`)).toBe(true);
  });

  it.each([
    'localhost.',
    'localhost.example.com',
    '%6Cocalhost',
    'db.example.com,localhost',
    'localhost,db.example.com',
    '127.1',
  ])('refuses the host %s', (host) => {
    expect(guardAllows(`postgres://palier:palier@${host}:5433/palier`)).toBe(false);
  });

  it('refuses a second, remote host written after the local port', () => {
    expect(guardAllows('postgres://palier:palier@localhost:5433,db.example.com:5432/palier')).toBe(false);
  });
});
