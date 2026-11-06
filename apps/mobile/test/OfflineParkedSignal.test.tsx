import { screen } from '@testing-library/react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { memoryQueueStorage } from '../src/parkingSessions/ParkedSignalQueue';
import { SENT_BANNER_MILLISECONDS } from '../src/parkingSessions/useParkedSignalBanner';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { julieWithPanel, pressInPanel, SENT_FR, WAITING_FR, WALKING } from './offlineSignalRig';
import { visibleText } from './visibleText';
import { advance, GO_TO_A1, PARKED_IN_A1 } from './walkAwayRig';

describe('keeping the parking signal when the network drops (story #26)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('shows « Hors ligne — 1 signal en attente » and sends nothing while the network is cut', async () => {
    const { user, parkingSession } = await julieWithPanel();

    await pressInPanel(user, 'Réseau coupé');
    await pressInPanel(user, WALKING);

    expect(await screen.findByText(WAITING_FR, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toHaveLength(0);
    expect(screen.getByText(GO_TO_A1, visibleText)).toBeOnTheScreen();
  });

  it('sends the signal with the time of the walk when the network is back, and shows « 1 signal envoyé » for 5 seconds', async () => {
    const { user, parkingSession } = await julieWithPanel();
    await pressInPanel(user, 'Réseau coupé');
    const beforeWalk = Date.now();
    await pressInPanel(user, WALKING);
    await advance(8000);

    await pressInPanel(user, 'Réseau rétabli');

    expect(parkingSession.parkedReports).toEqual([{ sessionId: 'session-1', detectedAt: expect.any(Number), aisleMinor: null }]);
    expect(parkingSession.parkedReports[0]?.detectedAt).toBeGreaterThanOrEqual(beforeWalk);
    expect(parkingSession.parkedReports[0]?.detectedAt).toBeLessThan(beforeWalk + 4000);
    expect(await screen.findByText(SENT_FR, visibleText)).toBeOnTheScreen();
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(WAITING_FR, visibleText)).toBeNull();
    await advance(SENT_BANNER_MILLISECONDS);
    expect(screen.queryByText(SENT_FR, visibleText)).toBeNull();
  });

  it('sends it once when the network comes back twice', async () => {
    const { user, parkingSession } = await julieWithPanel();
    await pressInPanel(user, 'Réseau coupé');
    await pressInPanel(user, WALKING);
    await pressInPanel(user, 'Réseau rétabli');
    await pressInPanel(user, 'Réseau coupé');

    await pressInPanel(user, 'Réseau rétabli');

    expect(parkingSession.parkedReports).toHaveLength(1);
  });

  it('keeps a signal lost to an unreachable API and sends it when the driver asks for the queue to be flushed', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    const { user } = await julieWithPanel('fr', memoryQueueStorage(), parkingSession);
    parkingSession.parkedFailure = new PalierUnreachableError('offline');
    await pressInPanel(user, WALKING);
    parkingSession.parkedFailure = null;

    await pressInPanel(user, 'flushOfflineQueue');

    expect(parkingSession.parkedReports).toHaveLength(2);
    expect(parkingSession.parkedReports[1]?.detectedAt).toBe(parkingSession.parkedReports[0]?.detectedAt);
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
  });

  it('shows « Offline — 1 signal waiting » on an English device', async () => {
    const { user } = await julieWithPanel('en');

    await pressInPanel(user, 'Réseau coupé', 'en');
    await pressInPanel(user, WALKING, 'en');

    expect(await screen.findByText('Offline — 1 signal waiting', visibleText)).toBeOnTheScreen();
  });

  it('shows « 1 signal sent » on an English device once the network is back', async () => {
    const { user } = await julieWithPanel('en');
    await pressInPanel(user, 'Réseau coupé', 'en');
    await pressInPanel(user, WALKING, 'en');

    await pressInPanel(user, 'Réseau rétabli', 'en');

    expect(await screen.findByText('1 signal sent', visibleText)).toBeOnTheScreen();
  });

  it('shows nothing while the network is up and nothing waits', async () => {
    const { user } = await julieWithPanel();

    await pressInPanel(user, WALKING);

    expect(screen.queryByText(/Hors ligne/, visibleText)).toBeNull();
    expect(screen.queryByText(/signal/, visibleText)).toBeNull();
  });
});
