import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { VehiclesScreen } from '../src/screens/VehiclesScreen';
import { abc123, FakeVehicleClient } from './fakeVehicleClient';

const mockWindow = { width: 402, height: 874, scale: 3, fontScale: 1 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

describe.each([1, 1.35, 2.3, 3.1])('VehiclesScreen at text scale %d', (fontScale) => {
  beforeEach(() => {
    mockWindow.fontScale = fontScale;
    applyLanguage('fr');
  });

  it('keeps the plate and the default badge on screen, stacked only at large text sizes', async () => {
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <VehiclesScreen firstName="Julie" client={new FakeVehicleClient([abc123])} onAddVehicle={jest.fn()} />
      </SafeAreaProvider>,
    );

    expect(await screen.findByText('ABC 123 · QC')).toBeOnTheScreen();
    expect(screen.getByText('Par défaut')).toBeOnTheScreen();
    expect(screen.getByTestId(`vehicle-row-${abc123.id}`)).toHaveStyle({ flexDirection: fontScale >= 1.35 ? 'column' : 'row' });
  });
});
