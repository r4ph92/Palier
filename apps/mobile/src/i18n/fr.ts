export const fr = {
  app: {
    crashed: 'Une erreur inattendue est survenue.',
    crashedHint: 'Fermez puis rouvrez Palier.',
  },
  home: {
    updatedAt: 'Mis à jour à %{time}',
    title: 'Stationnements',
    freeSpotsLabel: {
      one: 'place libre',
      other: 'places libres',
    },
    full: 'Complet',
    fullAccessibilityLabel: 'Complet, 0 place libre',
    loading: 'Chargement des stationnements',
    empty: 'Aucun stationnement en ligne.',
    emptyHint: 'Tirez vers le bas pour actualiser.',
    unreachable: 'Impossible de joindre Palier.',
    unreachableHint: 'Vérifiez votre connexion, puis réessayez.',
    retry: 'Réessayer',
    refresh: 'Actualiser',
  },
};

export type Translations = typeof fr;
