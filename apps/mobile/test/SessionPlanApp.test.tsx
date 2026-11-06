import { act, screen, userEvent, within } from '@testing-library/react-native';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { FakeParkingSessionClient, julieAtB3 } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { visibleText } from './visibleText';

// The jest preset reports a font scale of 2; the markers sit inside the rectangles at the default size.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

const GO_TO_B3 = 'Rendez-vous allée B, place B-3';
const IN_AISLE_A = 'Vous êtes dans l’allée A — votre place est dans l’allée B';

// Same wiring as App.tsx: the panel's simulated module feeds the core the session screen listens to.
async function relaunchAtB3(language: SupportedLanguage = 'fr') {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioning = new PositioningCore(toolkit.module);
  const parkingSession = new FakeParkingSessionClient(julieAtB3());
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

  it('reads « Go to aisle B, spot B-3 » on an English device', async () => {
    await relaunchAtB3('en');

    expect(await screen.findByText('Go to aisle B, spot B-3', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Plan of level P1: aisle B highlighted, spot B-3', ...visibleText })).toBeOnTheScreen();
  });
});
