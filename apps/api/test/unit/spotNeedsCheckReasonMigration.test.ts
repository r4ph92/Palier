import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0037_spot_needs_check_reason.sql', import.meta.url), 'utf8');

describe('migration 0037, the time and reason of a spot check flag', () => {
  it('keeps the reasons to the three the code writes', () => {
    expect(migration).toContain(`CREATE TYPE "public"."spot_check_reason" AS ENUM('WRONG_AISLE', 'WRONG_SPOT', 'REPORTED_TAKEN')`);
    expect(migration).toContain('ADD COLUMN "needs_check_reason" "spot_check_reason"');
  });

  it('gives the spots already flagged a time before the constraint that requires one', () => {
    const backfill = migration.indexOf('UPDATE "spot" SET "needs_check_since" = "state_changed_at" WHERE "needs_check"');
    const sinceConstraint = migration.indexOf('CHECK ("spot"."needs_check" = ("spot"."needs_check_since" is not null))');

    expect(backfill).toBeGreaterThan(-1);
    expect(sinceConstraint).toBeGreaterThan(backfill);
  });

  it('allows a reason only on a flagged spot', () => {
    expect(migration).toContain('CHECK ("spot"."needs_check" or "spot"."needs_check_reason" is null)');
  });
});
