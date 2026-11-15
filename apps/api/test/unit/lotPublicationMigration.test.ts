import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parkingDemoLot } from '../../src/seed/fixtures/parkingDemo.ts';
import { parkingTestPaliersLot } from '../../src/seed/fixtures/parkingTestPaliers.ts';

const migration = readFileSync(new URL('../../drizzle/0041_lot_publication.sql', import.meta.url), 'utf8');

describe('migration 0041, the operator’s Wi-Fi and cellular attestations', () => {
  it.each(['wifi', 'cell'])('gives a %s measurement taken before #68 its note before the constraint that requires one', (kind) => {
    const backfill = migration.indexOf(`UPDATE "parking_lot" SET "${kind}_note" =`);
    const constraint = migration.indexOf(`CHECK (("parking_lot"."${kind}_verified_at" is null) = ("parking_lot"."${kind}_note" is null))`);

    expect(backfill).toBeGreaterThan(-1);
    expect(constraint).toBeGreaterThan(backfill);
  });

  it.each([parkingDemoLot, parkingTestPaliersLot])('seeds $name with a note beside each measured date', (lot) => {
    expect(lot.wifiVerifiedAt).toBeInstanceOf(Date);
    expect(lot.wifiNote).toEqual(expect.any(String));
    expect(lot.cellVerifiedAt).toBeInstanceOf(Date);
    expect(lot.cellNote).toEqual(expect.any(String));
  });
});
