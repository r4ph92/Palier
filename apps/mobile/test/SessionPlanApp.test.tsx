import type { CurrentParkingSession, LevelPlan } from '@palier/shared-types';
import { act, screen, userEvent, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { spotA1 } from './fakeEntryClient';
import { FakeParkingSessionClient, julieAtB3, julieAtParkingDemo, parkingDemoP1Plan } from './fakeParkingSessionClient';
import { positioningRig } from './positioningRig';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { asSeen, visibleText } from './visibleText';
import { PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';

// The jest preset reports a font scale of 2; the markers sit inside the rectangles at the default size.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

const GO_TO_B3 = 'Rendez-vous allée B, place B-3';
const IN_AISLE_A = 'Vous êtes dans l’allée A — votre place est dans l’allée B';

// Same wiring as App.tsx: the panel's simulated module feeds the core the session screen listens to.
async function relaunchAtB3(language: SupportedLanguage = 'fr', session = julieAtB3()) {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioning = new PositioningCore(toolkit.module);
  const parkingSession = new FakeParkingSessionClient(session);
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, developerEntry: toolkit.bind(positioning), positioning, clients: () => ({ parkingSession }) });
  await screen.findByRole('tab', { name: 'Session', selected: true });
  const simulator = toolkit.module as SimulatedPositioningModule;
  return { user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }), simulator, parkingSession };
}

async function pressInPanel(user: ReturnType<typeof userEvent.setup>, signal: string) {
  await user.press(screen.getByRole('tab', { name: 'Compte' }));
  await user.press(await screen.findByRole('button', { name: 'Développeur' }));
  await user.press(await screen.findByRole('button', { name: signal }));
  await user.press(screen.getByRole('tab', { name: 'Session' }));
}

function aisle(code: string) {
  return within(screen.getByTestId(`PlanAisle-${code}`));
}

describe('the level plan on the Session screen (story #17)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 21, 17) }));
  afterEach(() => jest.useRealTimers());

  it('shows level P1 with aisles A and B, B highlighted with B-3, and « Rendez-vous allée B, place B-3 »', async () => {
    await relaunchAtB3();

    expect(await screen.findByText(GO_TO_B3, visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Plan du niveau P1 : allée B en surbrillance, place B-3', ...visibleText })).toBeOnTheScreen();
    expect(aisle('A').getByText('Allée A')).toBeOnTheScreen();
    expect(aisle('B').getByText('Place B-3', visibleText)).toBeOnTheScreen();
  });

  it('puts « vous êtes ici » on aisle A after « Allée 1 », then says the right aisle after « Allée 2 »', async () => {
    const { user } = await relaunchAtB3();

    await pressInPanel(user, 'Allée 1');
    expect(await screen.findByText(IN_AISLE_A, visibleText)).toBeOnTheScreen();
    expect(aisle('A').getByText('Vous êtes ici')).toBeOnTheScreen();

    await pressInPanel(user, 'Allée 2');
    expect(await screen.findByText('Vous êtes dans la bonne allée')).toBeOnTheScreen();
    expect(aisle('B').getByText('Vous êtes ici')).toBeOnTheScreen();
    expect(aisle('A').queryByText('Vous êtes ici')).toBeNull();
  });

  it('changes nothing when the first minor received is 9, which belongs to no aisle of Parking Démo', async () => {
    const { simulator } = await relaunchAtB3();
    await screen.findByText(GO_TO_B3, visibleText);

    await act(async () => simulator.enterAisle(9));

    expect(screen.getByText(GO_TO_B3, visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes ici')).toBeNull();
  });

  it('keeps « allée A » when minor 9 follows « Allée 1 »', async () => {
    const { user, simulator } = await relaunchAtB3();
    await pressInPanel(user, 'Allée 1');

    await act(async () => simulator.enterAisle(9));

    expect(screen.getByText(IN_AISLE_A, visibleText)).toBeOnTheScreen();
    expect(aisle('A').getByText('Vous êtes ici')).toBeOnTheScreen();
  });

  it('keeps the aisle across the minute poll of the session', async () => {
    const { user, parkingSession } = await relaunchAtB3();
    await pressInPanel(user, 'Allée 1');
    parkingSession.session = julieAtB3({ elapsedMinutes: 196, amountCents: 1050 });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(SESSION_REFRESH_MILLISECONDS);
    });

    expect(screen.getByText('Montant à ce jour : 10,50 $', visibleText)).toBeOnTheScreen();
    expect(screen.getByText(IN_AISLE_A, visibleText)).toBeOnTheScreen();
  });

  it('does not tell VoiceOver that aisle B is highlighted when the operator has not drawn aisle B', async () => {
    const levelPlan = { ...parkingDemoP1Plan, aisles: parkingDemoP1Plan.aisles.map((planAisle) => (planAisle.code === 'B' ? { ...planAisle, rectangle: null } : planAisle)) };

    await relaunchAtB3('fr', julieAtB3({ levelPlan }));

    expect(screen.queryByTestId('PlanAisle-B')).toBeNull();
    expect(screen.getByRole('image', { name: 'Plan du niveau P1', ...visibleText })).toBeOnTheScreen();
  });

  it('reads « Go to aisle B, spot B-3 » on an English device', async () => {
    await relaunchAtB3('en');

    expect(await screen.findByText('Go to aisle B, spot B-3', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Plan of level P1: aisle B highlighted, spot B-3', ...visibleText })).toBeOnTheScreen();
  });
});

const MONITORED_UUID = PLATFORM_BEACON_UUID.slice(0, 8);
const START_MAJOR_1 = `startMonitoring uuid=${MONITORED_UUID} major=1`;

// A recording core, without the panel: the test sends the beacon signals itself and reads the commands.
async function relaunchWith(session: CurrentParkingSession | null, language: SupportedLanguage = 'fr') {
  const rig = positioningRig();
  const parkingSession = new FakeParkingSessionClient(session);
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, positioning: rig.core, clients: () => ({ parkingSession }) });
  await screen.findByRole('tab', { name: 'Session', selected: true });
  const enterAisle = (minor: number) => act(async () => rig.simulator.enterAisle(minor));
  return { ...rig, parkingSession, enterAisle };
}

async function advanceOnePoll() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SESSION_REFRESH_MILLISECONDS);
  });
}

function planWith(overrides: (code: string) => Partial<LevelPlan['aisles'][number]>): LevelPlan {
  return { ...parkingDemoP1Plan, aisles: parkingDemoP1Plan.aisles.map((planAisle) => ({ ...planAisle, ...overrides(planAisle.code) })) };
}

describe('the level plan across polls, sessions and signals (story #17)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 21, 17) }));
  afterEach(() => jest.useRealTimers());

  it('keeps the aisle sentence and monitoring when the minute poll fails offline', async () => {
    const { parkingSession, enterAisle, commands } = await relaunchWith(julieAtB3());
    await enterAisle(1);
    parkingSession.failure = new PalierUnreachableError('offline');

    await advanceOnePoll();

    expect(screen.getByText(IN_AISLE_A, visibleText)).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-A')).getByText('Vous êtes ici')).toBeOnTheScreen();
    expect(commands()).toEqual([START_MAJOR_1]);
  });

  it('starts over at « Rendez-vous » and restarts monitoring when a poll brings the next visit’s session', async () => {
    const { parkingSession, enterAisle, commands } = await relaunchWith(julieAtB3());
    await enterAisle(1);
    parkingSession.session = julieAtParkingDemo({ sessionId: 'session-2', spot: spotA1 });

    await advanceOnePoll();

    expect(await screen.findByText('Rendez-vous allée A, place A-1', visibleText, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes ici')).toBeNull();
    expect(commands()).toEqual([START_MAJOR_1, 'stopMonitoring', START_MAJOR_1]);
  });

  it('says « bonne allée » when the spot moves to the aisle the driver is already in, within the same session', async () => {
    const { parkingSession, enterAisle } = await relaunchWith(julieAtB3());
    await enterAisle(1);
    parkingSession.session = julieAtParkingDemo({ spot: { number: 'A-2', levelCode: 'P1', aisleCode: 'A' } });

    await advanceOnePoll();

    expect(await screen.findByText('Vous êtes dans la bonne allée')).toBeOnTheScreen();
  });

  it('shows the sentence without a drawing and monitors nothing for a session read from an older API', async () => {
    const { enterAisle, commands } = await relaunchWith(julieAtB3({ beaconMajor: null, levelPlan: null }));

    await enterAisle(1);

    expect(screen.getByText(GO_TO_B3, visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('image', { name: /Plan du niveau/ })).toBeNull();
    expect(commands()).toEqual([]);
  });

  it('announces an aisle change once, not again on the minute poll nor on minor 9', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    const { parkingSession, enterAisle } = await relaunchWith(julieAtB3());

    await enterAisle(1);
    parkingSession.session = julieAtB3({ elapsedMinutes: 196 });
    await advanceOnePoll();
    await enterAisle(9);

    const aisleAnnouncements = announce.mock.calls.map(([message]) => message).filter((message) => asSeen(message) === IN_AISLE_A);
    expect(aisleAnnouncements).toHaveLength(1);
  });

  it('reads the wrong-aisle and right-aisle sentences and the marker in English', async () => {
    const { enterAisle } = await relaunchWith(julieAtB3(), 'en');

    await enterAisle(1);
    expect(screen.getByText('You are in aisle A — your spot is in aisle B', visibleText)).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-A')).getByText('You are here')).toBeOnTheScreen();

    await enterAisle(2);
    expect(screen.getByText('You are in the right aisle')).toBeOnTheScreen();
  });

  it('shows a hostile aisle code literally', async () => {
    const hostile = '<script>alert(1)</script>';
    const plan = planWith((code) => (code === 'B' ? { code: hostile } : {}));

    await relaunchWith(julieAtB3({ spot: { number: 'B-3', levelCode: 'P1', aisleCode: hostile }, levelPlan: plan }));

    expect(screen.getByText(`Rendez-vous allée ${hostile}, place B-3`, visibleText)).toBeOnTheScreen();
  });
});

describe('signing out during a session (story #17)', () => {
  it('drops an aisle signal received after sign-out without sending any command', async () => {
    const { simulator, commands } = await relaunchWith(julieAtB3());
    const user = userEvent.setup();
    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('button', { name: 'Se déconnecter' }));

    await act(async () => simulator.enterAisle(1));

    expect(commands()).toEqual([START_MAJOR_1, 'stopMonitoring']);
    expect(screen.queryByText('Vous êtes ici')).toBeNull();
  });
});
