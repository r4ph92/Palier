import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { commandActions, signalActions } from '../src/dev/panelActions';
import { recordEvents } from '../src/dev/recordEvents';
import { SignalJournal } from '../src/dev/SignalJournal';
import { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import { SimulatedSignalsPanel } from '../src/dev/SimulatedSignalsPanel';
import { PositioningCore } from '../src/positioning/PositioningCore';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const CLOCK = new Date(2026, 10, 4, 18, 2, 5);

async function renderPanel(onBack: () => void = () => undefined) {
  const journal = new SignalJournal(() => CLOCK);
  const simulator = new SimulatedPositioningModule(journal, () => CLOCK.getTime());
  const core = new PositioningCore(simulator);
  core.subscribe(recordEvents(journal));
  const actions = [...signalActions(simulator), ...commandActions(core, () => CLOCK.getTime())];
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <SimulatedSignalsPanel journal={journal} actions={actions} onBack={onBack} />
    </SafeAreaProvider>,
  );
  return userEvent.setup();
}

describe('SimulatedSignalsPanel signals', () => {
  it('logs "Allée détectée : minor 2" with a timestamp after tapping Allée 2', async () => {
    const user = await renderPanel();

    await user.press(screen.getByRole('button', { name: 'Allée 2' }));

    expect(screen.getByText('18 h 02 min 05 s  Allée détectée : minor 2')).toBeOnTheScreen();
  });

  it.each([
    ['Allée 1', 'Allée détectée : minor 1'],
    ['Voie de sortie (minor 0)', 'Allée détectée : minor 0'],
    ['Sortie de la région du parking', 'Sortie de la région du parking'],
    ['Stationné (à pied, confiance élevée)', 'Stationné détecté : confiance élevée'],
    ['Réseau coupé', 'Réseau coupé'],
    ['Réseau rétabli', 'Réseau rétabli'],
  ])('logs the matching event after tapping "%s"', async (button, line) => {
    const user = await renderPanel();

    await user.press(screen.getByRole('button', { name: button }));

    expect(screen.getByText(`18 h 02 min 05 s  ${line}`)).toBeOnTheScreen();
  });

  it('shows the empty log first and goes back on "Retour"', async () => {
    const onBack = jest.fn();
    const user = await renderPanel(onBack);

    expect(screen.getByText("Aucun événement pour l'instant.")).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Retour' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('SimulatedSignalsPanel commands', () => {
  it.each([
    ['startMonitoring major=1', 'startMonitoring uuid=B9407F30 major=1'],
    ['stopMonitoring', 'stopMonitoring'],
    ['keepAlive (+10 min)', 'keepAlive until=18 h 12 min 05 s'],
    ['flushOfflineQueue', 'flushOfflineQueue'],
  ])('logs the command and its arguments after tapping "%s"', async (button, line) => {
    const user = await renderPanel();

    await user.press(screen.getByRole('button', { name: button }));

    expect(screen.getByText(`18 h 02 min 05 s  ${line}`)).toBeOnTheScreen();
  });
});
