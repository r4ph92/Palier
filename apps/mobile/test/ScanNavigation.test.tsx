import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakePaymentMethodClient } from './fakePaymentMethodClient';
import { FakeVehicleClient } from './fakeVehicleClient';

// The card page renders Stripe's native card field, which has no test renderer.
jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;

async function scanWithoutPrerequisites() {
  applyLanguage('fr');
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  const entryClient = new FakeEntryClient();
  entryClient.nextRejection = 'PREREQUISITES_MISSING';
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <PalierApp
        authClient={authClient}
        tokenStore={new MemoryTokenStore(JULIE_TOKEN)}
        testSignInEnabled={false}
        createLotsClient={() => new FakeLotsClient(parkingDemoWith(10))}
        createPaymentMethodClient={() => new FakePaymentMethodClient()}
        createVehicleClient={() => new FakeVehicleClient()}
        createEntryClient={() => entryClient}
      />
    </SafeAreaProvider>,
  );
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
