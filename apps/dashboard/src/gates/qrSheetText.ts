import type { GateKind } from '@palier/shared-types';

// The printed sheet hangs at the gate for every driver: French first, then English, whatever the dashboard's language.
export const QR_SHEET_TEXT = {
  kinds: { ENTRY: { fr: 'Entrée', en: 'Entry' }, EXIT: { fr: 'Sortie', en: 'Exit' } } satisfies Record<GateKind, { fr: string; en: string }>,
  scan: { fr: 'Scannez avec l’app Palier', en: 'Scan with the Palier app' },
  qrName: 'QR Palier',
};
