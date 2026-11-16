// The sessions with no exit for 7 days, kept apart so each dictionary file stays short (Q46).
export const frStaleSessions = {
  title: 'Sessions sans sortie',
  titleInLot: 'Sessions sans sortie — %{lot}',
  back: 'Retour au stationnement',
  count: { one: '%{count} session sans sortie', other: '%{count} sessions sans sortie' },
  hint: 'Aucune preuve de présence ni sortie depuis 7 jours. Allez voir sur place, puis confirmez que le véhicule est là : la session reste ouverte et rien n’est prélevé.',
  columns: { plate: 'Plaque', spot: 'Place', lastProof: 'Dernière preuve', flagged: 'Signalée le', check: 'Vérification' },
  place: '%{level} · allée %{aisle}',
  proofs: { ENTRY: 'Entrée confirmée', PARKED_ON_FOOT: 'Arrivée à la place (à pied)', ANSWERED: 'Réponse du conducteur', PRESENCE: 'Présence confirmée' },
  present: { shown: 'Véhicule présent', name: 'Véhicule présent, %{plate}' },
  confirming: { shown: 'Confirmation…', status: 'Confirmation de la présence du véhicule %{plate}…' },
  confirmed: 'Présence du véhicule %{plate} confirmée. La session reste ouverte.',
  empty: 'Aucune session sans sortie.',
  emptyHint: 'Une session apparaît ici quand un véhicule n’a ni preuve de présence ni sortie depuis 7 jours.',
};

export const frStaleSessionErrors = { STALE_SESSION_GONE: 'La session de %{plate} n’est plus ouverte. La liste a été rechargée.' };
