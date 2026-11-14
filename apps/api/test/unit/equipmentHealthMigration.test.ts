import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gateFixtures } from '../../src/seed/fixtures/gates.ts';

const migration = readFileSync(new URL('../../drizzle/0036_equipment_health.sql', import.meta.url), 'utf8');

describe('migration 0036, gate heartbeats and beacon batteries', () => {
  it('adds the last heartbeat as a nullable instant, so every existing gate starts never heard', () => {
    expect(migration).toContain('ALTER TABLE "gate" ADD COLUMN "last_heartbeat_at" timestamp with time zone;');
  });

  it('keeps a battery reading between 0 and 100 percent', () => {
    expect(migration).toContain('ALTER TABLE "aisle" ADD COLUMN "beacon_battery_percent" smallint;');
    expect(migration).toContain(`ADD CONSTRAINT "aisle_beacon_battery_percent_range" CHECK ("aisle"."beacon_battery_percent" between 0 and 100)`);
  });

  it('stores a percent and its instant together or not at all', () => {
    expect(migration).toContain('ALTER TABLE "aisle" ADD COLUMN "beacon_battery_reported_at" timestamp with time zone;');
    expect(migration).toContain(
      `ADD CONSTRAINT "aisle_beacon_battery_reading_complete" CHECK (("aisle"."beacon_battery_percent" is null) = ("aisle"."beacon_battery_reported_at" is null))`,
    );
  });

  it('seeds no heartbeat, so a fresh demo admits entries before the console starts', () => {
    expect(gateFixtures.every((gate) => gate.lastHeartbeatAt === undefined)).toBe(true);
  });
});
