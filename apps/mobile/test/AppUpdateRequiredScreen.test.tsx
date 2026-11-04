import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppUpdateRequiredScreen } from '../src/screens/AppUpdateRequiredScreen';
import { applyLanguage } from '../src/i18n/i18n';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

async function renderScreen(storeUrl: string | undefined) {
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AppUpdateRequiredScreen storeUrl={storeUrl} />
    </SafeAreaProvider>,
  );
}

const STORE_URL = 'https://apps.apple.com/ca/app/palier/id0000000000';

describe('AppUpdateRequiredScreen', () => {
  beforeEach(() => applyLanguage('fr'));

  it('says the version is no longer accepted, as an alert', async () => {
    await renderScreen(STORE_URL);

    expect(screen.getByRole('alert', { name: 'Mise à jour requise' })).toBeOnTheScreen();
    expect(screen.getByText(/Installez la dernière version/)).toBeOnTheScreen();
  });

  it('opens the store page from the update button', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderScreen(STORE_URL);
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mettre à jour' }));

    expect(openURL).toHaveBeenCalledWith(STORE_URL);
    openURL.mockRestore();
  });

  it('offers no update button when no store page is configured', async () => {
    await renderScreen(undefined);

    expect(screen.queryByRole('button', { name: 'Mettre à jour' })).not.toBeOnTheScreen();
  });
});
