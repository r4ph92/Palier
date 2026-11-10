import type { Translations } from './fr';
import { UNREACHABLE } from './sharedEn';

export const exitEn: Translations['session']['exit'] = {
  action: 'Open the exit barrier',
  opening: 'Opening…',
  unreachable: UNREACHABLE,
  pending: { title: 'Barrier open — your receipt will follow' },
  receipt: {
    eyebrow: 'Receipt',
    title: 'Exit barrier open',
    durationLead: 'Duration ',
    totalLead: 'Total ',
    capped: 'Daily cap',
    done: 'Done',
  },
};
