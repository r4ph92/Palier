import { act, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { RETRY_MILLISECONDS } from '../src/parkingSessions/OfflineWalkSender';
import { SENT_NOTICE_MILLISECONDS } from '../src/parkingSessions/useOfflineWalks';
import { MemoryOfflineWalkStore } from './fakeOfflineWalkStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { julieWithPanelNetwork, PENDING_FR, SENT_FR, WALKING } from './offlineWalksAppRig';
import { visibleText } from './visibleText';
import { advance, GO_TO_A1, PARKED_IN_A1 } from './walkAwayRig';

const AT_18_05 = new Date(2026, 10, 4, 18, 5);
const FIVE_MINUTES = 5 * 60_000;

type User = Awaited<ReturnType<typeof julieWithPanelNetwork>>['user'];

async function pressInPanel(user: User, signal: string) {
  await user.press(screen.getByRole('tab', { name: 'Compte' }));
  await user.press(await screen.findByRole('button', { name: 'Développeur' }));
  await user.press(await screen.findByRole('button', { name: signal }));
  await user.press(screen.getByRole('tab', { name: 'Session' }));
}

describe('a walk while the garage network is down (story #26)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: AT_18_05 }));
  afterEach(() => jest.useRealTimers());

  it('shows « Hors ligne — 1 signal en attente » after « Réseau coupé » then « Stationné », and sends nothing', async () => {
    const { user, parkingSession } = await julieWithPanelNetwork();
    await pressInPanel(user, 'Réseau coupé');

    await pressInPanel(user, WALKING);

    expect(await screen.findByText(PENDING_FR, visibleText)).toBeOnTheScreen();
    expect(screen.getByText(GO_TO_A1, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toEqual([]);
  });

  it('sends the walk with its first instant once « Réseau rétabli » is tapped, then shows « 1 signal envoyé » and « Garé en A-1 »', async () => {
    const { user, parkingSession } = await julieWithPanelNetwork();
    await pressInPanel(user, 'Réseau coupé');
    await pressInPanel(user, WALKING);
    await screen.findByText(PENDING_FR, visibleText);
    const walkedAt = Date.now();
    await advance(FIVE_MINUTES);

    await pressInPanel(user, 'Réseau rétabli');

    expect(await screen.findByText(SENT_FR, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toHaveLength(1);
    const detectedAt = parkingSession.parkedReports[0]?.detectedAt ?? Number.NaN;
    expect(detectedAt).toBeLessThanOrEqual(walkedAt);
    expect(Date.now() - detectedAt).toBeGreaterThanOrEqual(FIVE_MINUTES);
    expect(screen.getByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(PENDING_FR, visibleText)).toBeNull();
  });

  it('sends the aisle seen at the walk, not the one seen when the network came back', async () => {
    const { signal, parkingSession } = await julieWithPanelNetwork();
    await signal((simulator) => simulator.setConnectivity('offline'));
    await signal((simulator) => simulator.enterAisle(1));
    await signal((simulator) => simulator.detectParked('high'));
    await signal((simulator) => simulator.enterAisle(2));

    await signal((simulator) => simulator.setConnectivity('online'));

    expect(parkingSession.parkedReports).toEqual([expect.objectContaining({ aisleMinor: 1 })]);
  });

  it('clears « 1 signal envoyé » after 8 s', async () => {
    const { signal } = await julieWithPanelNetwork();
    await signal((simulator) => simulator.setConnectivity('offline'));
    await signal((simulator) => simulator.detectParked('high'));
    await signal((simulator) => simulator.setConnectivity('online'));
    await screen.findByText(SENT_FR, visibleText);

    await advance(SENT_NOTICE_MILLISECONDS);

    expect(screen.queryByText(SENT_FR, visibleText)).toBeNull();
    expect(screen.getByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
  });

  it('announces the waiting walk to VoiceOver without cutting off another announcement', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockClear();
    const { signal } = await julieWithPanelNetwork();
    await signal((simulator) => simulator.setConnectivity('offline'));

    await signal((simulator) => simulator.detectParked('high'));

    expect(announce).toHaveBeenCalledWith('Hors ligne — 1 signal en attente', { queue: true });
  });

  it('merges a second walk into the waiting one and sends only the first, once', async () => {
    const { signal, parkingSession } = await julieWithPanelNetwork();
    await signal((simulator) => simulator.setConnectivity('offline'));
    await signal((simulator) => simulator.detectParked('high'));
    const firstWalkAt = Date.now();
    await advance(FIVE_MINUTES);
    await signal((simulator) => simulator.detectParked('high'));

    await signal((simulator) => simulator.setConnectivity('online'));

    expect(parkingSession.parkedReports).toHaveLength(1);
    expect(parkingSession.parkedReports[0]?.detectedAt).toBeLessThanOrEqual(firstWalkAt);
  });

  it('reads « Offline — 1 signal waiting » on an English device', async () => {
    const { signal } = await julieWithPanelNetwork({ language: 'en' });
    await signal((simulator) => simulator.setConnectivity('offline'));

    await signal((simulator) => simulator.detectParked('high'));

    expect(await screen.findByText('Offline — 1 signal waiting', visibleText)).toBeOnTheScreen();
  });

  it('reads « 1 signal sent » on an English device once it went through', async () => {
    const { signal } = await julieWithPanelNetwork({ language: 'en' });
    await signal((simulator) => simulator.setConnectivity('offline'));
    await signal((simulator) => simulator.detectParked('high'));

    await signal((simulator) => simulator.setConnectivity('online'));

    expect(await screen.findByText('1 signal sent', visibleText)).toBeOnTheScreen();
  });

  it('shows no signal notice when nothing waits and nothing was sent again', async () => {
    const { signal } = await julieWithPanelNetwork();

    await signal((simulator) => simulator.detectParked('high'));

    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(/signal/, visibleText)).toBeNull();
  });
});

describe('a walk kept when Palier cannot be reached (story #26)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: AT_18_05 }));
  afterEach(() => jest.useRealTimers());

  it('sends it again within 10 s once Palier answers', async () => {
    const { signal, parkingSession } = await julieWithPanelNetwork();
    parkingSession.parkedFailure = new PalierUnreachableError('offline');
    await signal((simulator) => simulator.detectParked('high'));
    await screen.findByText(PENDING_FR, visibleText);
    parkingSession.parkedFailure = null;

    await advance(RETRY_MILLISECONDS);

    expect(await screen.findByText(SENT_FR, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toHaveLength(2);
  });

  it('tries nothing more once the app is closed', async () => {
    const { signal, parkingSession, unmount } = await julieWithPanelNetwork();
    parkingSession.parkedFailure = new PalierUnreachableError('offline');
    await signal((simulator) => simulator.detectParked('high'));

    await act(async () => unmount());
    await advance(3 * RETRY_MILLISECONDS);

    expect(parkingSession.parkedReports).toHaveLength(1);
  });
});

describe('a walk kept across a relaunch (story #26)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: AT_18_05 }));
  afterEach(() => jest.useRealTimers());

  it('is sent with its first instant by the app opened again with the network back', async () => {
    const store = new MemoryOfflineWalkStore();
    const first = await julieWithPanelNetwork({ store });
    await first.signal((simulator) => simulator.setConnectivity('offline'));
    await first.signal((simulator) => simulator.detectParked('high'));
    const walkedAt = Date.now();
    await act(async () => first.unmount());
    await advance(FIVE_MINUTES);

    const relaunched = await julieWithPanelNetwork({ store });

    expect(await screen.findByText(SENT_FR, visibleText)).toBeOnTheScreen();
    expect(relaunched.parkingSession.parkedReports).toEqual([{ sessionId: 'session-1', detectedAt: expect.any(Number), aisleMinor: null }]);
    expect(relaunched.parkingSession.parkedReports[0]?.detectedAt).toBeLessThanOrEqual(walkedAt);
    expect(store.walks).toEqual([]);
  });

  it('counts a walk Palier already had as sent, and leaves the parked session as it was (C4, API: parkedPresumptionRoute.test.ts)', async () => {
    const detectedAt = AT_18_05.getTime();
    const store = new MemoryOfflineWalkStore([{ sessionId: 'session-1', detectedAt, aisleMinor: 1 }]);
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo({ state: 'PARKED_PRESUMED' }));

    await julieWithPanelNetwork({ store, parkingSession });

    expect(await screen.findByText(SENT_FR, visibleText)).toBeOnTheScreen();
    expect(screen.getByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toEqual([{ sessionId: 'session-1', detectedAt, aisleMinor: 1 }]);
    expect(store.walks).toEqual([]);
  });

  it('sends it once when the session starts and « Réseau rétabli » come together', async () => {
    const detectedAt = AT_18_05.getTime();
    const store = new MemoryOfflineWalkStore([{ sessionId: 'session-1', detectedAt, aisleMinor: null }]);
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    parkingSession.holdsParkedAnswer = true;
    const { signal } = await julieWithPanelNetwork({ store, parkingSession });

    await signal((simulator) => simulator.setConnectivity('online'));
    await act(async () => parkingSession.answerParked());

    expect(await screen.findByText(SENT_FR, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toHaveLength(1);
  });

  it('is forgotten when Julie signs out', async () => {
    const store = new MemoryOfflineWalkStore();
    const { signal, user } = await julieWithPanelNetwork({ store });
    await signal((simulator) => simulator.setConnectivity('offline'));
    await signal((simulator) => simulator.detectParked('high'));

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));

    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Compte' })).toBeNull());
    expect(store.walks).toEqual([]);
  });
});
