import { describe, expect, it } from 'vitest';
import { isSignedWith, readGateToken } from '../../src/domain/entries/gateToken.ts';
import { JULIE_TREMBLAY_ID, NADIA_BOUCHARD_ID } from '../../src/config/testPersonas.ts';
import { ENTREE_DEMO_ID, gateFixtures, seededQrLinks } from '../../src/seed/fixtures/gates.ts';
import { vehicleFixtures } from '../../src/seed/fixtures/vehicles.ts';

describe('seeded entry fixtures', () => {
  it('prints one QR link per gate, each signed with that gate secret', () => {
    const links = seededQrLinks();

    expect(links.map(({ gateName }) => gateName)).toEqual(['Entrée Démo', 'Sortie Démo', 'Entrée Roy']);
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

  it('gives Julie ABC 123 in Québec as her default vehicle and Nadia none', () => {
    expect(vehicleFixtures.filter(({ userId }) => userId === JULIE_TREMBLAY_ID)).toEqual([
      { userId: JULIE_TREMBLAY_ID, plate: 'ABC 123', plateKey: 'ABC123', province: 'QC', isDefault: true },
    ]);
    expect(vehicleFixtures.some(({ userId }) => userId === NADIA_BOUCHARD_ID)).toBe(false);
  });
});
