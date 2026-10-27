import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { fontFamilies } from './tokens';

export const fontAssets = {
  [fontFamilies.text]: Archivo_400Regular,
  [fontFamilies.textSemiBold]: Archivo_600SemiBold,
  [fontFamilies.mono]: IBMPlexMono_500Medium,
  [fontFamilies.monoSemiBold]: IBMPlexMono_600SemiBold,
};
