import { useFonts } from 'expo-font';
import { fontAssets } from './fonts';

// A font that fails to load must not leave a blank screen: the app opens in the system font instead.
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  return loaded || error !== null;
}
