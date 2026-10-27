import { useWindowDimensions } from 'react-native';

const LARGE_TEXT_FONT_SCALE = 1.35;

export function useIsLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_FONT_SCALE;
}
