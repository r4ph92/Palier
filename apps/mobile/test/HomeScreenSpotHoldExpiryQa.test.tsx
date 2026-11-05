import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';
import { HOLD_BUTTON_FR, tick } from './spotHoldScreen';

const EXPIRED_FR = 'Votre place garantie a expiré';
const EXPIRED_EN = 'Your guaranteed spot has expired';
const RELEASE_FR = 'Libérer la garantie à Parking Démo';
const CONFIRM_FR = 'Oui, libérer la garantie à Parking Démo';

async function renderJulieHolding(spotHoldClient: FakeSpotHoldClient, language: 'fr' | 'en' = 'fr') {
  const lotsClient = new FakeLotsClient(parkingDemoWith(9));
  spotHoldClient.serverClockRuns = true;
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient }, language);
  await screen.findByTestId('spot-hold-banner');
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

function announcementsOf(message: string): number {
  return jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.filter(([announced]) => announced === message).length;
}

describe('QA HomeScreen expired spot hold', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 2));
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('closes an open release confirmation when the countdown reaches 0:00', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const user = await renderJulieHolding(spotHoldClient);
    await user.press(screen.getByRole('button', { name: RELEASE_FR }));
    expect(screen.getByRole('button', { name: CONFIRM_FR })).toBeOnTheScreen();

    await tick(15 * 60);

    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: CONFIRM_FR })).not.toBeOnTheScreen();
    expect(spotHoldClient.releasedIds).toEqual([]);
  });

  it('keeps the message and keeps reading while Palier is unreachable, then removes the banner once it answers none', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderJulieHolding(spotHoldClient);
    await tick(15 * 60);

    spotHoldClient.isReachable = false;
    await tick(10);
    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
    const readsWhileUnreachable = spotHoldClient.currentRequests;

    spotHoldClient.isReachable = true;
    spotHoldClient.activeHold = null;
    await tick(5);

    expect(readsWhileUnreachable).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });

  it('gives the guarantee buttons back once the server has ended the hold', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderJulieHolding(spotHoldClient);
    expect(screen.queryByRole('button', { name: HOLD_BUTTON_FR })).not.toBeOnTheScreen();
    await tick(15 * 60);

    spotHoldClient.activeHold = null;
    await tick(5);

    expect(screen.getByRole('button', { name: HOLD_BUTTON_FR })).toBeOnTheScreen();
  });

  it('announces the English message once on an English device, across the reads that still answer the hold', async () => {
    await renderJulieHolding(new FakeSpotHoldClient(julieHoldAtParkingDemo()), 'en');

    await tick(15 * 60);
    for (let read = 0; read < 4; read += 1) {
      await tick(5);
    }

    expect(screen.getByText(EXPIRED_EN)).toBeOnTheScreen();
    expect(announcementsOf(EXPIRED_EN)).toBe(1);
    expect(announcementsOf(EXPIRED_FR)).toBe(0);
  });

  it('counts a new hold read after the expired one down from at most 15:00, on the new hold', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderJulieHolding(spotHoldClient);
    await tick(15 * 60);
    await tick(20);
    const readsBefore = spotHoldClient.currentRequests;

    spotHoldClient.activeHold = julieHoldAtParkingDemo({ spotHoldId: 'hold-2', now: new Date(2026, 10, 4, 14, 2).toISOString(), expiresAt: new Date(2026, 10, 4, 14, 32, 20).toISOString() });
    await tick(5);

    expect(spotHoldClient.currentRequests).toBe(readsBefore + 1);
    expect(screen.getByTestId('spot-hold-banner').props.accessibilityLabel).toMatch(/14\sh\s32, Parking Démo, 15 minutes restantes$/);
    expect(screen.getByTestId('spot-hold-countdown')).toHaveTextContent(/^(15:00|14:5\d)$/);
  });

  it('shows the message on a refresh once Palier says the hold has ended, even though the device still counts time left', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const user = await renderJulieHolding(spotHoldClient);
    await tick(60);

    spotHoldClient.activeHold = julieHoldAtParkingDemo({ now: new Date(2026, 10, 4, 14, 17).toISOString() });
    await user.press(screen.getByRole('button', { name: 'Actualiser' }));
    await tick(1);

    expect(screen.getByText(EXPIRED_FR)).toBeOnTheScreen();
    expect(screen.queryByTestId('spot-hold-countdown')).not.toBeOnTheScreen();
  });

  it('shows the countdown again when Palier still gives the hold time left after the device clock jumped ahead', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderJulieHolding(spotHoldClient);
    await tick(60);
    // The fake measures the server's time with the device clock: frozen here, the server keeps its own time while the device jumps.
    spotHoldClient.serverClockRuns = false;

    jest.setSystemTime(Date.now() + 14 * 60 * 1000);
    await tick(1);
    spotHoldClient.activeHold = julieHoldAtParkingDemo({ now: new Date(2026, 10, 4, 14, 3, 6).toISOString() });
    await tick(5);

    expect(screen.queryByText(EXPIRED_FR)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: RELEASE_FR })).toBeOnTheScreen();
  });
});
