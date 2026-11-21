import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0047_parked_asked_at.sql', import.meta.url), 'utf8');

// This only guards the hand-written backfill and its order against a regeneration.
describe('migration 0047, the instant the question was asked', () => {
  it('adds parked_asked_at as a nullable instant', () => {
    expect(migration).toMatch(/ADD COLUMN "parked_asked_at" timestamp with time zone;/);
  });

  it('dates every question already asked, the sessions with an aisle to answer about, at their parked time', () => {
    expect(migration).toContain(`SET "parked_asked_at" = "parked_at" WHERE "parked_aisle_id" IS NOT NULL`);
  });

  it('fills the column before the check requires it on every unanswered question', () => {
    const backfill = migration.indexOf('SET "parked_asked_at"');
    const check = migration.indexOf('ADD CONSTRAINT "parking_session_unconfirmed_has_question"');

    expect(backfill).toBeGreaterThan(migration.indexOf('ADD COLUMN'));
    expect(check).toBeGreaterThan(backfill);
    expect(migration).toContain(`"state"::text <> 'PARKED_UNCONFIRMED' or "parking_session"."parked_asked_at" is not null`);
  });
});
