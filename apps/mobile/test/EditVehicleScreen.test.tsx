import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { EditVehicleScreen } from '../src/screens/EditVehicleScreen';
import { abc123, FakeVehicleClient } from './fakeVehicleClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const eva001 = { ...abc123, plate: 'EVA 001', isElectric: true };

async function renderEditVehicleScreen(client: FakeVehicleClient, language: 'fr' | 'en' = 'fr') {
  applyLanguage(language);
  const onSaved = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <EditVehicleScreen client={client} vehicle={eva001} onCancel={jest.fn()} onSaved={onSaved} />
    </SafeAreaProvider>,
  );
  return onSaved;
}

describe('EditVehicleScreen', () => {
  it('shows the plate and the needs already saved on the vehicle', async () => {
    await renderEditVehicleScreen(new FakeVehicleClient([eva001]));

    expect(screen.getByText('EVA 001 · QC')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Véhicule électrique' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Vignette pour personnes handicapées' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Gabarit large' })).not.toBeChecked();
  });

  it('saves the needs Nadia ticks and goes back', async () => {
    const client = new FakeVehicleClient([eva001]);
    const onSaved = await renderEditVehicleScreen(client);
    const user = userEvent.setup();

    await user.press(screen.getByRole('checkbox', { name: 'Vignette pour personnes handicapées' }));
    await user.press(screen.getByRole('checkbox', { name: 'Gabarit large' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(client.savedVehicles).toEqual([{ ...eva001, hasAccessiblePermit: true, isOversize: true }]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('says the needs could not be saved when Palier cannot be reached, and stays on the page', async () => {
    const client = new FakeVehicleClient([eva001]);
    client.isReachable = false;
    const onSaved = await renderEditVehicleScreen(client);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Enregistrement impossible. Vérifiez votre connexion, puis réessayez.')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('reads in English when the device is English', async () => {
    await renderEditVehicleScreen(new FakeVehicleClient([eva001]), 'en');

    expect(screen.getByText('Edit vehicle')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Electric vehicle' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Accessible parking permit' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Oversize' })).toBeOnTheScreen();
  });
});
