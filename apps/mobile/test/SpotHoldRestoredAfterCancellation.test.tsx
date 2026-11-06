import { act, screen, userEvent } from '@testing-library/react-native';
import { ENTRY_STATUS_POLL_MILLISECONDS } from '../src/entries/useConfirmationPolling';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { visibleText } from './visibleText';

jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

describe('a hold used by an entry that is then cancelled', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it('shows the guaranteed spot banner again once the app learns of the cancellation', async () => {
    const spotHold = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    const entry = new FakeEntryClient();
    const parkingSession = new FakeParkingSessionClient(null);
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ entry, parkingSession, spotHold }) });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    parkingSession.session = julieAtParkingDemo({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
    await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
    // The server marks the hold used by the scan, then gives it back with the cancellation.
    spotHold.activeHold = null;
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    await screen.findByText('Barrière ouverte');
    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    spotHold.activeHold = julieHoldAtParkingDemo();
    entry.sessionState = 'CANCELLED';
    parkingSession.session = null;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(ENTRY_STATUS_POLL_MILLISECONDS * 3);
    });

    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(screen.queryByText('Barrière ouverte', visibleText)).not.toBeOnTheScreen();
  });
});
