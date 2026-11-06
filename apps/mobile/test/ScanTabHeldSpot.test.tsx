import { act, screen, userEvent } from '@testing-library/react-native';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeParkingSessionClient } from './fakeParkingSessionClient';
import { julieHoldAtParkingDemo, FakeSpotHoldClient } from './fakeSpotHoldClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

async function scanWithHold(entry: FakeEntryClient) {
  const spotHold = new FakeSpotHoldClient(julieHoldAtParkingDemo());
  await renderPalierApp({
    ...signedInJulie(),
    testSignInEnabled: false,
    clients: () => ({ entry, parkingSession: new FakeParkingSessionClient(null), spotHold, lots: new FakeLotsClient(parkingDemoWith(0)) }),
  });
  await screen.findByTestId('spot-hold-banner');
  const user = userEvent.setup();
  await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
  await screen.findByText('Aucune session en cours');
  const readsBeforeScan = spotHold.currentRequests;
  spotHold.activeHold = null;
  await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: 'Scanner' }));
  return { spotHold, user, readsBeforeScan };
}

async function letTheAppSettle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('the spot hold once an entry ends', () => {
  it('is read again exactly once when the barrier opens', async () => {
    const { spotHold, readsBeforeScan } = await scanWithHold(new FakeEntryClient());
    await screen.findByText('Barrière ouverte');
    await letTheAppSettle();

    expect(spotHold.currentRequests).toBe(readsBeforeScan + 1);
  });

  it('shows no banner on Stationnements after the barrier opens', async () => {
    const { user } = await scanWithHold(new FakeEntryClient());
    await screen.findByText('Barrière ouverte');
    await letTheAppSettle();
    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));

    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });

  it('is read again exactly once when the admission is refused after the hold was used', async () => {
    const entry = new FakeEntryClient();
    entry.nextRejection = 'CARD_DECLINED';
    const { spotHold, readsBeforeScan } = await scanWithHold(entry);
    await screen.findByText(/carte/i);
    await letTheAppSettle();

    expect(spotHold.currentRequests).toBe(readsBeforeScan + 1);
  });
});
