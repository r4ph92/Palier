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

// The form gave way to « Garé en B-3 »: VoiceOver's focus moves to the spot, with no announcement on top.
// Both AccessibilityInfo methods must be spied on, and cleared, before the answer.
export function expectFocusedSpotWithoutAnnouncement(spotNumber: string): void {
  const parkedIn = `Garé en ${spotNumber}`;
  const spot = screen.getByLabelText(`${spotNumber} · Palier P1 · Allée ${spotNumber.charAt(0)}. ${parkedIn}`, visibleText);
  const focusTarget = expect.objectContaining({ props: expect.objectContaining({ accessibilityLabel: spot.props.accessibilityLabel }) });
  expect(jest.mocked(AccessibilityInfo.sendAccessibilityEvent)).toHaveBeenCalledWith(focusTarget, 'focus');
  const announcements = jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.filter(([message]) => asSeen(message) === parkedIn);
  expect(announcements).toHaveLength(0);
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
