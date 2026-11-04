import { screen, userEvent } from '@testing-library/react-native';
import type { SignedInSession } from '../src/api/SignedInClients';
import { PalierConsentRequiredError, type VehicleClient } from '../src/api/VehicleClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

describe('a vehicle request refused for a missing privacy notice', () => {
  it('re-reads the driver and shows the notice again', async () => {
    const { authClient, tokenStore } = signedInJulie();
    const vehicles = ({ onConsentRequired }: SignedInSession): VehicleClient => ({
      listVehicles() {
        // A newer notice is now in force: Julie's record no longer carries an accepted version.
        authClient.acceptedNoticeVersion = null;
        onConsentRequired();
        return Promise.reject(new PalierConsentRequiredError());
      },
      addVehicle: () => Promise.reject(new Error('not used in this test')),
      updateVehicleNeeds: () => Promise.reject(new Error('not used in this test')),
      setDefaultVehicle: () => Promise.reject(new Error('not used in this test')),
      deleteVehicle: () => Promise.reject(new Error('not used in this test')),
    });
    await renderPalierApp({ authClient, tokenStore, testSignInEnabled: false, clients: (session) => ({ vehicles: vehicles(session) }) });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('button', { name: 'Mes véhicules' }));

    expect(await screen.findByText('Vos renseignements')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Compte' })).not.toBeOnTheScreen();
  });
});
