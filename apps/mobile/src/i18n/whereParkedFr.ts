import { SENDING, UNREACHABLE } from './sharedFr';

// The question asked after a walk away from the car in another aisle than the assigned spot's, and the correction of a presumed spot.
export const whereParkedFr = {
  question: 'Où êtes-vous garé\u00A0?',
  freeSpotsLead: 'Places libres dans l’allée %{aisle} pour votre véhicule',
  noFreeSpot: 'Aucune place libre dans l’allée %{aisle} pour votre véhicule',
  numberLabel: 'Numéro de place',
  confirm: 'Confirmer',
  confirmNumber: 'Confirmer\u00A0%{number}',
  sending: SENDING,
  unknownSpot: 'Numéro inconnu dans ce parking',
  spotTaken: 'Cette place est déjà attribuée\u00A0— vérifiez le numéro au sol',
  spotOutOfService: 'Cette place est hors service\u00A0— vérifiez le numéro au sol',
  invalidNumber: 'Numéro invalide',
  offline: 'Hors ligne, places libres au dernier relevé',
  unreachable: UNREACHABLE,
  notMySpot: 'Ce n’est pas ma place',
  correctedNumberLabel: 'Numéro de la place où vous êtes garé',
  cancel: 'Annuler',
  signalsWaiting: { one: 'Hors ligne — %{count} signal en attente', other: 'Hors ligne — %{count} signaux en attente' },
  signalsSent: { one: '%{count} signal envoyé', other: '%{count} signaux envoyés' },
};
