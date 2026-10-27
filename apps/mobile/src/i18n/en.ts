import type { Translations } from './fr';

export const en: Translations = {
  app: {
    crashed: 'Something unexpected went wrong.',
    crashedHint: 'Close and reopen Palier.',
  },
  home: {
    updatedAt: 'Updated %{time}',
    title: 'Parking lots',
    freeSpotsLabel: {
      one: 'free spot',
      other: 'free spots',
    },
    full: 'Full',
    fullAccessibilityLabel: 'Full, 0 free spots',
    loading: 'Loading parking lots',
    empty: 'No parking lot online.',
    emptyHint: 'Pull down to refresh.',
    unreachable: 'Can’t reach Palier.',
    unreachableHint: 'Check your connection, then try again.',
    retry: 'Try again',
    refresh: 'Refresh',
  },
};
