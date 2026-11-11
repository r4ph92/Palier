import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ConnectivitySource } from '../src/api/ConnectivitySource';
import type { SignedInClients, SignedInSession } from '../src/api/SignedInClients';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import type { PositioningCore } from '../src/positioning/PositioningCore';
import type { DeveloperEntry } from '../src/screens/DeveloperEntry';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeEntryClient } from './fakeEntryClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeParkingSessionClient } from './fakeParkingSessionClient';
import { FakePaymentMethodClient } from './fakePaymentMethodClient';
import { FakeSpotHoldClient } from './fakeSpotHoldClient';
import { FakeVehicleClient } from './fakeVehicleClient';

export const JULIE_TOKEN = `${julie.id}-token`;
export const IPHONE_15_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
export const IPHONE_MINI_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export interface PalierAppOptions {
  readonly authClient?: FakeAuthClient;
  readonly tokenStore?: MemoryTokenStore;
  readonly testSignInEnabled?: boolean;
  readonly language?: SupportedLanguage;
  readonly metrics?: typeof IPHONE_15_METRICS;
  readonly developerEntry?: DeveloperEntry | undefined;
  readonly positioning?: PositioningCore | undefined;
  readonly connectivity?: ConnectivitySource | undefined;
  // Only the clients a test cares about; the others are working fakes.
  readonly clients?: (session: SignedInSession) => Partial<SignedInClients>;
}

export function fakeSignedInClients(): SignedInClients {
  return {
    lots: new FakeLotsClient(parkingDemoWith(10)),
    payment: new FakePaymentMethodClient(),
    vehicles: new FakeVehicleClient(),
    entry: new FakeEntryClient(),
    parkingSession: new FakeParkingSessionClient(),
    spotHold: new FakeSpotHoldClient(),
    location: new FakeDeviceLocationClient(),
    backgroundLocation: new FakeBackgroundLocationClient(),
    locationExplanation: new MemoryLocationExplanationStore(),
  };
}

export function signedInJulie() {
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  return { authClient, tokenStore: new MemoryTokenStore(JULIE_TOKEN) };
}

export async function renderPalierApp(options: PalierAppOptions = {}) {
  applyLanguage(options.language ?? 'fr');
  const createSignedInClients = (session: SignedInSession): SignedInClients => ({ ...fakeSignedInClients(), ...options.clients?.(session) });
  return render(
    <SafeAreaProvider initialMetrics={options.metrics ?? IPHONE_15_METRICS}>
      <PalierApp
        authClient={options.authClient ?? new FakeAuthClient()}
        tokenStore={options.tokenStore ?? new MemoryTokenStore()}
        testSignInEnabled={options.testSignInEnabled ?? true}
        createSignedInClients={createSignedInClients}
        developerEntry={options.developerEntry}
        positioning={options.positioning}
        connectivity={options.connectivity}
      />
    </SafeAreaProvider>,
  );
}
