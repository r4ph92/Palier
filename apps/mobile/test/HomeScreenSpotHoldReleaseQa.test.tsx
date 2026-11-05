import { act, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';
import { HOLD_BUTTON_FR } from './spotHoldScreen';
import { visibleText } from './visibleText';

const RELEASE_FR = 'Libérer la garantie à Parking Démo';
const RELEASE_EN = 'Release the guarantee at Parking Démo';
const CONFIRM_FR = 'Oui, libérer la garantie à Parking Démo';
const CONFIRM_EN = 'Yes, release the guarantee at Parking Démo';
const HOLD_WORDING_FR = 'Impossible de garantir une place pour le moment, réessayez dans un instant';
const mockWindow = { width: 402, height: 874, scale: 3, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

async function renderJulieHolding(spotHoldClient: FakeSpotHoldClient, lotsClient = new FakeLotsClient(parkingDemoWith(9), parkingDemoWith(10))) {
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient });
  await screen.findByTestId('spot-hold-banner');
  return { lotsClient, user: userEvent.setup() };
}

async function confirmRelease(user: ReturnType<typeof userEvent.setup>) {
  await user.press(await screen.findByRole('button', { name: RELEASE_FR }));
  await user.press(await screen.findByRole('button', { name: CONFIRM_FR }));
}

describe('QA HomeScreen releasing a hold', () => {
  beforeEach(() => {
    mockWindow.fontScale = 1;
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 5));
  });
  afterEach(() => jest.useRealTimers());

  it('does not tell Julie she cannot guarantee a spot when her release meets a busy lot', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.nextRejection = 'HOLD_UNAVAILABLE';

    await confirmRelease(user);

    expect(await screen.findByText('Impossible de libérer la garantie pour le moment, réessayez dans un instant')).toBeOnTheScreen();
    expect(screen.queryByText(HOLD_WORDING_FR)).not.toBeOnTheScreen();
    expect(screen.getByTestId('spot-hold-banner')).toBeOnTheScreen();
  });

  it('words a busy lot for the release in English too', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderHomeScreenWith({ lotsClient: new FakeLotsClient(parkingDemoWith(9)), locationClient: new FakeDeviceLocationClient(), spotHoldClient }, 'en');
    await screen.findByTestId('spot-hold-banner');
    const user = userEvent.setup();
    spotHoldClient.nextRejection = 'HOLD_UNAVAILABLE';

    await user.press(screen.getByRole('button', { name: RELEASE_EN }));
    await user.press(screen.getByRole('button', { name: CONFIRM_EN }));

    expect(await screen.findByText('Can’t release the guarantee right now, try again in a moment')).toBeOnTheScreen();
    expect(screen.queryByText('Can’t guarantee a spot right now, try again in a moment')).not.toBeOnTheScreen();
  });

  it('tells Julie « Cette garantie n’existe plus » when the release answers not found and the hold cannot be read again', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.nextFailure = new PalierRejectedError('HOLD_NOT_FOUND');
    spotHoldClient.isReachable = false;

    await confirmRelease(user);
    await act(async () => undefined);

    expect(await screen.findByText('Cette garantie n’existe plus, actualisez la liste')).toBeOnTheScreen();
  });

  it('clears « Cette garantie n’existe plus » and the stale banner once Actualiser can read the hold again', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient, new FakeLotsClient(parkingDemoWith(9), parkingDemoWith(9), parkingDemoWith(10)));
    spotHoldClient.nextFailure = new PalierRejectedError('HOLD_NOT_FOUND');
    spotHoldClient.isReachable = false;
    await confirmRelease(user);
    await screen.findByText('Cette garantie n’existe plus, actualisez la liste');

    spotHoldClient.nextFailure = null;
    spotHoldClient.isReachable = true;
    spotHoldClient.activeHold = null;
    await user.press(screen.getByRole('button', { name: 'Actualiser' }));
    await act(async () => undefined);

    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    expect(screen.queryByText('Cette garantie n’existe plus, actualisez la liste')).not.toBeOnTheScreen();
  });

  it('keeps the busy « Libération… » button from reopening the confirmation while the release runs', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    spotHoldClient.releasesAnswer = true;
    const { user } = await renderJulieHolding(spotHoldClient);

    await confirmRelease(user);
    await user.press(screen.getByRole('button', { name: 'Libération de la garantie à Parking Démo' }));

    expect(screen.queryByText('Libérer cette garantie?')).not.toBeOnTheScreen();
    await act(async () => spotHoldClient.answer());
    expect(spotHoldClient.releasedIds).toEqual(['hold-1']);
  });

  it('does not bring the banner back when Actualiser runs during the release', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    spotHoldClient.releasesAnswer = true;
    const { user } = await renderJulieHolding(spotHoldClient);

    await confirmRelease(user);
    await user.press(screen.getByRole('button', { name: 'Actualiser' }));
    await act(async () => spotHoldClient.answer());
    await user.press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    expect(spotHoldClient.releasedIds).toEqual(['hold-1']);
  });

  it('lets Julie guarantee a spot again right after releasing, with a new banner', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient, new FakeLotsClient(parkingDemoWith(9), parkingDemoWith(10), parkingDemoWith(9)));

    await confirmRelease(user);
    await screen.findByText('10 places libres', visibleText);
    await user.press(screen.getByRole('button', { name: HOLD_BUTTON_FR }));

    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: RELEASE_FR })).toBeOnTheScreen();
    expect(spotHoldClient.heldLots).toHaveLength(1);
  });

  it('says Palier cannot be reached, then releases on the next try', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { user } = await renderJulieHolding(spotHoldClient);
    spotHoldClient.nextFailure = new PalierUnreachableError('fake');
    await confirmRelease(user);
    expect(await screen.findAllByText('Impossible de joindre Palier.')).not.toHaveLength(0);

    spotHoldClient.nextFailure = null;
    await confirmRelease(user);

    await act(async () => undefined);
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    expect(screen.queryByText('Impossible de joindre Palier.')).not.toBeOnTheScreen();
    expect(spotHoldClient.releasedIds).toEqual(['hold-1', 'hold-1']);
  });

  // At 3.1 « Oui, libérer » and « Annuler » side by side measure about 465 pt, wider than the 370 pt column of a 402 pt phone.
  it('lets « Oui, libérer » and « Annuler » wrap at the largest text size instead of running off the screen', async () => {
    mockWindow.fontScale = 3.1;
    const { user } = await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));

    await user.press(screen.getByRole('button', { name: RELEASE_FR }));

    const choices = StyleSheet.flatten(screen.getByRole('button', { name: CONFIRM_FR }).parent?.props.style ?? {}) as { flexDirection?: string; flexWrap?: string };
    expect(screen.getByRole('button', { name: CONFIRM_FR }).parent).toContainElement(screen.getByRole('button', { name: 'Annuler' }));
    expect(choices.flexDirection !== 'row' || choices.flexWrap === 'wrap').toBe(true);
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
  });
});
