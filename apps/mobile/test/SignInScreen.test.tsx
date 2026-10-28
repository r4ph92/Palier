import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { SignInScreen } from '../src/screens/SignInScreen';
import { FakeAuthClient, julie } from './fakeAuth';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

interface RenderOptions {
  readonly testSignInEnabled?: boolean;
  readonly language?: SupportedLanguage;
  readonly authClient?: FakeAuthClient;
  readonly onSignIn?: (driverId: string) => Promise<void>;
}

async function renderSignInScreen(options: RenderOptions = {}) {
  applyLanguage(options.language ?? 'fr');
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <SignInScreen
        testSignInEnabled={options.testSignInEnabled ?? true}
        authClient={options.authClient ?? new FakeAuthClient()}
        onSignIn={options.onSignIn ?? (() => Promise.resolve())}
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

    expect(onSignIn).toHaveBeenCalledWith(julie.id);
  });

  it('offers to try again when the drivers cannot be loaded', async () => {
    const authClient = new FakeAuthClient();
    authClient.driversListIsReachable = false;
    await renderSignInScreen({ authClient });
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Connexion de test' }));
    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();

    authClient.driversListIsReachable = true;
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('button', { name: 'Julie Tremblay' })).toBeOnTheScreen();
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
