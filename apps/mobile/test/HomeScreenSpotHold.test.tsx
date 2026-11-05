import { act, screen, userEvent, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, PARKING_DEMO_ID, parkingDemo, parkingDemoWith, parkingTestPaliers } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreen, renderHomeScreenWith } from './renderHomeScreen';
import { visibleText } from './visibleText';

const HOLD_BUTTON_FR = 'Garantir une place 15 min à Parking Démo';

async function holdAtParkingDemo(lotsClient: FakeLotsClient, spotHoldClient = new FakeSpotHoldClient(), language: 'fr' | 'en' = 'fr') {
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient }, language);
  const name = language === 'fr' ? HOLD_BUTTON_FR : 'Guarantee a spot for 15 min at Parking Démo';
  await userEvent.setup().press(await screen.findByRole('button', { name }));
  return spotHoldClient;
}

async function tick(seconds: number): Promise<void> {
  await act(() => jest.advanceTimersByTimeAsync(seconds * 1000));
}

describe('HomeScreen spot hold', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 2));
  });
  afterEach(() => jest.useRealTimers());

  it('shows the hold until 14 h 17 with a live countdown, then the lot with one spot fewer', async () => {
    const lotsClient = new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9));
    const spotHoldClient = await holdAtParkingDemo(lotsClient);

    expect(await screen.findByText("Place garantie jusqu'à 14 h 17", visibleText)).toBeOnTheScreen();
    expect(screen.getByTestId('spot-hold-countdown')).toHaveTextContent('15:00');
    expect(await screen.findByText('9 places libres', visibleText)).toBeOnTheScreen();
    expect(spotHoldClient.heldLots).toEqual([PARKING_DEMO_ID]);
    expect(lotsClient.callCount).toBe(2);

    await tick(1);
    expect(screen.getByTestId('spot-hold-countdown')).toHaveTextContent('14:59');
    await tick(1);
    expect(screen.getByTestId('spot-hold-countdown')).toHaveTextContent('14:58');
  });

  it('stops the countdown at 0:00', async () => {
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10)));
    await screen.findByTestId('spot-hold-countdown');

    await tick(15 * 60);
    expect(screen.getByTestId('spot-hold-countdown')).toHaveTextContent('0:00');
    await tick(5);

    expect(screen.getByTestId('spot-hold-countdown')).toHaveTextContent('0:00');
  });

  it('reads the banner to VoiceOver in words and moves focus to it once', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10)));

    const banner = await screen.findByTestId('spot-hold-banner');
    expect(banner).toHaveProp('accessibilityLabel', expect.stringMatching(/^Place garantie jusqu'à 14.h.17, Parking Démo, 15 minutes restantes$/));
    expect(focus).toHaveBeenCalledTimes(1);

    await tick(5);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('hides every hold button once Julie holds a spot', async () => {
    await holdAtParkingDemo(new FakeLotsClient([parkingDemo(10), parkingTestPaliers]));
    await screen.findByTestId('spot-hold-banner');

    expect(screen.queryByRole('button', { name: /^Garantir une place/ })).not.toBeOnTheScreen();
  });

  it('keeps every hold button waiting while one request runs', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.holdsAnswer = true;
    await holdAtParkingDemo(new FakeLotsClient([parkingDemo(10), parkingTestPaliers]), spotHoldClient);

    expect(screen.getByText('Garantie en cours…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: HOLD_BUTTON_FR })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Garantir une place 15 min à Parking Test Paliers' })).toBeDisabled();

    await act(async () => spotHoldClient.answer());
    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
  });

  it('offers no hold until Palier has said whether Julie already holds one, and reads it again with the list', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.isReachable = false;
    await renderHomeScreenWith({ lotsClient: new FakeLotsClient(parkingDemoWith(10)), locationClient: new FakeDeviceLocationClient(), spotHoldClient });
    await screen.findByText('10 places libres', visibleText);
    expect(screen.queryByRole('button', { name: HOLD_BUTTON_FR })).not.toBeOnTheScreen();

    spotHoldClient.isReachable = true;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByRole('button', { name: HOLD_BUTTON_FR })).toBeOnTheScreen();
  });

  it('offers no hold on a full lot', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(0)));
    await screen.findByText('Complet');

    expect(screen.queryByRole('button', { name: HOLD_BUTTON_FR })).not.toBeOnTheScreen();
  });

  it('keeps the hold button out of the lot row VoiceOver reads as one', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)));
    await screen.findByRole('button', { name: HOLD_BUTTON_FR });

    expect(screen.getByTestId(`lot-row-${PARKING_DEMO_ID}`)).not.toContainElement(screen.getByRole('button', { name: HOLD_BUTTON_FR }));
  });

  it('reads Spot guaranteed until 2:17 PM in English', async () => {
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10)), new FakeSpotHoldClient(), 'en');

    expect(await screen.findByText('Spot guaranteed until 2:17 PM', visibleText)).toBeOnTheScreen();
    expect(screen.getByTestId('spot-hold-banner')).toHaveProp('accessibilityLabel', expect.stringMatching(/Parking Démo, 15 minutes left$/));
  });
});

describe('HomeScreen spot hold refusals', () => {
  const refusals = [
    ['PREREQUISITES_MISSING', 'Ajoutez une plaque et une carte avant de garantir une place', 'Add a plate and a card before guaranteeing a spot'],
    ['HOLD_ALREADY_EXISTS', 'Vous avez déjà une place garantie', 'You already have a guaranteed spot'],
    ['HOLD_QUOTA_REACHED', 'Trop de places garanties dans ce parking pour le moment', 'Too many guaranteed spots in this lot right now'],
    ['NO_SUITABLE_SPOT', 'Aucune place disponible', 'No spot available'],
    ['LOT_NOT_FOUND', 'Ce parking n’est plus offert', 'This lot is no longer offered'],
    ['LOT_NOT_IN_SERVICE', 'Ce parking n’est pas en service', 'This lot is not in service'],
    ['TOO_MANY_HOLD_ATTEMPTS', 'Trop de tentatives, réessayez dans quelques minutes', 'Too many attempts, try again in a few minutes'],
  ] as const;
  const cases = refusals.flatMap(([code, french, english]) => [
    [code, 'fr', french],
    [code, 'en', english],
  ] as const);

  it.each(cases)('reads %s in %s as "%s" and announces it', async (code, language, message) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = code;
    const lotsClient = new FakeLotsClient(parkingDemoWith(10));
    await holdAtParkingDemo(lotsClient, spotHoldClient, language);

    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(message);
    expect(lotsClient.callCount).toBe(1);
  });

  it('shows the hold Julie already has after being told she has one, without moving focus to it', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
    const spotHoldClient = new FakeSpotHoldClient();
    const lotsClient = new FakeLotsClient(parkingDemoWith(10));
    await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient });
    spotHoldClient.nextRejection = 'HOLD_ALREADY_EXISTS';
    spotHoldClient.activeHold = julieHoldAtParkingDemo();
    await userEvent.setup().press(await screen.findByRole('button', { name: HOLD_BUTTON_FR }));

    expect(await screen.findByText('Vous avez déjà une place garantie')).toBeOnTheScreen();
    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();
  });

  it('tells the refusal under the button of the lot that was tapped', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'NO_SUITABLE_SPOT';
    await renderHomeScreenWith({ lotsClient: new FakeLotsClient([parkingDemo(10), parkingTestPaliers]), locationClient: new FakeDeviceLocationClient(), spotHoldClient });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Garantir une place 15 min à Parking Test Paliers' }));

    expect(await within(screen.getByTestId(`lot-spot-hold-${parkingTestPaliers.id}`)).findByText('Aucune place disponible')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`lot-spot-hold-${PARKING_DEMO_ID}`)).queryByText('Aucune place disponible')).not.toBeOnTheScreen();
  });

  it('clears a refusal when the list is read again', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'HOLD_QUOTA_REACHED';
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9)), spotHoldClient);
    await screen.findByText('Trop de places garanties dans ce parking pour le moment');

    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByText('9 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Trop de places garanties dans ce parking pour le moment')).not.toBeOnTheScreen();
  });

  it('says Palier cannot be reached without network', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextFailure = new PalierUnreachableError('fake');
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10)), spotHoldClient);

    expect(await screen.findAllByText('Impossible de joindre Palier.')).not.toHaveLength(0);
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });

  it('says a hold cannot be taken right now when the lot is busy', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'HOLD_UNAVAILABLE';
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10)), spotHoldClient);

    expect(await screen.findByText('Impossible de garantir une place pour le moment, réessayez dans un instant')).toBeOnTheScreen();
  });
});
