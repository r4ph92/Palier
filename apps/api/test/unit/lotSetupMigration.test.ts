import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { garageRoyLot } from '../../src/seed/fixtures/garageRoy.ts';
import { parkingDemoLot } from '../../src/seed/fixtures/parkingDemo.ts';
import { parkingTestPaliersLot } from '../../src/seed/fixtures/parkingTestPaliers.ts';

const migration = readFileSync(new URL('../../drizzle/0034_lot_setup.sql', import.meta.url), 'utf8');
const SEQUENCE_START = 4;

describe('migration 0034, lot setup', () => {
  it('hands out 16-bit beacon majors from a sequence that starts after every major already taken', () => {
    expect(migration).toContain(`MAXVALUE 65535 START WITH ${SEQUENCE_START}`);
    expect(migration).toContain(`setval('parking_lot_beacon_major_seq', greatest((SELECT max("beacon_major") FROM "parking_lot"), 3) + 1, false)`);
    expect(migration).toContain(`ALTER COLUMN "beacon_major" SET DEFAULT nextval('parking_lot_beacon_major_seq')`);
  });

  it('keeps the seeded majors below the sequence, so a seed never collides with a created lot', () => {
    const seededMajors = [parkingDemoLot, garageRoyLot, parkingTestPaliersLot].map(({ beaconMajor }) => beaconMajor);

    expect(seededMajors).toEqual([1, 2, 3]);
  });

  it('lets a lot exist without pricing, but never half priced and never online', () => {
    expect(migration).toContain(`ALTER COLUMN "daily_cap_cents" DROP NOT NULL`);
    expect(migration).toContain(`CHECK (("parking_lot"."pricing_policy" is null) = ("parking_lot"."daily_cap_cents" is null))`);
    expect(migration).toContain(`CHECK ((not "parking_lot"."is_online") or "parking_lot"."pricing_policy" is not null)`);
    expect(migration).toContain(`CHECK ("parking_lot"."daily_cap_cents" > 0)`);
  });

  it('gives every lot a hold quota of 3 within 0 to 50', () => {
    expect(migration).toContain(`ADD COLUMN "hold_quota" integer DEFAULT 3 NOT NULL`);
    expect(migration).toContain(`CHECK ("parking_lot"."hold_quota" between 0 and 50)`);
  });

  it('adds the address to the lots already there before requiring it', () => {
    expect(migration).toContain(`ADD COLUMN "address" text DEFAULT '' NOT NULL`);
    expect(migration).toContain(`ALTER COLUMN "address" DROP DEFAULT`);
  });
});
