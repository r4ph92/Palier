import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PalierStatusError, type LotsClient } from '../src/api/LotsClient';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakePaymentMethodClient } from './fakePaymentMethodClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;

interface AppOptions {
  readonly authClient?: FakeAuthClient;
  readonly tokenStore?: MemoryTokenStore;
  readonly createLotsClient?: (token: string, onUnauthorized: () => void) => LotsClient;
  readonly language?: SupportedLanguage;
}

async function renderApp(options: AppOptions = {}) {
  applyLanguage(options.language ?? 'fr');
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <PalierApp
        authClient={options.authClient ?? new FakeAuthClient()}
        tokenStore={options.tokenStore ?? new MemoryTokenStore()}
        testSignInEnabled
        createLotsClient={options.createLotsClient ?? (() => new FakeLotsClient(parkingDemoWith(10)))}
        createPaymentMethodClient={() => new FakePaymentMethodClient()}
      />
    </SafeAreaProvider>,
  );
}

function signedInJulie() {
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  return { authClient, tokenStore: new MemoryTokenStore(JULIE_TOKEN) };
}

describe('PalierApp sign-in', () => {
  it('signs Julie in from "Connexion de test", greets her and loads the lots', async () => {
    const tokenStore = new MemoryTokenStore();
    await renderApp({ tokenStore });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Julie Tremblay' }));

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    expect(tokenStore.token).toBe(JULIE_TOKEN);
  });

  it('keeps Julie signed in when the app is relaunched', async () => {
    await renderApp(signedInJulie());

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(screen.queryByText('Connexion de test')).not.toBeOnTheScreen();
  });

  it('sends the stored token with the lots request', async () => {
    const createLotsClient = jest.fn(() => new FakeLotsClient(parkingDemoWith(10)));
    await renderApp({ ...signedInJulie(), createLotsClient });

    await screen.findByText('Parking Démo');

    expect(createLotsClient).toHaveBeenCalledWith(JULIE_TOKEN, expect.any(Function));
  });
});

describe('PalierApp with a refused token', () => {
  it('shows the sign-in screen and forgets a stored token the API refuses', async () => {
    const tokenStore = new MemoryTokenStore('revoked-token');
    await renderApp({ tokenStore });

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });

  it('shows the sign-in screen when the lots list answers unauthorized', async () => {
    const { authClient, tokenStore } = signedInJulie();
    const refusingLots = (_token: string, onUnauthorized: () => void): LotsClient => ({
      listLots: () => {
        onUnauthorized();
        return Promise.reject(new PalierStatusError(401));
      },
    });
    await renderApp({ authClient, tokenStore, createLotsClient: refusingLots });

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });
});

describe('PalierApp sign-out', () => {
  it('signs Julie out from "Compte": sign-in screen, token forgotten and revoked on the API', async () => {
    const { authClient, tokenStore } = signedInJulie();
    await renderApp({ authClient, tokenStore });
    const user = userEvent.setup();
    await screen.findByText('Bonjour Julie');

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
    expect(authClient.signedOutTokens).toEqual([JULIE_TOKEN]);
  });

  it('reads "Sign out" on an English device', async () => {
    await renderApp({ ...signedInJulie(), language: 'en' });
    await screen.findByText('Hello Julie');

    await userEvent.setup().press(screen.getByRole('tab', { name: 'Account' }));

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeOnTheScreen();
  });
});

describe('PalierApp when the profile cannot load after sign-in', () => {
  it('does not keep the token, so the next launch does not restore a session the user never saw', async () => {
    const authClient = new FakeAuthClient();
    authClient.isReachable = false;
    const tokenStore = new MemoryTokenStore();
    await renderApp({ authClient, tokenStore });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Julie Tremblay' }));

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });
});

describe('PalierApp when the API is unreachable at launch', () => {
  it('offers to try again, then restores the session', async () => {
    const { authClient, tokenStore } = signedInJulie();
    authClient.isReachable = false;
    await renderApp({ authClient, tokenStore });

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    authClient.isReachable = true;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(tokenStore.token).toBe(JULIE_TOKEN);
  });
});
