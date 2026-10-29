import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { abc123, FakeVehicleClient } from './fakeVehicleClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;

async function renderSignedInJulie(vehicleClient: FakeVehicleClient) {
  applyLanguage('fr');
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <PalierApp
        authClient={authClient}
        tokenStore={new MemoryTokenStore(JULIE_TOKEN)}
        testSignInEnabled={false}
        createLotsClient={() => new FakeLotsClient(parkingDemoWith(10))}
        createVehicleClient={() => vehicleClient}
      />
    </SafeAreaProvider>,
  );
}

describe('the vehicles page of the account tab', () => {
  it('opens from Compte and goes back to Compte when another tab is chosen', async () => {
    await renderSignedInJulie(new FakeVehicleClient([abc123]));
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('button', { name: 'Mes véhicules' }));

    expect(await screen.findByText('ABC 123 · QC')).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    await user.press(screen.getByRole('tab', { name: 'Compte' }));

    expect(screen.queryByText('ABC 123 · QC')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes véhicules' })).toBeOnTheScreen();
  });
});
