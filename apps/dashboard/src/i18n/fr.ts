export const fr = {
  app: {
    name: 'Tableau de bord Palier',
    skipToContent: 'Aller au contenu',
    signOut: 'Se déconnecter',
    signingOut: 'Déconnexion…',
    loading: 'Chargement…',
  },
  language: {
    switchTo: 'English',
  },
  signIn: {
    eyebrow: 'Tableau de bord',
    title: 'Connexion',
    providersLater: 'La connexion avec Google ou Apple n’est pas encore offerte.',
  },
  createOperator: {
    eyebrow: 'Premier pas',
    title: 'Créer votre opérateur',
    greeting: 'Bonjour %{firstName}.',
    intro: 'Vous n’êtes membre d’aucun opérateur. Indiquez la raison sociale de votre entreprise pour en créer un.',
    legalNameLabel: 'Raison sociale',
    legalNameHint: 'De %{minimum} à %{maximum} caractères, telle qu’inscrite au registre.',
    submit: 'Créer l’opérateur',
    submitting: 'Création…',
  },
  home: {
    eyebrow: 'Opérateur',
    stripeLabel: 'Compte Stripe',
    connectStripe: 'Connecter Stripe',
    resumeStripe: 'Reprendre l’inscription Stripe',
    redirecting: 'Redirection vers Stripe…',
    lotsTitle: 'Stationnements',
    lotsLoading: 'Chargement des stationnements…',
    lotsEmpty: 'Aucun stationnement pour l’instant.',
  },
  kycStatus: {
    NOT_STARTED: 'Non commencé',
    PENDING: 'Vérification en cours',
    ACTION_REQUIRED: 'Action requise',
    VERIFIED: 'Vérifié',
  },
  lot: {
    eyebrow: 'Stationnement',
    online: 'En ligne',
    offline: 'Hors ligne',
    back: 'Retour aux stationnements',
  },
  notFound: {
    eyebrow: 'Erreur 404',
    title: 'Introuvable',
    message: 'Cette page n’existe pas ou ne vous est pas accessible.',
    back: 'Retour à l’accueil',
  },
  failure: {
    eyebrow: 'Erreur réseau',
    title: 'Palier est injoignable',
    retry: 'Réessayer',
  },
  errors: {
    UNAUTHORIZED: 'Votre session a pris fin. Connectez-vous de nouveau.',
    CSRF_HEADER_MISSING: 'Cette demande a été refusée. Rechargez la page.',
    LEGAL_NAME_INVALID: 'La raison sociale doit compter de %{minimum} à %{maximum} caractères, sans caractère invisible.',
    OPERATOR_EXISTS: 'Vous êtes déjà membre d’un opérateur.',
    NO_OPERATOR: 'Créez d’abord votre opérateur.',
    LOT_NOT_FOUND: 'Ce stationnement est introuvable.',
    OPERATOR_NOT_FOUND: 'Cet opérateur est introuvable.',
    STRIPE_UNAVAILABLE: 'Stripe est injoignable pour l’instant. Réessayez dans un instant.',
    UNKNOWN: 'Une erreur est survenue. Réessayez dans un instant.',
  },
};

export type Dictionary = typeof fr;
