import { render, screen, userEvent, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { VehiclesScreen } from '../src/screens/VehiclesScreen';
import { abc123, FakeVehicleClient, standardNeeds } from './fakeVehicleClient';

const def456 = { id: 'vehicle-2', plate: 'DEF 456', province: 'QC', isDefault: false, ...standardNeeds };

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

async function renderVehiclesScreen(client: FakeVehicleClient, language: 'fr' | 'en' = 'fr') {
  applyLanguage(language);
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <VehiclesScreen firstName="Julie" client={client} onAddVehicle={jest.fn()} onEditVehicle={jest.fn()} />
    </SafeAreaProvider>,
  );
}

describe('VehiclesScreen', () => {
  it('lists the plate with its province, and marks the first vehicle as the default', async () => {
    await renderVehiclesScreen(new FakeVehicleClient([abc123]));

    expect(await screen.findByText('ABC 123 · QC')).toBeOnTheScreen();
    expect(screen.getByText('Par défaut')).toBeOnTheScreen();
  });

  it('shows the needs declared on a vehicle, and none on a standard one', async () => {
    const eva001 = { ...def456, plate: 'EVA 001', isElectric: true, hasAccessiblePermit: true };
    await renderVehiclesScreen(new FakeVehicleClient([abc123, eva001]));

    expect(await screen.findByText('Véhicule électrique · Vignette pour personnes handicapées')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`vehicle-row-${abc123.id}`)).queryByText(/Véhicule électrique|Gabarit large/)).not.toBeOnTheScreen();
  });

  it('opens the edit page of the vehicle Julie chooses', async () => {
    const onEditVehicle = jest.fn();
    applyLanguage('fr');
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <VehiclesScreen firstName="Julie" client={new FakeVehicleClient([abc123])} onAddVehicle={jest.fn()} onEditVehicle={onEditVehicle} />
      </SafeAreaProvider>,
    );

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Modifier ABC 123' }));

    expect(onEditVehicle).toHaveBeenCalledWith(abc123);
  });

  it('writes the default badge in sentence case, as the story words it', async () => {
    await renderVehiclesScreen(new FakeVehicleClient([abc123]));

    expect(await screen.findByText('Par défaut')).not.toHaveStyle({ textTransform: 'uppercase' });
  });

  it('says no vehicle is registered when Julie has none', async () => {
    await renderVehiclesScreen(new FakeVehicleClient());

    expect(await screen.findByText('Aucun véhicule enregistré.')).toBeOnTheScreen();
  });

  it('offers to try again when Palier cannot be reached, and loads the vehicles on retry', async () => {
    const client = new FakeVehicleClient([abc123]);
    client.isReachable = false;
    await renderVehiclesScreen(client);

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    client.isReachable = true;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('ABC 123 · QC')).toBeOnTheScreen();
  });

  describe('with two vehicles', () => {
    it('moves the default badge to the vehicle Julie chooses', async () => {
      await renderVehiclesScreen(new FakeVehicleClient([abc123, def456]));
      const row = await screen.findByTestId('vehicle-row-vehicle-2');

      await userEvent.setup().press(within(row).getByRole('button', { name: 'Utiliser par défaut' }));

      expect(within(screen.getByTestId('vehicle-row-vehicle-2')).getByText('Par défaut')).toBeOnTheScreen();
      expect(within(screen.getByTestId('vehicle-row-vehicle-1')).getByRole('button', { name: 'Utiliser par défaut' })).toBeOnTheScreen();
    });

    it('removes a vehicle that is not the default from the list', async () => {
      await renderVehiclesScreen(new FakeVehicleClient([abc123, def456]));
      const row = await screen.findByTestId('vehicle-row-vehicle-2');

      await userEvent.setup().press(within(row).getByRole('button', { name: 'Supprimer' }));

      expect(screen.queryByText('DEF 456 · QC')).not.toBeOnTheScreen();
      expect(screen.getByText('ABC 123 · QC')).toBeOnTheScreen();
    });

    it('says a vehicle cannot be removed when it is the only one, and keeps it', async () => {
      await renderVehiclesScreen(new FakeVehicleClient([abc123]));
      const row = await screen.findByTestId('vehicle-row-vehicle-1');

      await userEvent.setup().press(within(row).getByRole('button', { name: 'Supprimer' }));

      expect(await screen.findByText('Gardez au moins un véhicule')).toBeOnTheScreen();
      expect(screen.getByText('ABC 123 · QC')).toBeOnTheScreen();
    });

    it('says the change could not be saved when Palier cannot be reached, and keeps the list', async () => {
      const client = new FakeVehicleClient([abc123, def456]);
      await renderVehiclesScreen(client);
      const row = await screen.findByTestId('vehicle-row-vehicle-2');
      client.isReachable = false;

      await userEvent.setup().press(within(row).getByRole('button', { name: 'Utiliser par défaut' }));

      expect(await screen.findByText('Mise à jour impossible. Vérifiez votre connexion, puis réessayez.')).toBeOnTheScreen();
      expect(screen.getByText('DEF 456 · QC')).toBeOnTheScreen();
    });
  });

  describe('in English', () => {
    it('reads Default and Use as default', async () => {
      await renderVehiclesScreen(new FakeVehicleClient([abc123, def456]), 'en');

      expect(await screen.findByText('Default')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Use as default' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Edit ABC 123' })).toBeOnTheScreen();
    });
  });
});
