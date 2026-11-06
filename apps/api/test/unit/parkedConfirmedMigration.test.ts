import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0017_parked_confirmed.sql', import.meta.url), 'utf8');
const ACTIVE_PREDICATE = "WHERE state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED')";

function createdIndex(indexName: string): string | undefined {
  return migration.split('\n').find((line) => line.startsWith(`CREATE UNIQUE INDEX "${indexName}"`));
}

// Run on palier_21 by npm run db:migrate; this only guards the hand-written parts against a regeneration.
describe('migration 0017, the wrong-aisle question states', () => {
  it('recreates the enum instead of adding values, which the indexes could not use in the same transaction', () => {
    expect(migration).not.toContain('ADD VALUE');
    expect(migration).toContain(`AS ENUM('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED', 'CANCELLED')`);
  });

  it('drops the state default before the cast and restores it after', () => {
    const dropDefault = migration.indexOf('ALTER COLUMN "state" DROP DEFAULT');
    const cast = migration.indexOf('ALTER COLUMN "state" TYPE');
    const setDefault = migration.indexOf(`ALTER COLUMN "state" SET DEFAULT 'CREATED'`);

    expect(dropDefault).toBeGreaterThan(-1);
    expect(cast).toBeGreaterThan(dropDefault);
    expect(setDefault).toBeGreaterThan(cast);
  });

  it.each(['parked_aisle_id" uuid;', 'confirmed_spot_id" uuid;', 'parked_answered_at" timestamp with time zone;'])('adds the nullable column %s', (column) => {
    expect(migration).toContain(`ADD COLUMN "${column}`);
  });

  it.each([
    ['parking_session_confirmed_spot_in_same_lot_fk', '("confirmed_spot_id","lot_id") REFERENCES "public"."spot"("id","lot_id")'],
    ['parking_session_parked_aisle_in_same_lot_fk', '("parked_aisle_id","lot_id") REFERENCES "public"."aisle"("id","lot_id")'],
  ])('keeps %s inside the session lot', (constraint, reference) => {
    expect(migration).toContain(`"${constraint}" FOREIGN KEY ${reference}`);
  });

  it('compares the state as text in its checks, so a later enum recreation can cast the column', () => {
    expect(migration).toContain(`"state"::text <> 'PARKED_UNCONFIRMED' or "parking_session"."parked_aisle_id" is not null`);
    expect(migration).toContain(`"state"::text <> 'PARKED_CONFIRMED' or ("parking_session"."confirmed_spot_id" is not null and "parking_session"."parked_answered_at" is not null)`);
  });

  it.each(['parking_session_one_active_per_user_index', 'parking_session_one_active_per_spot_index'])(
    'drops %s and recreates it over the five active states',
    (indexName) => {
      expect(migration).toContain(`DROP INDEX "${indexName}"`);
      expect(createdIndex(indexName)).toContain(ACTIVE_PREDICATE);
    },
  );

  it('lets one active session at most claim a confirmed spot', () => {
    expect(createdIndex('parking_session_one_active_per_confirmed_spot_index')).toContain(`("confirmed_spot_id") ${ACTIVE_PREDICATE}`);
  });

  it('creates the indexes after the enum is recreated', () => {
    expect(migration.indexOf('CREATE UNIQUE INDEX')).toBeGreaterThan(migration.indexOf('DROP TYPE'));
  });
});
