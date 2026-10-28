export const fr = {
  app: {
    crashed: 'Une erreur inattendue est survenue.',
    crashedHint: 'Fermez puis rouvrez Palier.',
  },
  home: {
    greeting: 'Bonjour %{firstName}',
    updatedAt: 'Mis à jour à %{time}',
    title: 'Stationnements',
    freeSpotsLabel: {
      one: 'place libre',
      other: 'places libres',
    },
    loading: 'Chargement des stationnements',
    empty: 'Aucun stationnement en ligne.',
    emptyHint: 'Tirez vers le bas pour actualiser.',
    unreachable: 'Impossible de joindre Palier.',
    unreachableHint: 'Vérifiez votre connexion, puis réessayez.',
    retry: 'Réessayer',
    refresh: 'Actualiser',
  },
  signIn: {
    title: 'Connexion',
    testSignIn: 'Connexion de test',
    pickDriver: 'Choisissez un conducteur de démonstration.',
    loadingDrivers: 'Chargement des conducteurs',
  },
  account: {
    title: 'Compte',
    signOut: 'Se déconnecter',
  },
  tabs: {
    lots: 'Stationnements',
    account: 'Compte',
  },
};

export type Translations = typeof fr;
