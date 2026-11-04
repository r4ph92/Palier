import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { AddVehicleScreen } from '../src/screens/AddVehicleScreen';
import { FakeVehicleClient } from './fakeVehicleClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

async function renderAddVehicleScreen(client: FakeVehicleClient, onSaved = jest.fn(), language: 'fr' | 'en' = 'fr') {
  applyLanguage(language);
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AddVehicleScreen client={client} onCancel={jest.fn()} onSaved={onSaved} />
    </SafeAreaProvider>,
  );
  return onSaved;
}

describe('AddVehicleScreen', () => {
  it('saves the plate in upper case with the province Julie chose', async () => {
    const client = new FakeVehicleClient();
    const onSaved = await renderAddVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Plaque'), 'abc 123');
    await user.press(screen.getByRole('radio', { name: 'Québec' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(client.savedVehicles).toEqual([expect.objectContaining({ plate: 'ABC 123', province: 'QC' })]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('asks for a province and saves nothing when none is chosen', async () => {
    const client = new FakeVehicleClient();
    const onSaved = await renderAddVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Plaque'), 'ABC 123');
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Choisissez une province')).toBeOnTheScreen();
    expect(client.savedVehicles).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('caps the text size of the plate field so the plate stays visible', async () => {
    await renderAddVehicleScreen(new FakeVehicleClient());

    expect(screen.getByLabelText('Plaque')).toHaveProp('maxFontSizeMultiplier', 2);
  });

  it('shows the plate in upper case as Julie types it', async () => {
    await renderAddVehicleScreen(new FakeVehicleClient());

    await userEvent.setup().type(screen.getByLabelText('Plaque'), 'abc 1');

    expect(screen.getByLabelText('Plaque')).toHaveDisplayValue('ABC 1');
  });

  it('clears the province message once Julie chooses a province', async () => {
    await renderAddVehicleScreen(new FakeVehicleClient());
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Choisissez une province')).toBeOnTheScreen();

    await user.press(screen.getByRole('radio', { name: 'Québec' }));

    expect(screen.queryByText('Choisissez une province')).not.toBeOnTheScreen();
  });

  it('shows "Plaque invalide" on the plate field when Palier refuses the plate', async () => {
    const client = new FakeVehicleClient();
    client.nextRejection = 'INVALID_PLATE';
    const onSaved = await renderAddVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Plaque'), 'ABCD12345');
    await user.press(screen.getByRole('radio', { name: 'Québec' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Plaque invalide')).toBeOnTheScreen();
    expect(client.savedVehicles).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says the vehicle is already registered when Palier refuses a duplicate', async () => {
    const client = new FakeVehicleClient();
    client.nextRejection = 'VEHICLE_ALREADY_REGISTERED';
    await renderAddVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Plaque'), 'ABC123');
    await user.press(screen.getByRole('radio', { name: 'Québec' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Ce véhicule est déjà enregistré.')).toBeOnTheScreen();
  });

  it('says the vehicle could not be saved when Palier cannot be reached', async () => {
    const client = new FakeVehicleClient();
    client.isReachable = false;
    await renderAddVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Plaque'), 'ABC 123');
    await user.press(screen.getByRole('radio', { name: 'Québec' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Enregistrement impossible. Vérifiez votre connexion, puis réessayez.')).toBeOnTheScreen();
  });

  it('shows the form in English when the device is English', async () => {
    await renderAddVehicleScreen(new FakeVehicleClient(), jest.fn(), 'en');

    expect(screen.getByText('Add a vehicle')).toBeOnTheScreen();
    expect(screen.getByLabelText('Plate')).toBeOnTheScreen();
    expect(screen.getByText('Province or state')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Quebec' })).toBeOnTheScreen();
  });
});
