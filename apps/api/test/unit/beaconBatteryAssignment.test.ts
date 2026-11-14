import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { beaconBatteryAssignment } from '../../src/infrastructure/postgres/beaconBatteryAssignment.ts';

describe('the set clause of a beacon battery reading', () => {
  it('writes the percent and its server stamp together, both as parameters', () => {
    const reportedAt = new Date('2026-11-13T19:05:00Z');

    const query = new PgDialect().sqlToQuery(sql`update aisle set ${beaconBatteryAssignment({ percent: 15, reportedAt })}`);

    expect(query.sql).toBe('update aisle set beacon_battery_percent = $1, beacon_battery_reported_at = $2::timestamptz');
    expect(query.params).toEqual([15, reportedAt.toISOString()]);
  });
});
