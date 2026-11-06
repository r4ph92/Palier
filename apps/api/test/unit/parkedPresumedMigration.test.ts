import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0016_parked_presumed.sql', import.meta.url), 'utf8');
const ACTIVE_PREDICATE = "WHERE state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED')";

// Run on palier_18 by npm run db:migrate; this only guards the hand-written parts against a regeneration.
describe('migration 0016, the parked-presumed state', () => {
  it('recreates the enum instead of adding a value, which the indexes could not use in the same transaction', () => {
    expect(migration).not.toContain('ADD VALUE');
    expect(migration).toContain(`AS ENUM('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'CANCELLED')`);
  });

  it('drops the state default before the cast and restores it after', () => {
    const dropDefault = migration.indexOf('ALTER COLUMN "state" DROP DEFAULT');
    const cast = migration.indexOf('ALTER COLUMN "state" TYPE');
    const setDefault = migration.indexOf(`ALTER COLUMN "state" SET DEFAULT 'CREATED'`);

    expect(dropDefault).toBeGreaterThan(-1);
    expect(cast).toBeGreaterThan(dropDefault);
    expect(setDefault).toBeGreaterThan(cast);
  });

  it('adds parked_at as a nullable instant', () => {
    expect(migration).toContain('ADD COLUMN "parked_at" timestamp with time zone;');
  });

  it.each(['parking_session_one_active_per_user_index', 'parking_session_one_active_per_spot_index'])(
    'drops %s and recreates it over the three active states',
    (indexName) => {
      expect(migration).toContain(`DROP INDEX "${indexName}"`);
      const created = migration.split('\n').find((line) => line.startsWith(`CREATE UNIQUE INDEX "${indexName}"`));
      expect(created).toContain(ACTIVE_PREDICATE);
    },
  );
});
