import { gateQrLink } from '../domain/entries/gateToken.ts';
import type { TariffPolicy } from '@palier/shared-types';
import { garageRoyLot } from '../seed/fixtures/garageRoy.ts';
import { gateFixtures } from '../seed/fixtures/gates.ts';
import { parkingDemoLot } from '../seed/fixtures/parkingDemo.ts';
import { parkingTestPaliersLot } from '../seed/fixtures/parkingTestPaliers.ts';
import { SEEDED_PRICING_POLICY } from '../seed/fixtures/pricing.ts';

export interface EntryLoadTarget {
  readonly gateName: string;
  readonly lotId: string;
  readonly qrContent: string;
  // The seeded tariff each scan accepts (#151): a lot repriced since the seed answers TARIFF_CHANGED.
  readonly tariff: TariffPolicy;
}

const SEEDED_LOTS = [parkingDemoLot, garageRoyLot, parkingTestPaliersLot];

// The QR printed on a seeded entry terminal, the very content the app sends after a scan.
export function seededEntryGate(gateName: string): EntryLoadTarget {
  const gate = gateFixtures.find(({ name }) => name === gateName);
  if (gate?.id === undefined || gate.kind !== 'ENTRY' || gate.qrSecret === undefined || gate.qrSecret === null) {
    const entryGates = gateFixtures.filter(({ kind }) => kind === 'ENTRY').map(({ name }) => name);
    throw new Error(`"${gateName}" is not a seeded entry gate. Seeded entry gates: ${entryGates.join(', ')}.`);
  }
  return { gateName, lotId: gate.lotId, qrContent: gateQrLink(gate.id, gate.qrSecret), tariff: seededTariffOf(gate.lotId) };
}

function seededTariffOf(lotId: string): TariffPolicy {
  const dailyCapCents = SEEDED_LOTS.find(({ id }) => id === lotId)?.dailyCapCents;
  if (dailyCapCents === undefined || dailyCapCents === null) {
    throw new Error(`The seeded lot ${lotId} has no daily cap.`);
  }
  return { ...SEEDED_PRICING_POLICY, dailyCapCents };
}
