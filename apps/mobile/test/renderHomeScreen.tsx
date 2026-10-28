import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { LotsClient } from '../src/api/LotsClient';
import { LotsClientProvider } from '../src/api/LotsClientContext';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { HomeScreen } from '../src/screens/HomeScreen';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

export async function renderHomeScreen(client: LotsClient, language: SupportedLanguage = 'fr') {
  applyLanguage(language);
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <LotsClientProvider client={client}>
        <HomeScreen firstName="Julie" />
      </LotsClientProvider>
    </SafeAreaProvider>,
  );
}
