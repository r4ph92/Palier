import type { Translations } from './fr';

export const en: Translations = {
  app: {
    crashed: 'Something unexpected went wrong.',
    crashedHint: 'Close and reopen Palier.',
  },
  home: {
    greeting: 'Hello %{firstName}',
    updatedAt: 'Updated %{time}',
    title: 'Parking lots',
    freeSpotsLabel: {
      one: 'free spot',
      other: 'free spots',
    },
    loading: 'Loading parking lots',
    empty: 'No parking lot online.',
    emptyHint: 'Pull down to refresh.',
    unreachable: 'Can’t reach Palier.',
    unreachableHint: 'Check your connection, then try again.',
    retry: 'Try again',
    refresh: 'Refresh',
  },
  signIn: {
    title: 'Sign in',
    testSignIn: 'Test sign-in',
    pickDriver: 'Pick a demo driver.',
    loadingDrivers: 'Loading drivers',
  },
  account: {
    title: 'Account',
    signOut: 'Sign out',
  },
  tabs: {
    lots: 'Parking lots',
    account: 'Account',
  },
};
