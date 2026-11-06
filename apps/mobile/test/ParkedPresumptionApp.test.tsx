import { act, screen, userEvent, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { asSeen, visibleText } from './visibleText';
import { advance, GO_TO_A1, julieWith, PARKED_IN_A1 } from './walkAwayRig';

const WALKING = 'Stationné (à pied, confiance élevée)';
const KEEP_ALIVE_STOPPED = /^\d{1,2} h \d{2} min \d{2} s\s+keepAlive until=\d{1,2} h \d{2} min \d{2} s \(arrêt\)$/;

type User = ReturnType<typeof userEvent.setup>;

// Same wiring as App.tsx: the panel's simulated module feeds the core, and its journal shows the commands.
async function julieAtA1WithPanel(language: SupportedLanguage = 'fr') {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioning = new PositioningCore(toolkit.module);
  const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, developerEntry: toolkit.bind(positioning), positioning, clients: () => ({ parkingSession }) });
  await screen.findByText(GO_TO_A1, visibleText);
  return { user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }), parkingSession };
}

async function pressInPanel(user: User, signal: string) {
  await user.press(screen.getByRole('tab', { name: 'Compte' }));
  await user.press(await screen.findByRole('button', { name: 'Développeur' }));
  await user.press(await screen.findByRole('button', { name: signal }));
}

describe('presuming the spot occupied when Julie walks away (story #18)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('shows « Garé en A-1 » without asking anything after « Allée 1 » then « Stationné », and logs the keep-alive stopped', async () => {
    const { user, parkingSession } = await julieAtA1WithPanel();
    await pressInPanel(user, 'Allée 1');
    const beforeWalk = Date.now();

    await pressInPanel(user, WALKING);

    expect(parkingSession.parkedReports).toEqual([{ sessionId: 'session-1', detectedAt: expect.any(Number) }]);
    expect(parkingSession.parkedReports[0]?.detectedAt).toBeGreaterThanOrEqual(beforeWalk);
    expect(within(screen.getByTestId('Journal')).getAllByText(KEEP_ALIVE_STOPPED)).toHaveLength(1);
    await user.press(screen.getByRole('tab', { name: 'Session' }));
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(GO_TO_A1, visibleText)).toBeNull();
    expect(screen.queryByRole('button', { name: /garé|place/i })).toBeNull();
  });

  it('presumes A-1 the same way when no aisle was detected yet', async () => {
    const { walkAway, parkingSession, keepAliveCommands } = await julieWith(julieAtParkingDemo());

    await walkAway();

    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toHaveLength(1);
    expect(keepAliveCommands()).toEqual([expect.stringMatching(/\(arrêt\)$/)]);
  });

  it('sends nothing again when the same walking signal arrives once the spot is presumed', async () => {
    const { walkAway, parkingSession, keepAliveCommands } = await julieWith(julieAtParkingDemo());
    await walkAway();
    await screen.findByText(PARKED_IN_A1, visibleText);

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(1);
    expect(keepAliveCommands()).toHaveLength(1);
  });

  it('sends one request for two walking signals that arrive before Palier answers', async () => {
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());
    parkingSession.holdsParkedAnswer = true;

    await walkAway();
    await walkAway();
    await act(async () => parkingSession.answerParked());

    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    expect(parkingSession.parkedReports).toHaveLength(1);
  });

  it('sends nothing again for this session even when a later read still says the entry is only confirmed', async () => {
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());
    await walkAway();
    parkingSession.session = julieAtParkingDemo();
    await advance(SESSION_REFRESH_MILLISECONDS);
    await screen.findByText(GO_TO_A1, visibleText);

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(1);
  });

  it('shows the spot number of « Garé en A-1 » in mono, and reads the spot with its state as one stop', async () => {
    const { walkAway } = await julieWith(julieAtParkingDemo());

    await walkAway();

    const parkedIn = await screen.findByText(PARKED_IN_A1, visibleText);
    expect(within(parkedIn).getByText('A-1', visibleText)).toHaveStyle({ fontFamily: 'IBMPlexMono_600SemiBold' });
    expect(screen.getByLabelText('A-1 · Palier P1 · Allée A. Garé en A-1', visibleText)).toBeOnTheScreen();
  });

  it('announces « Garé en A-1 » once, not again on the minute poll, and moves no focus', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());

    await walkAway();
    await screen.findByText(PARKED_IN_A1, visibleText);
    parkingSession.session = julieAtParkingDemo({ state: 'PARKED_PRESUMED', elapsedMinutes: 196 });
    await advance(SESSION_REFRESH_MILLISECONDS);

    const parkedAnnouncements = announce.mock.calls.filter(([message]) => asSeen(message) === PARKED_IN_A1);
    expect(parkedAnnouncements).toHaveLength(1);
    expect(focus).not.toHaveBeenCalled();
  });

  it('announces nothing for a session already parked when the app opens', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();

    await julieWith(julieAtParkingDemo({ state: 'PARKED_PRESUMED' }));

    expect(announce.mock.calls.filter(([message]) => asSeen(message) === PARKED_IN_A1)).toHaveLength(0);
  });

  it('reads « Parked in A-1 » on an English device', async () => {
    const { walkAway } = await julieWith(julieAtParkingDemo(), 'en');

    await walkAway();

    expect(await screen.findByText('Parked in A-1', visibleText)).toBeOnTheScreen();
  });
});

describe('a walking signal Palier refuses (story #18)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('keeps the screen and the keep-alive as they were when the entry still waits for its loop', async () => {
    const { walkAway, parkingSession, keepAliveCommands } = await julieWith(julieAtParkingDemo({ state: 'CREATED' }));
    parkingSession.parkedFailure = new PalierRejectedError('ENTRY_NOT_CONFIRMED');

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(1);
    expect(screen.getByText('Entrée en attente de confirmation')).toBeOnTheScreen();
    expect(keepAliveCommands()).toEqual([]);
  });

  it('sends the next walking signal once the loop confirmed the entry, and shows « Garé en A-1 »', async () => {
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo({ state: 'CREATED' }));
    parkingSession.parkedFailure = new PalierRejectedError('ENTRY_NOT_CONFIRMED');
    await walkAway();
    parkingSession.parkedFailure = null;
    parkingSession.session = julieAtParkingDemo();
    await advance(SESSION_REFRESH_MILLISECONDS);

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(2);
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
  });

  it('keeps the screen without an error when Palier cannot be reached', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());
    parkingSession.parkedFailure = new PalierUnreachableError('offline');

    await walkAway();

    expect(screen.getByText(GO_TO_A1, visibleText)).toBeOnTheScreen();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('logs an unexpected failure instead of letting it escape', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());
    parkingSession.parkedFailure = new TypeError('boom');

    await walkAway();

    expect(consoleError).toHaveBeenCalledWith('Reporting the walk away from the car failed', expect.any(TypeError));
    expect(screen.getByText(GO_TO_A1, visibleText)).toBeOnTheScreen();
    consoleError.mockRestore();
  });
});
