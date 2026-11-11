import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0031_presumed_by.sql', import.meta.url), 'utf8');

// This only guards the hand-written backfill and its order against a regeneration.
describe('migration 0031, the evidence of a presumption', () => {
  it('creates the evidence enum with the walk and the timeout', () => {
    expect(migration).toContain(`CREATE TYPE "public"."parking_session_presumption" AS ENUM('WALK', 'TIMEOUT')`);
  });

  it('adds presumed_by as a nullable column', () => {
    expect(migration).toMatch(/ADD COLUMN "presumed_by" "parking_session_presumption";/);
  });

  it('marks the sessions already presumed as walked before the check requires an evidence', () => {
    const backfill = migration.indexOf(`SET "presumed_by" = 'WALK' WHERE "state" = 'PARKED_PRESUMED'`);
    const check = migration.indexOf('ADD CONSTRAINT "parking_session_presumed_has_evidence"');

    expect(backfill).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(backfill);
  });

  it('requires an evidence on every presumed session', () => {
    expect(migration).toContain(`"state"::text <> 'PARKED_PRESUMED' or "parking_session"."presumed_by" is not null`);
  });
});
