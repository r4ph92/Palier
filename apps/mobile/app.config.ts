import type { ExpoConfig } from 'expo/config';

const LOCATION_REASON_FR = 'Palier lit votre position sur l’appareil pour trier les stationnements par distance. Elle n’est jamais envoyée.';
const LOCATION_REASON_EN = 'Palier reads your position on the device to sort parking lots by distance. It is never sent.';

const config: ExpoConfig = {
  name: 'Palier',
  slug: 'palier',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['ios'],
  ios: {
    bundleIdentifier: 'ca.palier.app',
    supportsTablet: false,
  },
  locales: {
    fr: { NSLocationWhenInUseUsageDescription: LOCATION_REASON_FR },
    en: { NSLocationWhenInUseUsageDescription: LOCATION_REASON_EN },
  },
  plugins: [
    'expo-status-bar',
    'expo-localization',
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_REASON_FR,
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
  ],
};

export default config;
