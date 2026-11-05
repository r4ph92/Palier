import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeParkingSessionClient } from './fakeParkingSessionClient';
import { julieHoldAtParkingDemo, FakeSpotHoldClient } from './fakeSpotHoldClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

describe('the spot hold once the entry uses it', () => {
  it('shows no hold after the barrier opens, the server having used it up', async () => {
    const spotHold = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderPalierApp({
      ...signedInJulie(),
      testSignInEnabled: false,
      clients: () => ({ entry: new FakeEntryClient(), parkingSession: new FakeParkingSessionClient(null), spotHold, lots: new FakeLotsClient(parkingDemoWith(0)) }),
    });
    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    const readsBeforeScan = spotHold.currentRequests;
    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    await screen.findByText('Aucune session en cours');

    spotHold.activeHold = null;
    await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    await screen.findByText('Barrière ouverte');
    await waitFor(() => expect(spotHold.currentRequests).toBe(readsBeforeScan + 1));
    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));

    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });
});
