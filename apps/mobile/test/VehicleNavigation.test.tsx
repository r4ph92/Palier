import { screen, userEvent } from '@testing-library/react-native';
import { abc123, FakeVehicleClient } from './fakeVehicleClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

async function renderSignedInJulie(vehicleClient: FakeVehicleClient) {
  return renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ vehicles: vehicleClient }) });
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

  it('adds a vehicle from the list and comes back to it with the new plate', async () => {
    await renderSignedInJulie(new FakeVehicleClient());
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('button', { name: 'Mes véhicules' }));
    await user.press(await screen.findByRole('button', { name: 'Ajouter' }));
    await user.type(screen.getByLabelText('Plaque'), 'abc 123');
    await user.press(screen.getByRole('radio', { name: 'Québec' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('ABC 123 · QC')).toBeOnTheScreen();
    expect(screen.getByText('Par défaut')).toBeOnTheScreen();
  });

  it('edits the needs of a vehicle and comes back to the list showing them', async () => {
    await renderSignedInJulie(new FakeVehicleClient([abc123]));
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('button', { name: 'Mes véhicules' }));
    await user.press(await screen.findByRole('button', { name: 'Modifier' }));
    await user.press(screen.getByRole('checkbox', { name: 'Gabarit large' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Gabarit large')).toBeOnTheScreen();
    expect(screen.getByText('ABC 123 · QC')).toBeOnTheScreen();
  });
});
