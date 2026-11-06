import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { asSeen, visibleText } from './visibleText';
import { julieWith } from './walkAwayRig';

// « Confirmer » followed by the number in the field.
export const CONFIRM_TYPED = /^Confirmer\s/;

export const WHERE_PARKED = 'Où êtes-vous garé ?';
export const AISLE_B_MINOR = 2;

export const REFUSAL_MESSAGES = {
  UNKNOWN_SPOT: 'Numéro inconnu dans ce parking',
  SPOT_TAKEN: 'Cette place est déjà attribuée — vérifiez le numéro au sol',
  SPOT_OUT_OF_SERVICE: 'Cette place est hors service — vérifiez le numéro au sol',
} as const;

// Watches VoiceOver from now on; the returned check says the form gave way to « Garé en B-3 »: the focus moved to the spot,
// with no announcement on top.
export function watchSpotFocus(): (spotNumber: string) => void {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
  return (spotNumber) => {
    const parkedIn = `Garé en ${spotNumber}`;
    const spot = screen.getByLabelText(`${spotNumber} · Palier P1 · Allée ${spotNumber.charAt(0)}. ${parkedIn}`, visibleText);
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ accessibilityLabel: spot.props.accessibilityLabel }) }), 'focus');
    expect(announce.mock.calls.filter(([message]) => asSeen(message) === parkedIn)).toHaveLength(0);
  };
}

// Julie got A-1, walked into aisle B and walked away from the car there: Palier asks where she parked.
export async function julieAskedInAisleB(language: SupportedLanguage = 'fr') {
  const rig = await julieWith(julieAtParkingDemo(), language);
  await rig.enterAisle(AISLE_B_MINOR);
  await rig.walkAway();
  await screen.findByText(language === 'fr' ? WHERE_PARKED : 'Where are you parked?', visibleText);
  return { ...rig, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }) };
}

export const NOT_MY_SPOT = 'Ce n’est pas ma place';
export const CORRECTED_SPOT_NUMBER = 'Numéro de la place où vous êtes garé';

// Julie walked away in aisle A: Palier presumed her assigned A-1.
export async function juliePresumedInA1(language: SupportedLanguage = 'fr') {
  const rig = await julieWith(julieAtParkingDemo({ state: 'PARKED_PRESUMED' }), language);
  await screen.findByText(language === 'fr' ? 'Garé en A-1' : 'Parked in A-1', visibleText);
  return { ...rig, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }) };
}

export async function julieCorrecting() {
  const rig = await juliePresumedInA1();
  await rig.user.press(screen.getByRole('button', { name: NOT_MY_SPOT }));
  return rig;
}
