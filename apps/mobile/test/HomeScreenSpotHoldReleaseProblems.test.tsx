import { act, fireEvent, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';

const RELEASE_FR = 'Libérer la garantie à Parking Démo';

async function renderJulieHolding(spotHoldClient: FakeSpotHoldClient, language: 'fr' | 'en' = 'fr') {
  const lotsClient = new FakeLotsClient(parkingDemoWith(9), parkingDemoWith(10));
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient }, language);
  await screen.findByTestId('spot-hold-banner');
  return { lotsClient, user: userEvent.setup() };
}

const FOCUS = 'focus';

// Only the event is compared: a failed toHaveBeenCalledWith would print whole host elements.
function focusEvents(focus: jest.SpyInstance): unknown[] {
  return focus.mock.calls.map((call: unknown[]) => call[1]);
}

describe('HomeScreen release: focus and escape', () => {
  it('moves VoiceOver to the question, then back to « Libérer » after « Annuler »', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const { user } = await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));
    focus.mockClear();

    await user.press(screen.getByRole('button', { name: RELEASE_FR }));
    await screen.findByText('Libérer cette garantie?');
    expect(focusEvents(focus)).toEqual([FOCUS]);
    await user.press(screen.getByRole('button', { name: 'Annuler' }));
    await screen.findByText('Libérer');

    expect(focusEvents(focus)).toEqual([FOCUS, FOCUS]);
  });

  it('moves VoiceOver to the busy button after « Oui, libérer »', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    spotHoldClient.releasesAnswer = true;
    const { user } = await renderJulieHolding(spotHoldClient);
    await user.press(screen.getByRole('button', { name: RELEASE_FR }));
    await screen.findByText('Libérer cette garantie?');
    focus.mockClear();

    await user.press(screen.getByRole('button', { name: RELEASE_FR }));
    await screen.findByText('Libération…');

    expect(focusEvents(focus)).toEqual([FOCUS]);
  });

  it('cancels the question on the VoiceOver escape gesture', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    await user.press(screen.getByRole('button', { name: RELEASE_FR }));

    fireEvent(await screen.findByTestId('release-confirmation'), 'accessibilityEscape');

    expect(await screen.findByText('Libérer')).toBeOnTheScreen();
    expect(screen.queryByText('Libérer cette garantie?')).not.toBeOnTheScreen();
    expect(spotHoldClient.releasedIds).toHaveLength(0);
  });
});

describe('HomeScreen release: problems', () => {
  async function release(user: ReturnType<typeof userEvent.setup>, name = RELEASE_FR) {
    await user.press(await screen.findByRole('button', { name }));
    await user.press(await screen.findByRole('button', { name }));
  }

  it.each([
    ['fr', 'Impossible de libérer la garantie pour le moment, réessayez dans un instant', RELEASE_FR],
    ['en', 'Can’t release the guarantee right now, try again in a moment', 'Release the guarantee at Parking Démo'],
  ] as const)('words a busy lot for the release in %s', async (language, message, name) => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient, language);
    spotHoldClient.nextRejection = 'HOLD_UNAVAILABLE';

    await release(user, name);

    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.getByTestId('spot-hold-banner')).toBeOnTheScreen();
  });

  it('tells Julie the guarantee no longer exists when the hold cannot be read again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.nextFailure = new PalierRejectedError('HOLD_NOT_FOUND');
    spotHoldClient.isReachable = false;

    await release(user);

    expect(await screen.findByText('Cette garantie n’existe plus')).toBeOnTheScreen();
    expect(announce.mock.calls.filter(([message]) => message === 'Cette garantie n’existe plus')).toHaveLength(1);
  });

  it('reads the lots again when the hold was already released elsewhere', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { lotsClient, user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.activeHold = null;
    spotHoldClient.nextRejection = 'HOLD_NOT_FOUND';

    await release(user);

    await act(async () => undefined);
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    expect(lotsClient.callCount).toBe(2);
  });

  it('still says Palier cannot be reached', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.nextFailure = new PalierUnreachableError('fake');

    await release(user);

    expect(await screen.findAllByText('Impossible de joindre Palier.')).not.toHaveLength(0);
  });
});
