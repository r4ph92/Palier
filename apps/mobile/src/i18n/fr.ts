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
    vehicles: 'Mes véhicules',
  },
  vehicles: {
    title: 'Véhicules',
    loading: 'Chargement des véhicules',
    empty: 'Aucun véhicule enregistré.',
    emptyHint: 'Ajoutez la plaque de votre véhicule pour stationner.',
    defaultBadge: 'Par défaut',
  },
  tabs: {
    lots: 'Stationnements',
    account: 'Compte',
  },
  notice: {
    title: 'Vos renseignements',
    intro: 'Pour stationner avec Palier, nous recueillons :',
    plates: 'votre plaque d’immatriculation',
    times: 'les heures d’entrée et de sortie',
    spot: 'l’allée et la place détectées',
    payment: 'la référence de paiement',
    why: 'Ces renseignements servent à trouver votre place, à facturer le stationnement et à assurer la sécurité des lieux.',
    retention: 'Les renseignements identifiants sont conservés 90 jours après votre visite, puis anonymisés.',
    accept: "J'accepte",
    refuse: 'Refuser',
    refused: 'Palier ne peut pas être utilisée sans votre consentement.',
  },
};

export type Translations = typeof fr;
