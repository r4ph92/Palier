import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import type { DeveloperEntry } from '../src/screens/DeveloperEntry';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakePaymentMethodClient } from './fakePaymentMethodClient';
import { FakeVehicleClient } from './fakeVehicleClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;

const developerEntry: DeveloperEntry = {
  label: 'Développeur',
  Panel: ({ onBack }) => <Text onPress={onBack}>Panneau de test</Text>,
};

async function renderSignedInApp(entry: DeveloperEntry | undefined) {
  applyLanguage('fr');
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  const factories = {
    authClient,
    tokenStore: new MemoryTokenStore(JULIE_TOKEN),
    testSignInEnabled: false,
    createLotsClient: () => new FakeLotsClient(parkingDemoWith(10)),
    createPaymentMethodClient: () => new FakePaymentMethodClient(),
    createVehicleClient: () => new FakeVehicleClient(),
  };
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <PalierApp {...factories} developerEntry={entry} />
    </SafeAreaProvider>,
  );
}

describe('Account developer entry', () => {
  it('opens the developer panel from Compte and returns to the account page', async () => {
    await renderSignedInApp(developerEntry);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Développeur' }));
    expect(screen.getByText('Panneau de test')).toBeOnTheScreen();
    await user.press(screen.getByText('Panneau de test'));

    expect(await screen.findByRole('button', { name: 'Développeur' })).toBeOnTheScreen();
  });

  it('shows no Développeur entry without developer tools', async () => {
    await renderSignedInApp(undefined);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));

    expect(await screen.findByRole('button', { name: 'Mes véhicules' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Développeur' })).not.toBeOnTheScreen();
  });
});
