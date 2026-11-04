import { screen, userEvent } from '@testing-library/react-native';
import { palierFetch } from '../src/api/appUpdate';
import { PalierStatusError, PalierUnreachableError, type LotsClient } from '../src/api/LotsClient';
import type { SignedInSession } from '../src/api/SignedInClients';
import { FakeAuthClient, MemoryTokenStore } from './fakeAuth';
import { JULIE_TOKEN, renderPalierApp, signedInJulie } from './renderPalierApp';

describe('PalierApp sign-in', () => {
  it('signs Julie in from "Connexion de test", greets her and loads the lots', async () => {
    const tokenStore = new MemoryTokenStore();
    await renderPalierApp({ tokenStore });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Julie Tremblay' }));

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    expect(tokenStore.token).toBe(JULIE_TOKEN);
  });

  it('keeps Julie signed in when the app is relaunched', async () => {
    await renderPalierApp(signedInJulie());

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(screen.queryByText('Connexion de test')).not.toBeOnTheScreen();
  });

  it('sends the stored token with the lots request', async () => {
    const clients = jest.fn(() => ({}));
    await renderPalierApp({ ...signedInJulie(), clients });

    await screen.findByText('Parking Démo');

    expect(clients).toHaveBeenCalledWith(expect.objectContaining({ token: JULIE_TOKEN }));
  });
});

describe('PalierApp with a refused token', () => {
  it('shows the sign-in screen and forgets a stored token the API refuses', async () => {
    const tokenStore = new MemoryTokenStore('revoked-token');
    await renderPalierApp({ tokenStore });

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });

  it('shows the sign-in screen when the lots list answers unauthorized', async () => {
    const { authClient, tokenStore } = signedInJulie();
    const refusingLots = ({ onUnauthorized }: SignedInSession): LotsClient => ({
      listLots: () => {
        onUnauthorized();
        return Promise.reject(new PalierStatusError(401));
      },
    });
    await renderPalierApp({ authClient, tokenStore, clients: (session) => ({ lots: refusingLots(session) }) });

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });
});

describe('PalierApp sign-out', () => {
  it('signs Julie out from "Compte": sign-in screen, token forgotten and revoked on the API', async () => {
    const { authClient, tokenStore } = signedInJulie();
    await renderPalierApp({ authClient, tokenStore });
    const user = userEvent.setup();
    await screen.findByText('Bonjour Julie');

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
    expect(authClient.signedOutTokens).toEqual([JULIE_TOKEN]);
  });

  it('signs Julie out on the device when the API cannot be reached', async () => {
    const { authClient, tokenStore } = signedInJulie();
    authClient.signOut = () => Promise.reject(new PalierUnreachableError('offline'));
    await renderPalierApp({ authClient, tokenStore });
    const user = userEvent.setup();
    await screen.findByText('Bonjour Julie');

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });

  it('keeps Julie signed in, with the button busy, until the API answers the sign-out', async () => {
    const { authClient, tokenStore } = signedInJulie();
    let finishSignOut: () => void = () => undefined;
    authClient.signOut = () => new Promise<void>((resolve) => (finishSignOut = resolve));
    await renderPalierApp({ authClient, tokenStore });
    const user = userEvent.setup();
    await screen.findByText('Bonjour Julie');

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('button', { name: 'Déconnexion…' })).toBeDisabled();
    expect(tokenStore.token).toBe(JULIE_TOKEN);

    finishSignOut();

    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();
    expect(tokenStore.token).toBeNull();
  });

  it('reads "Sign out" on an English device', async () => {
    await renderPalierApp({ ...signedInJulie(), language: 'en' });
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
    await renderPalierApp({ authClient, tokenStore });
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
    await renderPalierApp({ authClient, tokenStore });

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    authClient.isReachable = true;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
    expect(tokenStore.token).toBe(JULIE_TOKEN);
  });

  it('replaces the app with the update screen when the API answers 426', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 426 }));
    await renderPalierApp();
    expect(await screen.findByRole('button', { name: 'Connexion de test' })).toBeOnTheScreen();

    await palierFetch('http://localhost:3000/v1/lots');

    expect(await screen.findByRole('alert', { name: 'Mise à jour requise' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Connexion de test' })).not.toBeOnTheScreen();
    fetchMock.mockRestore();
  });
});
