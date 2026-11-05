import { gateQrLink } from '../domain/entries/gateToken.ts';
import { gateFixtures } from '../seed/fixtures/gates.ts';

export interface EntryLoadTarget {
  readonly gateName: string;
  readonly lotId: string;
  readonly qrContent: string;
}

// The QR printed on a seeded entry terminal, the very content the app sends after a scan.
export function seededEntryGate(gateName: string): EntryLoadTarget {
  const gate = gateFixtures.find(({ name }) => name === gateName);
  if (gate?.id === undefined || gate.kind !== 'ENTRY' || gate.qrSecret === undefined || gate.qrSecret === null) {
    const entryGates = gateFixtures.filter(({ kind }) => kind === 'ENTRY').map(({ name }) => name);
    throw new Error(`"${gateName}" is not a seeded entry gate. Seeded entry gates: ${entryGates.join(', ')}.`);
  }
  return { gateName, lotId: gate.lotId, qrContent: gateQrLink(gate.id, gate.qrSecret) };
}
