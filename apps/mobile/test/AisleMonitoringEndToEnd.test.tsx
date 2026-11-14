import { act, screen, userEvent, within } from '@testing-library/react-native';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeParkingSessionClient, julieAtB3 } from './fakeParkingSessionClient';
import { positioningRig } from './positioningRig';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';

const MONITORED_UUID = PLATFORM_BEACON_UUID.slice(0, 8);
const START_MONITORING_LINE = new RegExp(`^\\d{1,2} h \\d{2} min \\d{2} s\\s+startMonitoring uuid=${MONITORED_UUID} major=1$`);
const STOP_MONITORING_LINE = /^\d{1,2} h \d{2} min \d{2} s\s+stopMonitoring$/;

type User = ReturnType<typeof userEvent.setup>;

async function signedInWithoutSession() {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioning = new PositioningCore(toolkit.module);
  const parkingSession = new FakeParkingSessionClient(null);
  const clients = () => ({ entry: new FakeEntryClient(), parkingSession });
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, developerEntry: toolkit.bind(positioning), positioning, clients });
  await screen.findByText('Parking Démo');
  return { user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }), parkingSession };
}

async function scanAtEntreeDemo(user: User, parkingSession: FakeParkingSessionClient) {
  await user.press(screen.getByRole('tab', { name: 'Scanner' }));
  await screen.findByText('Aucune session en cours');
  parkingSession.session = julieAtB3({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
  await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: 'Scanner' }));
  await user.press(await screen.findByRole('button', { name: 'Terminé' }));
}

async function journalLines(user: User, pattern: RegExp) {
  await user.press(screen.getByRole('tab', { name: 'Compte' }));
  await user.press(await screen.findByRole('button', { name: 'Développeur' }));
  return within(await screen.findByTestId('Journal')).queryAllByText(pattern);
}

async function advanceOnePoll() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SESSION_REFRESH_MILLISECONDS);
  });
}

describe('beacon monitoring over the session (story #17)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 2) }));
  afterEach(() => jest.useRealTimers());

  it('logs nothing before the scan', async () => {
    const { user } = await signedInWithoutSession();

    expect(await journalLines(user, START_MONITORING_LINE)).toHaveLength(0);
  });

  it('logs "startMonitoring major=1" once the barrier opens, and only once after a minute poll', async () => {
    const { user, parkingSession } = await signedInWithoutSession();
    await scanAtEntreeDemo(user, parkingSession);

    expect(await journalLines(user, START_MONITORING_LINE)).toHaveLength(1);
    parkingSession.session = julieAtB3({ elapsedMinutes: 1 });
    await advanceOnePoll();
    expect(await journalLines(user, START_MONITORING_LINE)).toHaveLength(1);
    expect(await journalLines(user, STOP_MONITORING_LINE)).toHaveLength(0);
  });

  it('logs "stopMonitoring" once the session is closed', async () => {
    const { user, parkingSession } = await signedInWithoutSession();
    await scanAtEntreeDemo(user, parkingSession);
    parkingSession.session = null;

    await advanceOnePoll();

    expect(await journalLines(user, STOP_MONITORING_LINE)).toHaveLength(1);
  });
});

describe('signing out', () => {
  it('sends no stopMonitoring when Julie had no session', async () => {
    const { core, commands } = positioningRig();
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, positioning: core, clients: () => ({ parkingSession: new FakeParkingSessionClient(null) }) });
    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: 'Compte' }));

    await user.press(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(commands()).toEqual([]);
  });

  it('stops monitoring when Julie signs out during her session', async () => {
    const { core, commands } = positioningRig();
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, positioning: core, clients: () => ({ parkingSession: new FakeParkingSessionClient(julieAtB3()) }) });
    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: 'Compte' }));

    await user.press(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(commands()).toEqual([`startMonitoring uuid=${MONITORED_UUID} major=1`, 'stopMonitoring']);
  });
});
