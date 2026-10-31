import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HttpAuthClient } from './api/HttpAuthClient';
import { HttpLotsClient } from './api/HttpLotsClient';
import { HttpPaymentMethodClient } from './api/HttpPaymentMethodClient';
import type { LotsClient } from './api/LotsClient';
import type { PaymentMethodClient } from './api/PaymentMethodClient';
import { secureTokenStore } from './auth/TokenStore';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { applyLanguage, deviceLanguage } from './i18n/i18n';
import { PalierApp } from './PalierApp';
import { fontAssets } from './theme/fonts';

const LOCAL_API_URL = 'http://localhost:3000';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? LOCAL_API_URL;
const authClient = new HttpAuthClient({ baseUrl: apiUrl });
// Set only in local and test builds; a production build leaves it out and shows no test sign-in.
const testSignInEnabled = process.env.EXPO_PUBLIC_TEST_SIGN_IN === 'true';
// A test-mode publishable key (pk_test_…) from the environment; never a live key.
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
applyLanguage(deviceLanguage());

function createLotsClient(token: string, onUnauthorized: () => void): LotsClient {
  return new HttpLotsClient({ baseUrl: apiUrl, token, onUnauthorized });
}

function createPaymentMethodClient(token: string, onUnauthorized: () => void): PaymentMethodClient {
  return new HttpPaymentMethodClient({ baseUrl: apiUrl, token, onUnauthorized });
}

const palierApp = (
  <StripeProvider publishableKey={stripePublishableKey}>
    <PalierApp
      authClient={authClient}
      tokenStore={secureTokenStore}
      testSignInEnabled={testSignInEnabled}
      createLotsClient={createLotsClient}
      createPaymentMethodClient={createPaymentMethodClient}
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
