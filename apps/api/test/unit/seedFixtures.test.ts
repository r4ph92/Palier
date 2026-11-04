import { describe, expect, it } from 'vitest';
import { isSignedWith, readGateToken } from '../../src/domain/entries/gateToken.ts';
import { AMELIE_LAVOIE_ID, JULIE_TREMBLAY_ID, NADIA_BOUCHARD_ID } from '../../src/config/testPersonas.ts';
import { ENTREE_DEMO_ID, gateFixtures, seededQrLinks } from '../../src/seed/fixtures/gates.ts';
import { parsePricingPolicy } from '../../src/domain/pricing/PricingPolicy.ts';
import { garageRoyLot } from '../../src/seed/fixtures/garageRoy.ts';
import { parkingDemoLot } from '../../src/seed/fixtures/parkingDemo.ts';
import { parkingTestPaliersLot, parkingTestPaliersSpots } from '../../src/seed/fixtures/parkingTestPaliers.ts';
import { vehicleFixtures } from '../../src/seed/fixtures/vehicles.ts';

describe('seeded entry fixtures', () => {
  it('prints one QR link per gate, each signed with that gate secret', () => {
    const links = seededQrLinks();

    expect(links.map(({ gateName }) => gateName)).toEqual(['Entrée Démo', 'Sortie Démo', 'Entrée Roy', 'Entrée Paliers']);
    for (const { gateName, link } of links) {
      const gate = gateFixtures.find(({ name }) => name === gateName);
      const token = readGateToken(link);
      expect(token?.gateId).toBe(gate?.id);
      expect(token !== null && isSignedWith(token, gate?.qrSecret ?? null)).toBe(true);
    }
  });

  it('prints the same Entrée Démo link at every seed', () => {
    expect(seededQrLinks()[0]?.link).toMatch(new RegExp(`^https://palier\\.app/q/palier1\\.${ENTREE_DEMO_ID}\\.`));
    expect(seededQrLinks()[0]).toEqual(seededQrLinks()[0]);
  });

  it('seeds Parking Test Paliers with the spots of the allocation scenario', () => {
    expect(parkingTestPaliersSpots.map(({ number, distanceToExit, state }) => [number, distanceToExit, state ?? 'AVAILABLE'])).toEqual([
      ['A-1', 5, 'OCCUPIED'],
      ['A-2', 10, 'AVAILABLE'],
      ['C-1', 10, 'AVAILABLE'],
      ['C-2', 5, 'AVAILABLE'],
      ['C-3', 15, 'AVAILABLE'],
      ['D-1', 5, 'AVAILABLE'],
    ]);
  });

  it('gives Julie ABC 123 in Québec as her default vehicle and Nadia none', () => {
    expect(vehicleFixtures.filter(({ userId }) => userId === JULIE_TREMBLAY_ID)).toEqual([
      {
        userId: JULIE_TREMBLAY_ID,
        plate: 'ABC 123',
        plateKey: 'ABC123',
        province: 'QC',
        isDefault: true,
        isElectric: false,
        hasAccessiblePermit: false,
        isOversize: false,
      },
    ]);
    expect(vehicleFixtures.some(({ userId }) => userId === NADIA_BOUCHARD_ID)).toBe(false);
  });

  it('gives Amélie EVA 001 as an electric car with an accessible parking permit', () => {
    expect(vehicleFixtures.filter(({ userId }) => userId === AMELIE_LAVOIE_ID)).toEqual([
      expect.objectContaining({ plate: 'EVA 001', isElectric: true, hasAccessiblePermit: true, isOversize: false }),
    ]);
  });

  it.each([parkingDemoLot, garageRoyLot, parkingTestPaliersLot])('prices $name at 0,75 $ per started 15 minutes, capped at 25,00 $', (lot) => {
    expect(parsePricingPolicy(lot.pricingPolicy, lot.dailyCapCents)).toEqual({ incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 });
  });
});
