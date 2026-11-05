import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HttpAuthClient } from './api/HttpAuthClient';
import { HttpEntryClient } from './api/HttpEntryClient';
import { HttpLotsClient } from './api/HttpLotsClient';
import { HttpParkingSessionClient } from './api/HttpParkingSessionClient';
import { HttpPaymentMethodClient } from './api/HttpPaymentMethodClient';
import { HttpSpotHoldClient } from './api/HttpSpotHoldClient';
import { HttpVehicleClient } from './api/HttpVehicleClient';
import type { SignedInClients, SignedInSession } from './api/SignedInClients';
import { secureTokenStore } from './auth/TokenStore';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ExpoDeviceLocationClient } from './deviceLocation/ExpoDeviceLocationClient';
import { applyLanguage, deviceLanguage } from './i18n/i18n';
import { developerTools } from './dev/loadDeveloperTools';
import { PalierApp } from './PalierApp';
import { NullPositioningModule } from './positioning/NullPositioningModule';
import { PositioningCore } from './positioning/PositioningCore';
import { fontAssets } from './theme/fonts';

const LOCAL_API_URL = 'http://localhost:3000';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? LOCAL_API_URL;
const authClient = new HttpAuthClient({ baseUrl: apiUrl });
// Set only in local and test builds; a production build leaves it out and shows no test sign-in.
const testSignInEnabled = process.env.EXPO_PUBLIC_TEST_SIGN_IN === 'true';
// The publishable key comes from the environment; use a test key (pk_test_…) in local and test builds.
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
applyLanguage(deviceLanguage());
const deviceLocationClient = new ExpoDeviceLocationClient();

function createSignedInClients({ token, onUnauthorized, onConsentRequired }: SignedInSession): SignedInClients {
  return {
    lots: new HttpLotsClient({ baseUrl: apiUrl, token, onUnauthorized }),
    payment: new HttpPaymentMethodClient({ baseUrl: apiUrl, token, onUnauthorized }),
    vehicles: new HttpVehicleClient({ baseUrl: apiUrl, token, onUnauthorized, onConsentRequired }),
    entry: new HttpEntryClient({ baseUrl: apiUrl, token, onUnauthorized, onConsentRequired }),
    parkingSession: new HttpParkingSessionClient({ baseUrl: apiUrl, token, onUnauthorized, onConsentRequired }),
    spotHold: new HttpSpotHoldClient({ baseUrl: apiUrl, token, onUnauthorized, onConsentRequired }),
    location: deviceLocationClient,
  };
}

const positioningCore = new PositioningCore(developerTools?.module ?? new NullPositioningModule());
const developerEntry = developerTools?.bind(positioningCore);

const palierApp = (
  <StripeProvider publishableKey={stripePublishableKey}>
    <PalierApp
      authClient={authClient}
      tokenStore={secureTokenStore}
      testSignInEnabled={testSignInEnabled}
      createSignedInClients={createSignedInClients}
      developerEntry={developerEntry}
    />
  </StripeProvider>
);

export function App() {
  const [fontsLoaded] = useFonts(fontAssets);
  if (!fontsLoaded) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppErrorBoundary>{palierApp}</AppErrorBoundary>
    </SafeAreaProvider>
  );
}
