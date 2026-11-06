import { act, screen, userEvent } from '@testing-library/react-native';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import { ENTRY_STATUS_POLL_MILLISECONDS } from '../src/entries/useConfirmationPolling';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { visibleText } from './visibleText';
import { advance, julieWith, PARKED_IN_A1 } from './walkAwayRig';

describe('walking signals that presume nothing (story #18)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('sends nothing for a low-confidence signal, and acts on a medium one', async () => {
    const { walkAway, parkingSession } = await julieWith(julieAtParkingDemo());

    await walkAway('low');
    expect(parkingSession.parkedReports).toHaveLength(0);

    await walkAway('medium');
    expect(parkingSession.parkedReports).toHaveLength(1);
  });

  it('sends nothing after aisle B was detected, since the spot is in aisle A (story #21)', async () => {
    const { walkAway, enterAisle, parkingSession } = await julieWith(julieAtParkingDemo());
    await enterAisle(2);

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(0);
    expect(screen.getByText('Vous êtes dans l’allée B — votre place est dans l’allée A', visibleText)).toBeOnTheScreen();
  });

  it('sends nothing when aisle B and the walk arrive in the same instant', async () => {
    const { simulator, parkingSession } = await julieWith(julieAtParkingDemo());

    await act(async () => {
      simulator.enterAisle(2);
      simulator.detectParked('high');
    });

    expect(parkingSession.parkedReports).toHaveLength(0);
  });

  it('keeps aisle A for a minor that belongs to no aisle, and presumes A-1', async () => {
    const { walkAway, enterAisle, parkingSession } = await julieWith(julieAtParkingDemo());
    await enterAisle(1);
    await enterAisle(9);

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(1);
  });
});

async function scanAndConfirmAtA1(language: SupportedLanguage) {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioning = new PositioningCore(toolkit.module);
  const entry = new FakeEntryClient();
  const parkingSession = new FakeParkingSessionClient(null);
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, developerEntry: toolkit.bind(positioning), positioning, clients: () => ({ entry, parkingSession }) });
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
  await user.press(await screen.findByRole('tab', { name: language === 'fr' ? 'Scanner' : 'Scan' }));
  parkingSession.session = julieAtParkingDemo({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
  await user.type(screen.getByLabelText(language === 'fr' ? 'Contenu du QR' : 'QR content'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: language === 'fr' ? 'Scanner' : 'Scan' }));
  entry.sessionState = 'ENTRY_CONFIRMED';
  parkingSession.session = julieAtParkingDemo({ elapsedMinutes: 0, amountCents: 75 });
  await advance(ENTRY_STATUS_POLL_MILLISECONDS);
  await screen.findByText(language === 'fr' ? 'Entrée confirmée' : 'Entry confirmed');
  return { simulator: toolkit.module as SimulatedPositioningModule, parkingSession };
}

describe('walking away right after the scan, without « Terminé » (story #18)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 2) }));
  afterEach(() => jest.useRealTimers());

  it.each([
    ['fr', PARKED_IN_A1],
    ['en', 'Parked in A-1'],
  ] as const)('leaves the scan result for the session presumed parked (%s)', async (language, parkedText) => {
    const { simulator } = await scanAndConfirmAtA1(language);

    await act(async () => simulator.detectParked('high'));

    expect(await screen.findByText(parkedText, visibleText)).toBeOnTheScreen();
  });

  it('shows the scan form, not A-1, once the session is closed after the walk', async () => {
    const { simulator, parkingSession } = await scanAndConfirmAtA1('fr');
    await act(async () => simulator.detectParked('high'));
    await screen.findByText(PARKED_IN_A1, visibleText);
    parkingSession.session = null;

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(await screen.findByText('Aucune session en cours')).toBeOnTheScreen();
    expect(screen.queryByText(/A-1/, visibleText)).toBeNull();
  });
});
