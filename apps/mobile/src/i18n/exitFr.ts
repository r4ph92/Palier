import { UNREACHABLE } from './sharedFr';

export const exitFr = {
  action: 'Ouvrir la barrière de sortie',
  opening: 'Ouverture…',
  unreachable: UNREACHABLE,
  pending: { title: 'Barrière ouverte — votre reçu suivra' },
  receipt: {
    eyebrow: 'Reçu',
    title: 'Barrière de sortie ouverte',
    durationLead: 'Durée ',
    totalLead: 'Total ',
    capped: 'Plafond journalier',
    total: 'Total',
    firstDay: '24 premières heures',
    nextDay: '24 heures suivantes',
    extra: '%{duration} supplémentaires',
    capNote: '(plafond)',
    unpaid: 'Solde impayé',
    lineAmount: '%{label}\u00A0: %{amount}',
    done: 'Terminé',
  },
};
