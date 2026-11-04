import { screen, userEvent } from '@testing-library/react-native';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { IPHONE_MINI_METRICS, renderPalierApp, signedInJulie } from './renderPalierApp';

// The card page renders Stripe's native card field, which has no test renderer.
jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

async function scanWithoutPrerequisites() {
  const entryClient = new FakeEntryClient();
  entryClient.nextRejection = 'PREREQUISITES_MISSING';
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, metrics: IPHONE_MINI_METRICS, clients: () => ({ entry: entryClient }) });
  const user = userEvent.setup();
  await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
  await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: 'Scanner' }));
  await screen.findByText('Ajoutez une plaque et une carte avant d’entrer');
  return user;
}

describe('the Scanner tab', () => {
  it('sits between Stationnements and Compte', async () => {
    await scanWithoutPrerequisites();

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityState?.selected)).toEqual([false, true, false]);
  });

  it('opens the vehicles page from "Ajouter une plaque"', async () => {
    const user = await scanWithoutPrerequisites();

    await user.press(screen.getByRole('button', { name: 'Ajouter une plaque' }));

    expect(await screen.findByRole('header', { name: 'Véhicules' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Compte', selected: true })).toBeOnTheScreen();
  });

  it('opens the card page from "Ajouter une carte"', async () => {
    const user = await scanWithoutPrerequisites();

    await user.press(screen.getByRole('button', { name: 'Ajouter une carte' }));

    expect(await screen.findByRole('header', { name: 'Moyen de paiement' })).toBeOnTheScreen();
  });
});
