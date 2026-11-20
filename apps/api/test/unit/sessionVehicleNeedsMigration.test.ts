import { readFileSync } from 'node:fs';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/0046_session_vehicle_needs.sql', import.meta.url), 'utf8');
const backfill = migration.slice(migration.indexOf('UPDATE "parking_session"'));

describe('migration 0046, vehicle needs frozen on the session', () => {
  it.each(['is_electric', 'has_accessible_permit', 'is_oversize'])('adds %s as a required flag that starts standard', (column) => {
    expect(migration).toContain(`ALTER TABLE "parking_session" ADD COLUMN "${column}" boolean DEFAULT false NOT NULL;`);
  });

  it('fills the columns only after adding them', () => {
    expect(migration.indexOf('UPDATE "parking_session"')).toBeGreaterThan(migration.lastIndexOf('ADD COLUMN'));
  });

  it("copies each need from the session's own vehicle", () => {
    expect(backfill).toContain('"is_electric" = "vehicle"."is_electric"');
    expect(backfill).toContain('"has_accessible_permit" = "vehicle"."has_accessible_permit"');
    expect(backfill).toContain('"is_oversize" = "vehicle"."is_oversize"');
    expect(backfill).toContain('WHERE "vehicle"."id" = "session"."vehicle_id"');
  });

  it('leaves a session whose vehicle was deleted standard, since the join finds no vehicle', () => {
    expect(backfill).toContain('FROM "vehicle"');
    expect(backfill).not.toMatch(/left join/i);
  });

  it('fills exactly the open sessions, so a closed session keeps no needs it never used', () => {
    const states = ACTIVE_ENTRY_SESSION_STATES.map((state) => `'${state}'`).join(', ');
    expect(backfill).toContain(`"session"."state" in (${states})`);
  });
});
