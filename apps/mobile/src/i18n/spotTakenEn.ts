import type { Translations } from './fr';
import { SENDING, UNREACHABLE } from './sharedEn';

export const spotTakenEn: Translations['session']['spotTaken'] = {
  action: 'Spot taken',
  confirmLead: 'Confirm that spot ',
  confirmTrail: ' is taken?',
  confirm: 'Report %{number} taken',
  cancel: 'Keep %{number}',
  sending: SENDING,
  newSpotLead: 'New spot: ',
  noneFree: 'No other free spot\u00A0— park in a free spot that isn\'t reserved and enter its number',
  unreachable: UNREACHABLE,
  limitReached: 'You have reached the report limit for this session. Go to the spot shown or tell staff where you are.',
};
