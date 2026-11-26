import { AccessibilityInfo } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PalierStatusError } from '../src/api/LotsClient';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { SignInScreen } from '../src/screens/SignInScreen';
import { TestSignInSection } from '../src/testSignIn/TestSignInSection';
import { FakeAuthClient, FakeTestSignInClient, julie } from './fakeAuth';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

interface RenderOptions {
  readonly testSignInEnabled?: boolean;
  readonly language?: SupportedLanguage;
  readonly testSignInClient?: FakeTestSignInClient;
  readonly onSignIn?: (driverId: string) => Promise<void>;
}

async function renderSignInScreen(options: RenderOptions = {}) {
  applyLanguage(options.language ?? 'fr');
  const client = options.testSignInClient ?? new FakeTestSignInClient(new FakeAuthClient());
  const testSignIn = (options.testSignInEnabled ?? true) ? { Section: TestSignInSection, client } : null;
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <SignInScreen
        testSignIn={testSignIn}
        onSignIn={options.onSignIn ?? (() => Promise.resolve())}
        onContinueWith={() => Promise.resolve()}
      />
    </SafeAreaProvider>,
  );
}

describe('SignInScreen with test sign-in enabled', () => {
  it('lists the seeded drivers once "Connexion de test" is opened', async () => {
    await renderSignInScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Connexion de test' }));

    expect(await screen.findByRole('button', { name: 'Julie Tremblay' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Marc Gagnon' })).toBeOnTheScreen();
  });

  it('signs in as the driver who is picked', async () => {
    const onSignIn = jest.fn(() => Promise.resolve());
    await renderSignInScreen({ onSignIn });
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Julie Tremblay' }));

    expect(onSignIn).toHaveBeenCalledWith(`${julie.id}-token`);
  });

  it('offers to try again when the drivers cannot be loaded', async () => {
    const testSignInClient = new FakeTestSignInClient(new FakeAuthClient());
    testSignInClient.driversListIsReachable = false;
    await renderSignInScreen({ testSignInClient });
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Connexion de test' }));
    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();

    testSignInClient.driversListIsReachable = true;
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('button', { name: 'Julie Tremblay' })).toBeOnTheScreen();
  });

  it('says a driver removed by a reseed no longer exists, and lists the drivers again', async () => {
    const testSignInClient = new FakeTestSignInClient(new FakeAuthClient());
    const listDrivers = jest.spyOn(testSignInClient, 'listTestDrivers');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const onSignIn = jest.fn(() => Promise.reject(new PalierStatusError(404)));
    await renderSignInScreen({ testSignInClient, onSignIn });
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Julie Tremblay' }));

    expect(await screen.findByText('Ce conducteur n’existe plus.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Marc Gagnon' })).toBeOnTheScreen();
    expect(screen.queryByText('Impossible de joindre Palier.')).not.toBeOnTheScreen();
    expect(listDrivers).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenCalledWith('Ce conducteur n’existe plus.');
    announce.mockRestore();
  });

  it('caps the "Connexion de test" heading at the title size for large text', async () => {
    await renderSignInScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Connexion de test' }));

    expect(await screen.findByRole('header', { name: 'Connexion de test' })).toHaveProp('maxFontSizeMultiplier', 1.4);
  });

  it('reads "Test sign-in" on an English device', async () => {
    await renderSignInScreen({ language: 'en' });

    expect(screen.getByRole('button', { name: 'Test sign-in' })).toBeOnTheScreen();
    expect(screen.getByText('Sign in')).toBeOnTheScreen();
  });
});

describe('SignInScreen in a production build', () => {
  it('shows no test sign-in', async () => {
    await renderSignInScreen({ testSignInEnabled: false });

    expect(screen.getByText('Connexion')).toBeOnTheScreen();
    expect(screen.queryByText('Connexion de test')).not.toBeOnTheScreen();
  });
});
