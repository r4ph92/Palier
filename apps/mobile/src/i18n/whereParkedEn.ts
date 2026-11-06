import type { Translations } from './fr';
import { SENDING, UNREACHABLE } from './sharedEn';

export const whereParkedEn: Translations['session']['whereParked'] = {
  question: 'Where are you parked?',
  freeSpotsLead: 'Free spots in aisle %{aisle} for your vehicle',
  noFreeSpot: 'No free spot in aisle %{aisle} for your vehicle',
  numberLabel: 'Spot number',
  confirm: 'Confirm',
  confirmNumber: 'Confirm\u00A0%{number}',
  sending: SENDING,
  unknownSpot: 'Unknown number in this parking lot',
  spotTaken: 'This spot is already assigned\u00A0— check the number on the ground',
  spotOutOfService: 'This spot is out of service\u00A0— check the number on the ground',
  invalidNumber: 'Invalid number',
  offline: 'Offline, free spots as of last check',
  unreachable: UNREACHABLE,
  notMySpot: 'This is not my spot',
  correctedNumberLabel: 'Number of the spot you parked in',
  cancel: 'Cancel',
};
