import type { ExpoConfig } from 'expo/config';

const LOCATION_REASON_FR = 'Palier lit votre position sur l’appareil pour trier les stationnements par distance. Elle n’est jamais envoyée.';
const LOCATION_REASON_EN = 'Palier reads your position on the device to sort parking lots by distance. It is never sent.';

const LOCATION_ALWAYS_REASON_FR =
  'Palier reste actif 2 à 3 minutes après votre scan pour détecter la place où vous vous garez. Votre position n’est jamais envoyée.';
const LOCATION_ALWAYS_REASON_EN =
  'Palier stays active for 2 to 3 minutes after your scan to detect the spot where you park. Your position is never sent.';

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
    fr: { NSLocationWhenInUseUsageDescription: LOCATION_REASON_FR, NSLocationAlwaysAndWhenInUseUsageDescription: LOCATION_ALWAYS_REASON_FR },
    en: { NSLocationWhenInUseUsageDescription: LOCATION_REASON_EN, NSLocationAlwaysAndWhenInUseUsageDescription: LOCATION_ALWAYS_REASON_EN },
  },
  plugins: [
    'expo-status-bar',
    'expo-localization',
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_REASON_FR,
        locationAlwaysAndWhenInUsePermission: LOCATION_ALWAYS_REASON_FR,
        locationAlwaysPermission: false,
        isIosBackgroundLocationEnabled: true,
      },
    ],
  ],
};

export default config;
