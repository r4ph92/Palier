import type { Translations } from './fr';
import { UNREACHABLE } from './sharedEn';

export const exitEn: Translations['session']['exit'] = {
  action: 'Open the exit barrier',
  opening: 'Opening…',
  beaconFallback: 'Tap "Open" to leave',
  unreachable: UNREACHABLE,
  pending: { title: 'Barrier open — your receipt will follow' },
  receipt: {
    eyebrow: 'Receipt',
    title: 'Exit barrier open',
    durationLead: 'Duration ',
    totalLead: 'Total ',
    capped: 'Daily cap',
    total: 'Total',
    firstDay: 'First 24 hours',
    nextDay: 'Next 24 hours',
    extra: '%{duration} extra',
    capNote: '(cap)',
    unpaid: 'Unpaid balance',
    lineAmount: '%{label}: %{amount}',
    done: 'Done',
  },
};
