import { SENDING, UNREACHABLE } from './sharedFr';

export const spotTakenFr = {
  action: 'Place prise',
  confirmLead: 'Confirmer que la place ',
  confirmTrail: ' est prise\u00A0?',
  confirm: 'Signaler %{number} prise',
  cancel: 'Garder %{number}',
  sending: SENDING,
  newSpotLead: 'Nouvelle place\u00A0: ',
  noneFree: 'Aucune autre place libre\u00A0— garez-vous sur une place libre non réservée et indiquez son numéro',
  unreachable: UNREACHABLE,
  limitReached: 'Vous avez atteint la limite de signalements pour cette session. Rendez-vous à la place indiquée ou signalez votre position au personnel.',
};
