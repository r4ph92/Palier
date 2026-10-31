import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PalierConsentRequiredError } from '../src/api/VehicleClient';
import { applyLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;

describe('a vehicle request refused for a missing privacy notice', () => {
  it('re-reads the driver and shows the notice again', async () => {
    applyLanguage('fr');
    const authClient = new FakeAuthClient();
    authClient.validTokens.add(JULIE_TOKEN);
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <PalierApp
          authClient={authClient}
          tokenStore={new MemoryTokenStore(JULIE_TOKEN)}
          testSignInEnabled={false}
          createLotsClient={() => new FakeLotsClient(parkingDemoWith(10))}
          createVehicleClient={(_token, _onUnauthorized, onConsentRequired) => ({
            listVehicles() {
              // A newer notice is now in force: Julie's record no longer carries an accepted version.
              authClient.acceptedNoticeVersion = null;
              onConsentRequired();
              return Promise.reject(new PalierConsentRequiredError());
            },
            addVehicle: () => Promise.reject(new Error('not used in this test')),
          })}
        />
      </SafeAreaProvider>,
    );
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('button', { name: 'Mes véhicules' }));

    expect(await screen.findByText('Vos renseignements')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Compte' })).not.toBeOnTheScreen();
  });
});
