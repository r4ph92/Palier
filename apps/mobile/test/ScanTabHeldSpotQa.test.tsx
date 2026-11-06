import { act, screen, userEvent } from '@testing-library/react-native';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeParkingSessionClient } from './fakeParkingSessionClient';
import { julieHoldAtParkingDemo, FakeSpotHoldClient } from './fakeSpotHoldClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

async function julieHoldingOnTheScanner(language: 'fr' | 'en' = 'fr') {
  const spotHold = new FakeSpotHoldClient(julieHoldAtParkingDemo());
  const entry = new FakeEntryClient();
  await renderPalierApp({
    ...signedInJulie(),
    language,
    testSignInEnabled: false,
    clients: () => ({ entry, parkingSession: new FakeParkingSessionClient(null), spotHold, lots: new FakeLotsClient(parkingDemoWith(0)) }),
  });
  expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
  const user = userEvent.setup();
  return { spotHold, entry, user };
}

describe('QA #9: the hold banner once the entry used the hold', () => {
  it('is gone from Stationnements when the driver left the Scanner tab before the barrier answer arrived', async () => {
    const { spotHold, entry, user } = await julieHoldingOnTheScanner();
    entry.holdsAnswer = true;
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    await screen.findByText('Aucune session en cours');
    await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
    await user.press(screen.getByRole('button', { name: 'Scanner' }));

    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    spotHold.activeHold = null;
    await act(async () => entry.answer());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });

  it('reads the hold again only once for one entry, however often the entry screen renders', async () => {
    const { spotHold, user } = await julieHoldingOnTheScanner('en');
    await user.press(await screen.findByRole('tab', { name: 'Scan' }));
    await screen.findByText('No session in progress');
    const readsBeforeScan = spotHold.currentRequests;
    spotHold.activeHold = null;
    await user.type(screen.getByLabelText('QR content'), ENTREE_DEMO_QR);
    await user.press(screen.getByRole('button', { name: 'Scan' }));
    await screen.findByText('Barrier open');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(spotHold.currentRequests).toBe(readsBeforeScan + 1);
  });

  it('stays while a scan is refused LOT_FULL, the hold being untouched', async () => {
    const { entry, user } = await julieHoldingOnTheScanner();
    entry.nextRejection = 'LOT_FULL';
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    await screen.findByText('Aucune session en cours');
    await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    await screen.findByText('Complet — la barrière reste fermée');
    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));

    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
  });
});
