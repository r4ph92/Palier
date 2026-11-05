import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { LotsClient } from '../src/api/LotsClient';
import type { SpotHoldClient } from '../src/api/SpotHoldClient';
import type { DeviceLocationClient } from '../src/deviceLocation/DeviceLocationClient';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { HomeScreen } from '../src/screens/HomeScreen';
import { useSpotHold } from '../src/spotHolds/useSpotHold';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeSpotHoldClient } from './fakeSpotHoldClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

export interface HomeScreenClients {
  readonly lotsClient: LotsClient;
  readonly locationClient: DeviceLocationClient;
  readonly spotHoldClient: SpotHoldClient;
}

// The hook lives above the tabs in the app; here it sits right above the screen.
export function HomeScreenWithSpotHold({ lotsClient, locationClient, spotHoldClient }: HomeScreenClients) {
  const spotHold = useSpotHold(spotHoldClient);
  return <HomeScreen firstName="Julie" lotsClient={lotsClient} locationClient={locationClient} spotHold={spotHold} />;
}

export async function renderHomeScreen(
  client: LotsClient,
  language: SupportedLanguage = 'fr',
  locationClient: DeviceLocationClient = new FakeDeviceLocationClient(),
) {
  return renderHomeScreenWith({ lotsClient: client, locationClient, spotHoldClient: new FakeSpotHoldClient() }, language);
}

export async function renderHomeScreenWith(clients: HomeScreenClients, language: SupportedLanguage = 'fr') {
  applyLanguage(language);
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <HomeScreenWithSpotHold {...clients} />
    </SafeAreaProvider>,
  );
}
