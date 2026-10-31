import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { VehiclesScreen } from '../src/screens/VehiclesScreen';
import { abc123, FakeVehicleClient } from './fakeVehicleClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

async function renderVehiclesScreen(client: FakeVehicleClient) {
  applyLanguage('fr');
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <VehiclesScreen firstName="Julie" client={client} onAddVehicle={jest.fn()} />
    </SafeAreaProvider>,
  );
}

describe('VehiclesScreen', () => {
  it('lists the plate with its province, and marks the first vehicle as the default', async () => {
    await renderVehiclesScreen(new FakeVehicleClient([abc123]));

    expect(await screen.findByText('ABC 123 · QC')).toBeOnTheScreen();
    expect(screen.getByText('Par défaut')).toBeOnTheScreen();
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
});
