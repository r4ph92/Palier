import { act, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import { ENTRY_STATUS_POLL_MILLISECONDS } from '../src/entries/useConfirmationPolling';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeParkingSessionClient, julieAtParkingDemo, spotB3 } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { asSeen, visibleText } from './visibleText';
import { advance, julieWith } from './walkAwayRig';
import { AISLE_B_MINOR, julieAskedInAisleB, WHERE_PARKED } from './whereParkedRig';

const UNREACHABLE = 'Impossible de joindre Palier. Vérifiez votre connexion, puis réessayez.';

describe('answering where Julie parked, the edges (story #21)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('keeps « Confirmer » disabled while the field is empty', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();

    await user.press(screen.getByRole('button', { name: 'Confirmer' }));

    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('keeps « Confirmer » disabled for a field of spaces only', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();

    await user.type(screen.getByLabelText('Numéro de place'), '   ');
    await user.press(screen.getByRole('button', { name: 'Confirmer' }));

    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
    expect(parkingSession.spotAnswers).toEqual([]);
  });

  it('sends one answer for two taps before Palier answers', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();
    parkingSession.holdsSpotAnswer = true;

    await user.press(screen.getByRole('button', { name: 'B-3' }));
    await user.press(screen.getByRole('button', { name: 'B-1' }));
    await act(async () => parkingSession.answerSpotAnswers());

    expect(parkingSession.spotAnswers).toEqual(['B-3']);
    expect(await screen.findByText('Garé en B-3', visibleText)).toBeOnTheScreen();
  });

  it('says Palier cannot be reached, and announces it again on a second failed try', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    const { user, parkingSession } = await julieAskedInAisleB();
    parkingSession.answerFailure = new PalierUnreachableError('offline');

    await user.press(screen.getByRole('button', { name: 'B-3' }));
    await user.press(screen.getByRole('button', { name: 'B-3' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE, visibleText);
    expect(announce.mock.calls.filter(([message]) => asSeen(message) === UNREACHABLE)).toHaveLength(2);
  });

  it.each(['NOT_ASKED', 'SESSION_CLOSED'])('reads the session again when Palier answers %s, without an error', async (code) => {
    const { user, parkingSession } = await julieAskedInAisleB();
    parkingSession.answerFailure = new PalierRejectedError(code);
    parkingSession.session = julieAtParkingDemo({ state: 'PARKED_CONFIRMED', spot: spotB3 });

    await user.press(screen.getByRole('button', { name: 'B-1' }));

    expect(await screen.findByText('Garé en B-3', visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers only the field when aisle B has no free spot', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo({ state: 'PARKED_UNCONFIRMED', question: { aisleCode: 'B', freeSpotNumbers: [] } }));
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ parkingSession }) });

    expect(await screen.findByRole('header', { name: WHERE_PARKED })).toBeOnTheScreen();
    expect(screen.queryByText(/Places libres/)).toBeNull();
    expect(screen.getByLabelText('Numéro de place')).toBeOnTheScreen();
  });

  it('sends no second walk while the question waits', async () => {
    const { walkAway, parkingSession } = await julieAskedInAisleB();

    await walkAway();

    expect(parkingSession.parkedReports).toHaveLength(1);
  });

  it('keeps the question, with the offline notice, when the minute read fails', async () => {
    const { parkingSession } = await julieAskedInAisleB();
    parkingSession.failure = new PalierUnreachableError('offline');

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByRole('header', { name: WHERE_PARKED })).toBeOnTheScreen();
    expect(screen.getByText('Hors ligne, montant au dernier relevé')).toBeOnTheScreen();
  });
});

describe('walking away in aisle B right after the scan, without « Terminé » (story #21)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 2) }));
  afterEach(() => jest.useRealTimers());

  it('leaves the scan result for the question', async () => {
    const toolkit = createSimulatedToolkit(() => Date.now());
    const positioning = new PositioningCore(toolkit.module);
    const entry = new FakeEntryClient();
    const parkingSession = new FakeParkingSessionClient(null);
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, developerEntry: toolkit.bind(positioning), positioning, clients: () => ({ entry, parkingSession }) });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    parkingSession.session = julieAtParkingDemo({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
    await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    entry.sessionState = 'ENTRY_CONFIRMED';
    parkingSession.session = julieAtParkingDemo({ elapsedMinutes: 0, amountCents: 75 });
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    await screen.findByText('Entrée confirmée');
    const simulator = toolkit.module as SimulatedPositioningModule;

    await act(async () => {
      simulator.enterAisle(AISLE_B_MINOR);
      simulator.detectParked('high');
    });

    expect(await screen.findByRole('header', { name: WHERE_PARKED })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Terminé' })).toBeNull();
  });
});

describe('a walk in the assigned aisle (story #21)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('asks nothing and shows « Garé en A-1 »', async () => {
    const { enterAisle, walkAway } = await julieWith(julieAtParkingDemo());
    await enterAisle(1);

    await walkAway();

    expect(await screen.findByText('Garé en A-1', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(WHERE_PARKED, visibleText)).toBeNull();
  });
});
