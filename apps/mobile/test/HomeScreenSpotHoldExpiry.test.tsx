import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';
import { lightColors } from '../src/theme/tokens';
import { tick } from './spotHoldScreen';

const EXPIRED_FR = 'Votre place garantie a expiré';
const EXPIRED_EN = 'Your guaranteed spot has expired';
const RELEASE_BUTTON = /^Libérer la garantie/;
const CONFIRM_BUTTON = /^Oui, libérer la garantie/;

async function renderJulieHolding(spotHoldClient: FakeSpotHoldClient, language: 'fr' | 'en' = 'fr') {
  spotHoldClient.serverClockRuns = true;
  const lotsClient = new FakeLotsClient(parkingDemoWith(9));
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient }, language);
  await screen.findByTestId('spot-hold-banner');
  return { lotsClient, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTime }) };
}

async function startReleasing(user: Awaited<ReturnType<typeof renderJulieHolding>>['user']) {
  await user.press(screen.getByRole('button', { name: RELEASE_BUTTON }));
  await user.press(screen.getByRole('button', { name: CONFIRM_BUTTON }));
}

function announcementsOf(message: string): number {
  return jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.filter(([announced]) => announced === message).length;
}

describe('HomeScreen expired spot hold', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 2));
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('replaces the countdown and the release button with the expiry message at 15 minutes', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));
    expect(screen.getByRole('button', { name: RELEASE_BUTTON })).toBeOnTheScreen();

    await tick(15 * 60);

    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
    expect(screen.queryByTestId('spot-hold-countdown')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: RELEASE_BUTTON })).not.toBeOnTheScreen();
  });

  it('keeps the hold active at 14 minutes 50 seconds', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));

    await tick(14 * 60 + 50);

    expect(screen.getByTestId('spot-hold-countdown')).toHaveTextContent('0:10');
    expect(screen.queryByText(EXPIRED_FR)).not.toBeOnTheScreen();
  });

  it('says it in English on an English device', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()), 'en');

    await tick(15 * 60);

    expect(screen.getByText(EXPIRED_EN)).toBeOnTheScreen();
    expect(screen.queryByText(EXPIRED_FR)).not.toBeOnTheScreen();
  });

  it('names the lot and the expiry in the banner label, with no minutes left', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));

    await tick(15 * 60);

    expect(screen.getByTestId('spot-hold-banner')).toHaveProp('accessibilityLabel', `${EXPIRED_FR}, Parking Démo`);
  });

  it('announces the expiry once, while the driver watches', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));

    await tick(15 * 60);
    await tick(60);

    expect(announcementsOf(EXPIRED_FR)).toBe(1);
  });

  it('stays quiet when the banner opens on a hold that already ended', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo({ now: new Date(2026, 10, 4, 14, 40).toISOString() })));

    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
    expect(announcementsOf(EXPIRED_FR)).toBe(0);
  });

  it('reads the hold again every few seconds after the end, and not before', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderJulieHolding(spotHoldClient);
    const readsBeforeEnd = spotHoldClient.currentRequests;

    await tick(15 * 60 - 1);
    expect(spotHoldClient.currentRequests).toBe(readsBeforeEnd);

    await tick(1);
    await tick(5);
    expect(spotHoldClient.currentRequests).toBe(readsBeforeEnd + 1);
    await tick(5);
    expect(spotHoldClient.currentRequests).toBe(readsBeforeEnd + 2);
  });

  it('keeps the message, announced once, while the server still answers the hold', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));

    await tick(15 * 60 + 20);

    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
    expect(announcementsOf(EXPIRED_FR)).toBe(1);
  });

  it('removes the banner once the server has ended the hold, and reads no more', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderJulieHolding(spotHoldClient);
    await tick(15 * 60);

    spotHoldClient.activeHold = null;
    await tick(5);

    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    const readsAfterEnd = spotHoldClient.currentRequests;
    await tick(30);
    expect(spotHoldClient.currentRequests).toBe(readsAfterEnd);
  });

  it('mutes the mark of the expired banner', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));

    await tick(15 * 60);

    expect(screen.getByTestId('spot-hold-mark')).toHaveStyle({ backgroundColor: lightColors.muted });
  });

  it('moves VoiceOver to the banner, without announcing, when the confirmation vanishes at expiry', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const { user } = await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));
    await user.press(screen.getByRole('button', { name: RELEASE_BUTTON }));
    focus.mockClear();

    await tick(15 * 60);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(announcementsOf(EXPIRED_FR)).toBe(0);
  });

  it('moves VoiceOver to the banner when the release button vanishes while releasing', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    spotHoldClient.releasesAnswer = true;
    const { user } = await renderJulieHolding(spotHoldClient);
    await startReleasing(user);
    focus.mockClear();

    await tick(15 * 60);

    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(announcementsOf(EXPIRED_FR)).toBe(0);
  });

  it('moves VoiceOver to the banner when the release button, back after « Annuler », vanishes at expiry', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const { user } = await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));
    await user.press(screen.getByRole('button', { name: RELEASE_BUTTON }));
    await user.press(screen.getByRole('button', { name: 'Annuler' }));
    focus.mockClear();

    await tick(15 * 60);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(screen.getByTestId('spot-hold-banner')).toHaveProp('accessibilityLabel', `${EXPIRED_FR}, Parking Démo`);
    expect(announcementsOf(EXPIRED_FR)).toBe(0);
  });

  it('does not move VoiceOver when the driver was not releasing', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()));
    focus.mockClear();

    await tick(15 * 60);

    expect(focus).not.toHaveBeenCalled();
  });

  it('does not repeat the expiry in a refusal once the banner says it', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    spotHoldClient.nextRejection = 'HOLD_EXPIRED';
    const { user } = await renderJulieHolding(spotHoldClient);
    await startReleasing(user);
    expect(await screen.findByText('Cette garantie a déjà expiré')).toBeOnTheScreen();

    await tick(15 * 60);

    expect(screen.queryByText('Cette garantie a déjà expiré')).not.toBeOnTheScreen();
    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
  });

  it('reads the lots again when the expired banner goes, so the freed spot shows', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const { lotsClient } = await renderJulieHolding(spotHoldClient);
    await tick(15 * 60);
    const readsBefore = lotsClient.callCount;

    spotHoldClient.activeHold = null;
    await tick(5);

    expect(lotsClient.callCount).toBe(readsBefore + 1);
  });

  it('announces once when a hold opened expired is read again with time left and then runs out', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo({ now: new Date(2026, 10, 4, 14, 40).toISOString() }));
    await renderJulieHolding(spotHoldClient);
    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();

    spotHoldClient.activeHold = julieHoldAtParkingDemo();
    await tick(5);
    expect(screen.getByTestId('spot-hold-countdown')).toBeOnTheScreen();
    await tick(15 * 60);

    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
    expect(announcementsOf(EXPIRED_FR)).toBe(1);
  });
});
