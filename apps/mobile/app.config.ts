import type { ExpoConfig } from 'expo/config';

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
    fr: {},
    en: {},
  },
  plugins: ['expo-status-bar', 'expo-localization', 'expo-font'],
};

export default config;
