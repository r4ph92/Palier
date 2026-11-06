import * as SecureStore from 'expo-secure-store';
import appConfig from '../app.config';
import { secureTokenStore } from '../src/auth/TokenStore';
import { secureLocationExplanationStore } from '../src/deviceLocation/LocationExplanationStore';

jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(items.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => Promise.resolve(void items.set(key, value))),
    deleteItemAsync: jest.fn((key: string) => Promise.resolve(void items.delete(key))),
  };
});

describe('the device flag in the iOS keychain', () => {
  it('starts unanswered, then stays answered after the driver signs out', async () => {
    await expect(secureLocationExplanationStore.wasAnswered()).resolves.toBe(false);

    await secureLocationExplanationStore.markAnswered();
    await secureTokenStore.save('julie-token');
    await secureTokenStore.clear();

    await expect(secureLocationExplanationStore.wasAnswered()).resolves.toBe(true);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('palier.locationExplanationAnswered');
  });

  it('counts any stored value other than its own as unanswered', async () => {
    await SecureStore.setItemAsync('palier.locationExplanationAnswered', 'yes');

    await expect(secureLocationExplanationStore.wasAnswered()).resolves.toBe(false);
  });
});

type LocationPluginOptions = Record<string, unknown>;

function locationPluginOptions(): LocationPluginOptions {
  const plugin = appConfig.plugins?.find((entry) => Array.isArray(entry) && entry[0] === 'expo-location');
  return (plugin as [string, LocationPluginOptions])[1];
}

describe('the iOS « Always » configuration', () => {
  it('enables background location and gives the French reason to the plugin', () => {
    const options = locationPluginOptions();
    const french = appConfig.locales?.fr as Record<string, string>;

    expect(options.isIosBackgroundLocationEnabled).toBe(true);
    expect(options.locationAlwaysAndWhenInUsePermission).toBe(french.NSLocationAlwaysAndWhenInUseUsageDescription);
  });

  it.each([
    ['fr', /2 à 3 minutes après votre scan/],
    ['en', /2 to 3 minutes after your scan/],
  ])('explains « Always » in %s next to the while-in-use reason', (language, reason) => {
    const strings = appConfig.locales?.[language] as Record<string, string>;

    expect(strings.NSLocationWhenInUseUsageDescription).toEqual(expect.any(String));
    expect(strings.NSLocationAlwaysAndWhenInUseUsageDescription).toMatch(reason);
  });
});
