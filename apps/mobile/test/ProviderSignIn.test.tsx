import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import { screen, userEvent } from '@testing-library/react-native';
import { GOOGLE_IOS_CLIENT_ID } from '../src/auth/googleClient';
import type { SupportedLanguage } from '../src/i18n/i18n';
import appConfig from '../app.config';
import { FakeAuthClient, FakeProviderSignIn, MemoryTokenStore } from './fakeAuth';
import { renderPalierApp } from './renderPalierApp';

const NEW_ACCOUNT_TOKEN = 'new-account-token';

interface Setup {
  readonly language?: SupportedLanguage;
  readonly firstName?: string;
  readonly acceptedNoticeVersion?: string | null;
}

function setUp({ language = 'fr', firstName = '', acceptedNoticeVersion = null }: Setup = {}) {
  const authClient = new FakeAuthClient();
  authClient.firstName = firstName;
  authClient.acceptedNoticeVersion = acceptedNoticeVersion;
  authClient.trustedIdentityTokens.set('apple-identity', NEW_ACCOUNT_TOKEN);
  authClient.trustedIdentityTokens.set('google-identity', NEW_ACCOUNT_TOKEN);
  const providerSignIn = new FakeProviderSignIn();
  const tokenStore = new MemoryTokenStore();
  return { authClient, providerSignIn, tokenStore, render: () => renderPalierApp({ authClient, providerSignIn, tokenStore, language, testSignInEnabled: false }) };
}

describe('sign-in with Apple or Google', () => {
  it('offers "Continuer avec Apple" and "Continuer avec Google"', async () => {
    await setUp().render();

    expect(await screen.findByRole('button', { name: 'Continuer avec Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeOnTheScreen();
  });

  it('reads "Continue with Apple" and "Continue with Google" on an English device', async () => {
    await setUp({ language: 'en' }).render();

    expect(await screen.findByRole('button', { name: 'Continue with Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
  });

  it('moves a new person on Apple with a hidden email to the privacy notice, and keeps the session', async () => {
    const { tokenStore, render } = setUp();
    await render();

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Continuer avec Apple' }));

    expect(await screen.findByText('Vos renseignements')).toBeOnTheScreen();
    expect(tokenStore.token).toBe(NEW_ACCOUNT_TOKEN);
  });

  it('passes on the name Apple gives on the first sign-in', async () => {
    const { authClient, providerSignIn, render } = setUp();
    providerSignIn.appleIdentity = { identityToken: 'apple-identity', firstName: 'Nadia', lastName: 'Bouchard' };
    await render();

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Continuer avec Apple' }));

    await screen.findByText('Vos renseignements');
    expect(authClient.appleNames).toEqual([{ firstName: 'Nadia', lastName: 'Bouchard' }]);
  });

  it('opens the home screen of an existing Google account that accepted the notice', async () => {
    await setUp({ firstName: 'Marc', acceptedNoticeVersion: PRIVACY_NOTICE_VERSION }).render();

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Continuer avec Google' }));

    expect(await screen.findByText('Bonjour Marc')).toBeOnTheScreen();
  });

  it('stays on the sign-in screen, with no message, when the person closes the sheet', async () => {
    const { providerSignIn, tokenStore, render } = setUp();
    providerSignIn.googleIdentityToken = null;
    await render();

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Continuer avec Google' }));

    expect(await screen.findByRole('button', { name: 'Continuer avec Google' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });

  it.each([
    ['the API refuses the identity token', (setup: ReturnType<typeof setUp>) => setup.authClient.trustedIdentityTokens.clear()],
    ['the provider sheet fails', (setup: ReturnType<typeof setUp>) => (setup.providerSignIn.sheetFails = true)],
  ])('says sign-in did not go through when %s, and stays signed out', async (_case, breakIt) => {
    const setup = setUp();
    breakIt(setup);
    await setup.render();

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Continuer avec Apple' }));

    expect(await screen.findByRole('alert', { name: 'La connexion n’a pas abouti. Réessayez.' })).toBeOnTheScreen();
    expect(setup.tokenStore.token).toBeNull();
  });
});

describe('asking for the name the provider did not give', () => {
  async function acceptNotice(language: SupportedLanguage = 'fr') {
    const setup = setUp({ language });
    await setup.render();
    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: language === 'fr' ? 'Continuer avec Apple' : 'Continue with Apple' }));
    await user.press(await screen.findByRole('button', { name: language === 'fr' ? 'J’accepte' : 'I accept' }));
    return { ...setup, user };
  }

  it('asks for the name only after the notice is accepted, then opens the home screen with it', async () => {
    const { authClient, user } = await acceptNotice();

    await user.type(await screen.findByLabelText('Prénom'), ' Nadia ');
    await user.type(screen.getByLabelText('Nom'), 'Bouchard');
    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText('Bonjour Nadia')).toBeOnTheScreen();
    expect(authClient.savedNames).toEqual([{ firstName: 'Nadia', lastName: 'Bouchard' }]);
  });

  it('asks for a first name before saving anything', async () => {
    const { authClient, user } = await acceptNotice();

    await user.type(await screen.findByLabelText('Prénom'), '   ');
    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert', { name: 'Entrez votre prénom.' })).toBeOnTheScreen();
    expect(authClient.savedNames).toEqual([]);
  });

  it('says the name was not saved when Palier cannot be reached, and stays on the screen', async () => {
    const { authClient, user } = await acceptNotice();
    authClient.saveNameIsReachable = false;

    await user.type(await screen.findByLabelText('Prénom'), 'Nadia');
    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert', { name: 'Le nom n’a pas été enregistré. Réessayez.' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Prénom')).toBeOnTheScreen();
  });

  it('keeps the saved name even when Palier cannot be read right after', async () => {
    const { authClient, user } = await acceptNotice();
    authClient.isReachable = false;

    await user.type(await screen.findByLabelText('Prénom'), 'Nadia');
    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText('Bonjour Nadia')).toBeOnTheScreen();
    expect(screen.queryByText('Le nom n’a pas été enregistré. Réessayez.')).not.toBeOnTheScreen();
  });

  it('lets the person sign out instead of giving a name', async () => {
    const { tokenStore, user } = await acceptNotice();

    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('button', { name: 'Continuer avec Apple' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });

  it('reads in English on an English device', async () => {
    await acceptNotice('en');

    expect(await screen.findByText('Your name')).toBeOnTheScreen();
    expect(screen.getByLabelText('First name')).toBeOnTheScreen();
  });
});

describe('the Google return address', () => {
  it('is the iOS client id reversed, or Google cannot send the person back to Palier', () => {
    const plugin = appConfig.plugins?.find((entry) => Array.isArray(entry) && entry[0] === '@react-native-google-signin/google-signin');
    const { iosUrlScheme } = (plugin as [string, { iosUrlScheme: string }])[1];

    expect(`${iosUrlScheme.replace('com.googleusercontent.apps.', '')}.apps.googleusercontent.com`).toBe(GOOGLE_IOS_CLIENT_ID);
  });

  it('asks iOS for Sign in with Apple', () => {
    expect(appConfig.ios?.usesAppleSignIn).toBe(true);
  });
});
