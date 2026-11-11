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

async function renderEditVehicleScreen(client: FakeVehicleClient, language: 'fr' | 'en' = 'fr', vehicle = eva001) {
  applyLanguage(language);
  const onSaved = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <EditVehicleScreen client={client} vehicle={vehicle} onCancel={jest.fn()} onSaved={onSaved} />
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
    expect(screen.getByRole('checkbox', { name: 'Grand gabarit' })).not.toBeChecked();
  });

  it('saves the needs Nadia ticks and goes back', async () => {
    const client = new FakeVehicleClient([eva001]);
    const onSaved = await renderEditVehicleScreen(client);
    const user = userEvent.setup();

    await user.press(screen.getByRole('checkbox', { name: 'Vignette pour personnes handicapées' }));
    await user.press(screen.getByRole('checkbox', { name: 'Grand gabarit' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(client.savedVehicles).toEqual([{ ...eva001, hasAccessiblePermit: true, isOversize: true }]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('labels the transponder field in English and in French', async () => {
    await renderEditVehicleScreen(new FakeVehicleClient([eva001]), 'en');

    expect(screen.getByLabelText('Transponder (optional)')).toBeOnTheScreen();
  });

  it('saves the transponder Julie types, upper-case', async () => {
    const client = new FakeVehicleClient([eva001]);
    const onSaved = await renderEditVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Transpondeur (facultatif)'), 't-0042');
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(client.savedVehicles).toEqual([{ ...eva001, transponder: 'T-0042' }]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('shows the transponder already saved and clears it when emptied', async () => {
    const withTransponder = { ...eva001, transponder: 'T-0042' };
    const client = new FakeVehicleClient([withTransponder]);
    await renderEditVehicleScreen(client, 'fr', withTransponder);
    const user = userEvent.setup();

    expect(screen.getByLabelText('Transpondeur (facultatif)')).toHaveDisplayValue('T-0042');
    await user.clear(screen.getByLabelText('Transpondeur (facultatif)'));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(client.savedVehicles).toEqual([{ ...eva001, transponder: null }]);
  });

  it('says the transponder is invalid when Palier refuses it, and stays on the page', async () => {
    const client = new FakeVehicleClient([eva001]);
    const onSaved = await renderEditVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Transpondeur (facultatif)'), 'T_1');
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Transpondeur invalide')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says the transponder is already registered when another vehicle has it, and stays on the page', async () => {
    const client = new FakeVehicleClient([eva001]);
    const onSaved = await renderEditVehicleScreen(client);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Transpondeur (facultatif)'), 't-taken');
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Ce transpondeur est déjà enregistré.')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says the needs could not be saved when Palier cannot be reached, and stays on the page', async () => {
    const client = new FakeVehicleClient([eva001]);
    client.isReachable = false;
    const onSaved = await renderEditVehicleScreen(client);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Enregistrement impossible. Vérifiez votre connexion, puis réessayez.')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says the needs could not be saved when the vehicle was removed meanwhile, and stays on the page', async () => {
    const onSaved = await renderEditVehicleScreen(new FakeVehicleClient());

    await userEvent.setup().press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Enregistrement impossible. Vérifiez votre connexion, puis réessayez.')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('marks the save button busy while the needs are saved, so a second tap sends nothing', async () => {
    const client = new FakeVehicleClient([eva001]);
    const update = jest.spyOn(client, 'updateVehicleNeeds').mockReturnValue(new Promise(() => {}));
    await renderEditVehicleScreen(client);
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await user.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(update).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeBusy();
  });

  it('names the need list as a heading', async () => {
    await renderEditVehicleScreen(new FakeVehicleClient([eva001]));

    expect(screen.getByRole('header', { name: 'Besoins du véhicule' })).toBeOnTheScreen();
  });

  it('reads in English when the device is English', async () => {
    await renderEditVehicleScreen(new FakeVehicleClient([eva001]), 'en');

    expect(screen.getByText('Edit vehicle')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Electric vehicle' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Accessible parking permit' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Oversize' })).toBeOnTheScreen();
  });
});
