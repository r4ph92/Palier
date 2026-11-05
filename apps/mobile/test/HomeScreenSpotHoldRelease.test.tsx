import { act, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';
import { visibleText } from './visibleText';

const RELEASE_FR = 'Libérer la garantie à Parking Démo';
const RELEASE_EN = 'Release the guarantee at Parking Démo';
const CONFIRM_FR = 'Oui, libérer la garantie à Parking Démo';
const CONFIRM_EN = 'Yes, release the guarantee at Parking Démo';

async function renderJulieHolding(spotHoldClient: FakeSpotHoldClient, language: 'fr' | 'en' = 'fr') {
  const lotsClient = new FakeLotsClient(parkingDemoWith(9), parkingDemoWith(10));
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient }, language);
  await screen.findByTestId('spot-hold-banner');
  return { lotsClient, user: userEvent.setup() };
}

async function confirmRelease(user: ReturnType<typeof userEvent.setup>, [open, confirm] = [RELEASE_FR, CONFIRM_FR]) {
  await user.press(await screen.findByRole('button', { name: open }));
  await user.press(await screen.findByRole('button', { name: confirm }));
}

describe('HomeScreen releasing a hold', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 5));
  });
  afterEach(() => jest.useRealTimers());

  it('asks before releasing, then removes the banner and shows the lot with one more free spot', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { lotsClient, user } = await renderJulieHolding(spotHoldClient);
    expect(await screen.findByText('9 places libres', visibleText)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: RELEASE_FR }));
    expect(screen.getByText('Libérer cette garantie?')).toBeOnTheScreen();
    expect(spotHoldClient.releasedIds).toHaveLength(0);
    await user.press(screen.getByRole('button', { name: CONFIRM_FR }));

    expect(await screen.findByText('10 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    expect(spotHoldClient.releasedIds).toEqual(['hold-1']);
    expect(lotsClient.callCount).toBe(2);
    expect(announce.mock.calls.filter(([message]) => message === 'Garantie libérée')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Garantir une place 15 min à Parking Démo' })).toBeOnTheScreen();
  });

  it('keeps the hold when Julie cancels', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);

    await user.press(screen.getByRole('button', { name: RELEASE_FR }));
    await user.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(spotHoldClient.releasedIds).toHaveLength(0);
    expect(screen.getByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: RELEASE_FR })).toBeOnTheScreen();
  });

  it('shows Libération… while the release runs', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    spotHoldClient.releasesAnswer = true;
    const { user } = await renderJulieHolding(spotHoldClient);

    await user.press(await screen.findByRole('button', { name: RELEASE_FR }));
    await screen.findByText('Libérer cette garantie?');
    await user.press(screen.getByRole('button', { name: CONFIRM_FR }));

    expect(screen.getByText('Libération…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Libération de la garantie à Parking Démo' })).toBeDisabled();
    await act(async () => spotHoldClient.answer());
    expect(spotHoldClient.releasedIds).toEqual(['hold-1']);
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });

  it('tells Julie the guarantee has already expired when the server says so before her countdown ends', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const { lotsClient, user } = await renderJulieHolding(spotHoldClient);
    const listReadsBefore = lotsClient.callCount;
    spotHoldClient.nextRejection = 'HOLD_EXPIRED';

    await confirmRelease(user);

    expect(await screen.findByText('Cette garantie a déjà expiré')).toBeOnTheScreen();
    expect(announce.mock.calls.filter(([message]) => message === 'Cette garantie a déjà expiré')).toHaveLength(1);
    expect(screen.getByTestId('spot-hold-countdown')).toBeOnTheScreen();
    expect(lotsClient.callCount).toBe(listReadsBefore);

    await confirmRelease(user);
    expect(await screen.findAllByText('Cette garantie a déjà expiré')).toHaveLength(1);
    expect(lotsClient.callCount).toBe(listReadsBefore);
  });

  it('clears the banner without a message when the hold was released on another device', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.activeHold = null;
    spotHoldClient.nextRejection = 'HOLD_NOT_FOUND';

    await confirmRelease(user);

    await act(async () => undefined);
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    expect(screen.queryByText('Cette garantie n’existe plus')).not.toBeOnTheScreen();
  });

  it('says Palier cannot be reached and keeps the banner and the button', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.nextFailure = new PalierUnreachableError('fake');

    await confirmRelease(user);

    expect(await screen.findAllByText('Impossible de joindre Palier.')).not.toHaveLength(0);
    expect(screen.getByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: RELEASE_FR })).toBeOnTheScreen();
  });

  it('keeps the banner readable as before: one group, without the release button inside', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));

    expect(screen.getByTestId('spot-hold-banner')).not.toContainElement(screen.getByRole('button', { name: RELEASE_FR }));
  });

  it('offers the button, the confirmation and the result in English', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient, 'en');
    expect(screen.getByText('Release')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: RELEASE_EN }));
    expect(screen.getByText('Release this guarantee?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: CONFIRM_EN }));

    expect(await screen.findByText('10 free spots', visibleText)).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Guarantee released');
  });

  it('says an expired guarantee in English', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient, 'en');
    spotHoldClient.nextRejection = 'HOLD_EXPIRED';

    await confirmRelease(user, [RELEASE_EN, CONFIRM_EN]);

    expect(await screen.findByText('This guarantee has already expired')).toBeOnTheScreen();
  });
});
