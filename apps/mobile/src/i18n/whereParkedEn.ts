import type { Translations } from './fr';

export const whereParkedEn: Translations['session']['whereParked'] = {
  question: 'Where are you parked?',
  freeSpotsLead: 'Free spots in aisle %{aisle}',
  noFreeSpot: 'No free spot in aisle %{aisle}',
  numberLabel: 'Spot number',
  confirm: 'Confirm',
  confirmNumber: 'Confirm\u00A0%{number}',
  sending: 'Sending…',
  unknownSpot: 'Unknown number in this parking lot',
  spotTaken: 'This spot is already assigned\u00A0— check the number on the ground',
  spotOutOfService: 'This spot is out of service\u00A0— check the number on the ground',
  invalidNumber: 'Invalid number',
  offline: 'Offline, free spots as of last check',
  unreachable: 'Can’t reach Palier. Check your connection, then try again.',
  notMySpot: 'This is not my spot',
  cancel: 'Cancel',
};
