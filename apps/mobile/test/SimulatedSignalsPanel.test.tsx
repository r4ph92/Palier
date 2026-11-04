import { AccessibilityInfo } from 'react-native';
import { render, screen, userEvent, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import { PositioningCore } from '../src/positioning/PositioningCore';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const CLOCK = new Date(2026, 10, 4, 18, 2, 5);

async function renderPanel(onBack: () => void = () => undefined) {
  const toolkit = createSimulatedToolkit(() => CLOCK.getTime());
  const { Panel } = toolkit.bind(new PositioningCore(toolkit.module));
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <Panel onBack={onBack} />
    </SafeAreaProvider>,
  );
  return userEvent.setup();
}

describe('SimulatedSignalsPanel signals', () => {
  it('logs "Allée détectée : minor 2" with a timestamp after tapping Allée 2', async () => {
    const user = await renderPanel();

    await user.press(screen.getByRole('button', { name: 'Allée 2' }));

    expect(within(screen.getByTestId('Journal')).getByText('18 h 02 min 05 s  Allée détectée : minor 2')).toBeOnTheScreen();
  });

  it('shows only the newest entry under the header, in a two-line slot', async () => {
    const user = await renderPanel();

    await user.press(screen.getByRole('button', { name: 'Allée 1' }));
    await user.press(screen.getByRole('button', { name: 'Allée 2' }));

    const slot = within(screen.getByTestId('NewestEntry'));
    expect(slot.getByText('18 h 02 min 05 s  Allée détectée : minor 2')).toHaveProp('numberOfLines', 2);
    expect(slot.queryByText(/minor 1/)).not.toBeOnTheScreen();
  });

  it('places the Journal after the Commandes group', async () => {
    await renderPanel();

    const headers = screen.getAllByRole('header').map((node) => String(node.props.children));
    expect(headers.slice(-3)).toEqual(['Signaux', 'Commandes', 'Journal']);
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

    expect(within(screen.getByTestId('Journal')).getByText(`18 h 02 min 05 s  ${line}`)).toBeOnTheScreen();
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

    expect(within(screen.getByTestId('Journal')).getByText(`18 h 02 min 05 s  ${line}`)).toBeOnTheScreen();
  });

  it('also logs the empty queue flush the flushOfflineQueue row ends with', async () => {
    const user = await renderPanel();

    await user.press(screen.getByRole('button', { name: 'flushOfflineQueue' }));

    expect(within(screen.getByTestId('Journal')).getByText('18 h 02 min 05 s  File vidée : 0 élément(s)')).toBeOnTheScreen();
  });
});

describe('SimulatedSignalsPanel accessibility', () => {
  let announce: jest.SpyInstance;

  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    announce.mockClear();
  });

  afterEach(() => announce.mockRestore());

  it('announces the newest entry every time, even when the text repeats', async () => {
    const user = await renderPanel();

    await user.press(screen.getByRole('button', { name: 'Allée 2' }));
    await user.press(screen.getByRole('button', { name: 'Allée 2' }));

    expect(announce.mock.calls).toEqual([['Allée détectée : minor 2'], ['Allée détectée : minor 2']]);
  });

  it('announces nothing when the panel opens', async () => {
    await renderPanel();

    expect(announce).not.toHaveBeenCalled();
  });

  it('marks the Journal, Signaux and Commandes labels as headers', async () => {
    await renderPanel();

    for (const name of ['Journal', 'Signaux', 'Commandes']) {
      expect(screen.getByRole('header', { name })).toBeOnTheScreen();
    }
  });
});
