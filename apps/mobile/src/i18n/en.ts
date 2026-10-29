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
    vehicles: 'My vehicles',
  },
  vehicles: {
    title: 'Vehicles',
    loading: 'Loading vehicles',
    empty: 'No vehicle registered.',
    emptyHint: 'Add your plate to park.',
    defaultBadge: 'Default',
  },
  tabs: {
    lots: 'Parking lots',
    account: 'Account',
  },
  notice: {
    title: 'Your information',
    intro: 'To park with Palier, we collect:',
    plates: 'your licence plate number',
    times: 'your entry and exit times',
    spot: 'the aisle and spot detected',
    payment: 'a payment reference',
    why: 'We use this to find your spot, bill your parking and keep the lot secure.',
    retention: 'Identifying information is kept 90 days after your visit, then anonymized.',
    accept: 'I accept',
    refuse: 'Decline',
    refused: 'Palier cannot be used without your consent.',
  },
};
