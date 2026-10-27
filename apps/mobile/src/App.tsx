import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HttpLotsClient } from './api/HttpLotsClient';
import { LotsClientProvider } from './api/LotsClientContext';
import { applyLanguage, deviceLanguage } from './i18n/i18n';
import { HomeScreen } from './screens/HomeScreen';
import { fontAssets } from './theme/fonts';

const LOCAL_API_URL = 'http://localhost:3000';

const lotsClient = new HttpLotsClient({ baseUrl: process.env.EXPO_PUBLIC_API_URL ?? LOCAL_API_URL });
applyLanguage(deviceLanguage());

export function App() {
  const [fontsLoaded] = useFonts(fontAssets);
  if (!fontsLoaded) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <LotsClientProvider client={lotsClient}>
        <StatusBar style="auto" />
        <HomeScreen />
      </LotsClientProvider>
    </SafeAreaProvider>
  );
}
