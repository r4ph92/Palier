import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parkingDemoAisles, parkingDemoLevels } from '../../src/seed/fixtures/parkingDemo.ts';
import { parkingTestPaliersAisles, parkingTestPaliersLevels } from '../../src/seed/fixtures/parkingTestPaliers.ts';

const migration = readFileSync(new URL('../../drizzle/0035_aisle_minor_and_exit_lane.sql', import.meta.url), 'utf8');
const seededLevels = [...parkingDemoLevels, ...parkingTestPaliersLevels];
const seededAisles = [...parkingDemoAisles, ...parkingTestPaliersAisles];

describe('migration 0035, aisle minors and exit lanes', () => {
  it('gives the exit lane minor 0 and every other aisle a minor from 1 to 65535', () => {
    expect(migration).toContain(
      `ADD CONSTRAINT "aisle_beacon_minor_matches_lane" CHECK (("aisle"."is_exit_lane" and "aisle"."beacon_minor" = 0) or (not "aisle"."is_exit_lane" and "aisle"."beacon_minor" between 1 and 65535))`,
    );
  });

  it('adds Sortie on the first level of a lot without an exit lane, before the check applies', () => {
    const backfill = migration.indexOf('INSERT INTO "aisle"');

    expect(backfill).toBeGreaterThanOrEqual(0);
    expect(backfill).toBeLessThan(migration.indexOf('ADD CONSTRAINT'));
    expect(migration).toContain(`SELECT DISTINCT ON ("level"."lot_id") "level"."id", "level"."lot_id", 'Sortie', 0, true`);
    expect(migration).toContain(`WHERE NOT EXISTS (SELECT 1 FROM "aisle" WHERE "aisle"."lot_id" = "level"."lot_id" AND "aisle"."is_exit_lane")`);
    expect(migration).toContain(`ORDER BY "level"."lot_id", "level"."display_order", "level"."code";`);
  });

  it('stops the migration on any conflict, so no lot is left without its exit lane', () => {
    expect(migration).not.toMatch(/ON CONFLICT/i);
  });

  it('seeds exactly one exit lane, with minor 0, in every lot that has levels', () => {
    const lotsWithLevels = [...new Set(seededLevels.map(({ lotId }) => lotId))];

    for (const lotId of lotsWithLevels) {
      const exitLanes = seededAisles.filter((aisle) => aisle.lotId === lotId && aisle.isExitLane === true);
      expect(exitLanes.map(({ code, beaconMinor }) => [code, beaconMinor])).toEqual([['Sortie', 0]]);
    }
  });

  it('seeds every other aisle with a minor the check accepts', () => {
    const minors = seededAisles.filter(({ isExitLane }) => isExitLane !== true).map(({ beaconMinor }) => beaconMinor);

    expect(minors.every((minor) => minor >= 1 && minor <= 65535)).toBe(true);
  });
});
