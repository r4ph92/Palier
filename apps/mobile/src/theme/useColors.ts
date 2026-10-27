import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ColorTokens } from './tokens';

export function useColors(): ColorTokens {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}
