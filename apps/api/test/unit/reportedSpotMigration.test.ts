import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0019_reported_spot.sql', import.meta.url), 'utf8');
const SESSION_UNIQUE = 'ADD CONSTRAINT "parking_session_id_lot_id_unique" UNIQUE("id","lot_id")';
const SESSION_FOREIGN_KEY =
  '"parking_session_reported_spot_session_in_same_lot_fk" FOREIGN KEY ("session_id","lot_id") REFERENCES "public"."parking_session"("id","lot_id")';

// Run on palier_23 by npm run db:migrate; this only guards the hand-ordered parts against a regeneration.
describe('migration 0019, the spots a driver reported taken (story #23)', () => {
  it('keys each report by session and spot, so a spot reported twice is one row', () => {
    expect(migration).toContain('CONSTRAINT "parking_session_reported_spot_pk" PRIMARY KEY("session_id","spot_id")');
  });

  it('makes the session id and lot unique together, which the reported spot foreign key needs', () => {
    expect(migration).toContain(SESSION_UNIQUE);
  });

  it('adds that unique constraint before the foreign key that references it', () => {
    expect(migration.indexOf(SESSION_UNIQUE)).toBeLessThan(migration.indexOf(SESSION_FOREIGN_KEY));
  });

  it.each([
    ['the session', SESSION_FOREIGN_KEY],
    ['the spot', '"parking_session_reported_spot_spot_in_same_lot_fk" FOREIGN KEY ("spot_id","lot_id") REFERENCES "public"."spot"("id","lot_id")'],
  ])('keeps %s inside the same lot', (_case, foreignKey) => {
    expect(migration).toContain(foreignKey);
  });
});
