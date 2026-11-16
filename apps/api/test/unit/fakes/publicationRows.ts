import type { PublicationFactsRow } from '../../../src/infrastructure/postgres/lotPublicationRows.ts';
import { entreeNord, sortieNord } from './publicationFixtures.ts';

// Garage Roy Nord as the checklist statement reads it once every prerequisite is met; the gates' instants carry Montréal's offset.
export function readyGarageRoyNordRow(change: Partial<PublicationFactsRow> = {}): PublicationFactsRow {
  return {
    lot_name: 'Garage Roy Nord',
    is_online: false,
    kyc_status: 'VERIFIED',
    daily_cap_cents: 2500,
    capacity: 4,
    in_service_spot_count: 4,
    wifi_measured_on: '2026-11-12',
    wifi_note: 'Signal mesuré aux niveaux P1 et P2.',
    cell_measured_on: '2026-11-12',
    cell_note: 'Quatre barres aux deux bornes.',
    gates: [
      { id: entreeNord.id, name: entreeNord.name, kind: 'ENTRY', verified_at: '2026-11-14T10:30:00-05:00' },
      { id: sortieNord.id, name: sortieNord.name, kind: 'EXIT', verified_at: '2026-11-14T10:30:00-05:00' },
    ],
    ...change,
  };
}
