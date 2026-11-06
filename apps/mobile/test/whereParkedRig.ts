import { screen, userEvent } from '@testing-library/react-native';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { visibleText } from './visibleText';
import { julieWith } from './walkAwayRig';

// « Confirmer » followed by the number in the field.
export const CONFIRM_TYPED = /^Confirmer\s/;

export const WHERE_PARKED = 'Où êtes-vous garé ?';
export const AISLE_B_MINOR = 2;

// Julie got A-1, walked into aisle B and walked away from the car there: Palier asks where she parked.
export async function julieAskedInAisleB(language: SupportedLanguage = 'fr') {
  const rig = await julieWith(julieAtParkingDemo(), language);
  await rig.enterAisle(AISLE_B_MINOR);
  await rig.walkAway();
  await screen.findByText(language === 'fr' ? WHERE_PARKED : 'Where are you parked?', visibleText);
  return { ...rig, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }) };
}
