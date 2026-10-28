import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;
const OLDER_NOTICE_VERSION = '2020-01-01';

async function renderApp(authClient: FakeAuthClient, tokenStore: MemoryTokenStore, language: SupportedLanguage = 'fr') {
  applyLanguage(language);
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <PalierApp
        authClient={authClient}
        tokenStore={tokenStore}
        testSignInEnabled
        createLotsClient={() => new FakeLotsClient(parkingDemoWith(10))}
      />
    </SafeAreaProvider>,
  );
}

function driverWhoNeverAccepted() {
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  authClient.acceptedNoticeVersion = null;
  return { authClient, tokenStore: new MemoryTokenStore(JULIE_TOKEN) };
}

describe('PalierApp privacy notice', () => {
  it('shows the notice before the home screen, with no tabs, when Julie signs in for the first time', async () => {
    const authClient = new FakeAuthClient();
    authClient.acceptedNoticeVersion = null;
    await renderApp(authClient, new MemoryTokenStore());
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Julie Tremblay' }));

    expect(await screen.findByText('Vos renseignements')).toBeOnTheScreen();
    expect(screen.queryByText('Bonjour Julie')).not.toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Compte' })).not.toBeOnTheScreen();
  });

  it('records the notice version when Julie accepts, then opens the home screen', async () => {
    const { authClient, tokenStore } = driverWhoNeverAccepted();
    await renderApp(authClient, tokenStore);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: "J'accepte" }));

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(authClient.acceptedNotices).toEqual([PRIVACY_NOTICE_VERSION]);
  });

  it('refuses the app without consent when Julie declines, and offers only sign-out', async () => {
    const { authClient, tokenStore } = driverWhoNeverAccepted();
    await renderApp(authClient, tokenStore);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Refuser' }));

    expect(await screen.findByText('Palier ne peut pas être utilisée sans votre consentement.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "J'accepte" })).not.toBeOnTheScreen();
    expect(screen.queryByRole('tab')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(authClient.acceptedNotices).toEqual([]);
    expect(authClient.signedOutTokens).toEqual([JULIE_TOKEN]);
  });

  it('shows the notice again to Julie when a newer notice version is in force', async () => {
    const authClient = new FakeAuthClient();
    authClient.validTokens.add(JULIE_TOKEN);
    authClient.acceptedNoticeVersion = OLDER_NOTICE_VERSION;
    await renderApp(authClient, new MemoryTokenStore(JULIE_TOKEN));

    expect(await screen.findByText('Vos renseignements')).toBeOnTheScreen();
    expect(screen.queryByText('Bonjour Julie')).not.toBeOnTheScreen();
  });

  it('reads entirely in English on an English device', async () => {
    const { authClient, tokenStore } = driverWhoNeverAccepted();
    await renderApp(authClient, tokenStore, 'en');

    expect(await screen.findByText('Your information')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'I accept' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeOnTheScreen();
    expect(screen.queryByText('Vos renseignements')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Pour stationner/)).not.toBeOnTheScreen();
  });

  it('offers to try again when the acceptance cannot reach Palier, then records it', async () => {
    const { authClient, tokenStore } = driverWhoNeverAccepted();
    authClient.acceptIsReachable = false;
    await renderApp(authClient, tokenStore);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: "J'accepte" }));
    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();

    authClient.acceptIsReachable = true;
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(authClient.acceptedNotices).toEqual([PRIVACY_NOTICE_VERSION]);
  });
});
