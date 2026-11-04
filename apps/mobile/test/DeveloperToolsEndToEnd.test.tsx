import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import { applyLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakePaymentMethodClient } from './fakePaymentMethodClient';
import { FakeVehicleClient } from './fakeVehicleClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;
const AISLE_TWO_LINE = /^\d{1,2} h \d{2} min \d{2} s\s+Allée détectée : minor 2$/;
const START_MONITORING_LINE = /^\d{1,2} h \d{2} min \d{2} s\s+startMonitoring uuid=B9407F30 major=1$/;

// Same wiring as App.tsx: the core owns the simulated module, the panel reads what reached the core.
function wireDeveloperTools() {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioningCore = new PositioningCore(toolkit.module);
  return { positioningCore, developerEntry: toolkit.bind(positioningCore) };
}

async function renderSignedInApp(language: 'fr' | 'en') {
  const { positioningCore, developerEntry } = wireDeveloperTools();
  applyLanguage(language);
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <PalierApp
        authClient={authClient}
        tokenStore={new MemoryTokenStore(JULIE_TOKEN)}
        testSignInEnabled={false}
        createLotsClient={() => new FakeLotsClient(parkingDemoWith(10))}
        createPaymentMethodClient={() => new FakePaymentMethodClient()}
        createVehicleClient={() => new FakeVehicleClient()}
        developerEntry={developerEntry}
      />
    </SafeAreaProvider>,
  );
  return { user: userEvent.setup(), positioningCore };
}

async function openPanel(user: ReturnType<typeof userEvent.setup>, accountTab: string) {
  await user.press(await screen.findByRole('tab', { name: accountTab }));
  await user.press(await screen.findByRole('button', { name: 'Développeur' }));
  return screen.findByTestId('SimulatedSignalsPanel');
}

function journal() {
  return within(screen.getByTestId('Journal'));
}

describe('Simulated signals through the real developer tools', () => {
  afterEach(() => applyLanguage('fr'));

  it('logs "Allée détectée : minor 2" after Compte > Développeur > Allée 2', async () => {
    const { user } = await renderSignedInApp('fr');
    await openPanel(user, 'Compte');

    await user.press(screen.getByRole('button', { name: 'Allée 2' }));

    expect(journal().getByText(AISLE_TWO_LINE)).toBeOnTheScreen();
  });

  it('logs a command the app core sends while the panel is open', async () => {
    const { user, positioningCore } = await renderSignedInApp('fr');
    await openPanel(user, 'Compte');

    await act(() => positioningCore.startMonitoring('B9407F30-F5F8-466E-AFF9-25556B57FE6D', 1));

    expect(await within(await screen.findByTestId('Journal')).findByText(START_MONITORING_LINE)).toBeOnTheScreen();
  });

  it('keeps the log after leaving for Stationnements and reopening the panel', async () => {
    const { user } = await renderSignedInApp('fr');
    await openPanel(user, 'Compte');
    await user.press(screen.getByRole('button', { name: 'Allée 2' }));

    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    await openPanel(user, 'Compte');

    expect(journal().getAllByText(AISLE_TWO_LINE)).toHaveLength(1);
  });

  it('opens the panel from the English Account tab too', async () => {
    const { user } = await renderSignedInApp('en');

    expect(await openPanel(user, 'Account')).toBeOnTheScreen();
  });
});
