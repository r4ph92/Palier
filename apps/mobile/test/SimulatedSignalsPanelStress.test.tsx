import { act, render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import { PositioningCore } from '../src/positioning/PositioningCore';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const START = new Date(2026, 10, 4, 23, 59, 58).getTime();
const LOG_LINE = /^\d{1,2} h \d{2} min \d{2} s\s+/;

function manualClock() {
  let current = START;
  return { now: () => current, advanceOneSecond: () => (current += 1000) };
}

async function renderPanel() {
  const { now, advanceOneSecond } = manualClock();
  const toolkit = createSimulatedToolkit(now);
  const { Panel } = toolkit.bind(new PositioningCore(toolkit.module));
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <Panel onBack={() => undefined} />
    </SafeAreaProvider>,
  );
  return { user: userEvent.setup(), simulator: toolkit.module, advanceOneSecond };
}

function logLines(): string[] {
  return screen
    .queryAllByText(LOG_LINE)
    .map((node) => String(node.props.children));
}

describe('SimulatedSignalsPanel under load', () => {
  it('records every one of 20 rapid presses on the same button', async () => {
    const { user } = await renderPanel();
    const button = screen.getByRole('button', { name: 'Allée 1' });

    for (let press = 0; press < 20; press += 1) {
      await user.press(button);
    }

    expect(logLines().filter((line) => line.endsWith('Allée détectée : minor 1'))).toHaveLength(20);
  });

  it('shows only the newest 100 lines after 105 entries, without duplicate keys', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user, simulator } = await renderPanel();
    const startButton = screen.getByRole('button', { name: 'startMonitoring major=1' });

    await user.press(startButton);
    await act(() => {
      for (let command = 0; command < 104; command += 1) {
        simulator.stopMonitoring();
      }
    });

    expect(logLines()).toHaveLength(100);
    expect(logLines().some((line) => line.includes('startMonitoring'))).toBe(false);
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    consoleError.mockRestore();
  });
});

describe('SimulatedSignalsPanel timestamps', () => {
  it('stamps each line with the moment it was received, newest first, across midnight', async () => {
    const { user, advanceOneSecond } = await renderPanel();

    await user.press(screen.getByRole('button', { name: 'Allée 2' }));
    advanceOneSecond();
    await user.press(screen.getByRole('button', { name: 'Sortie de la région du parking' }));
    advanceOneSecond();
    await user.press(screen.getByRole('button', { name: 'keepAlive (+10 min)' }));

    expect(logLines()).toEqual([
      '0 h 00 min 00 s  keepAlive until=0 h 10 min 00 s',
      '23 h 59 min 59 s  Sortie de la région du parking',
      '23 h 59 min 58 s  Allée détectée : minor 2',
    ]);
  });
});
