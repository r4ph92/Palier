import { act, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { ENTREE_DEMO_QR } from './fakeEntryClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import {
  DETECTION_OFF_FR,
  PendingPromptLocationClient,
  scanEntreeDemoAndOpenSession,
  signInAndOpenScanner,
  TITLE_FR,
} from './locationExplanationHarness';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

afterEach(() => jest.restoreAllMocks());

describe('the « Always » choice, end to end through an entry', () => {
  it.each([
    ['limited', 'Continuer', 1],
    ['denied', 'Continuer', 1],
    ['denied', 'Continuer sans « Toujours »', 0],
  ] as const)('lets Julie enter after « %s » from « %s », then flags detection off with a link to iOS Settings', async (status, answer, requests) => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    openSettings.mockClear();
    const location = new FakeBackgroundLocationClient();
    location.status = status;
    const { user, parkingSession, entry } = await signInAndOpenScanner({ location });

    await user.press(await screen.findByRole('button', { name: answer }));
    await scanEntreeDemoAndOpenSession(user, parkingSession);

    expect(entry.scanned).toEqual([ENTREE_DEMO_QR]);
    expect(location.alwaysRequests).toBe(requests);
    expect(await screen.findByText(DETECTION_OFF_FR)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows the session with no detection notice once « Always » is granted at the prompt', async () => {
    const location = new PendingPromptLocationClient();
    location.status = 'limited';
    const { user, parkingSession } = await signInAndOpenScanner({ location });

    await user.press(await screen.findByRole('button', { name: 'Continuer' }));
    await act(async () => location.answerPrompt('always'));
    await scanEntreeDemoAndOpenSession(user, parkingSession);

    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ouvrir les réglages' })).not.toBeOnTheScreen();
  });
});

describe('the explanation is shown once per device', () => {
  it('does not come back when Julie leaves the scanner and opens it again', async () => {
    const { user, location } = await signInAndOpenScanner();
    await user.press(await screen.findByRole('button', { name: 'Continuer' }));
    await screen.findByLabelText('Contenu du QR');

    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(1);
  });

  it('survives a sign-out and another driver signing in on the same phone', async () => {
    const store = new MemoryLocationExplanationStore(false);
    const location = new FakeBackgroundLocationClient();
    await renderPalierApp({ ...signedInJulie(), clients: () => ({ backgroundLocation: location, locationExplanation: store }) });
    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    await user.press(await screen.findByRole('button', { name: 'Continuer' }));
    await screen.findByLabelText('Contenu du QR');

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Se déconnecter' }));
    await user.press(await screen.findByRole('button', { name: 'Connexion de test' }));
    await user.press(await screen.findByRole('button', { name: 'Marc Gagnon' }));
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(1);
  });

  it('counts a flag that cannot be read as unanswered, and still asks only on « Continuer »', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new MemoryLocationExplanationStore(true);
    store.wasAnswered = () => Promise.reject(new Error('keychain locked'));
    const { user, location } = await signInAndOpenScanner({ store });

    expect(await screen.findByText(TITLE_FR)).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it('still opens the scanner when the flag cannot be saved', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new MemoryLocationExplanationStore(false);
    store.markAnswered = () => Promise.reject(new Error('keychain full'));
    const { user } = await signInAndOpenScanner({ store });

    await user.press(await screen.findByRole('button', { name: 'Continuer sans « Toujours »' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(warn).toHaveBeenCalled();
  });
});

describe('the explanation while the iOS prompt is open', () => {
  it('asks iOS once however many times Julie taps, and keeps « Continuer sans » inactive until iOS answers', async () => {
    const location = new PendingPromptLocationClient();
    const { user, store } = await signInAndOpenScanner({ location });

    const continueButton = await screen.findByRole('button', { name: 'Continuer' });
    await user.press(continueButton);
    await user.press(screen.getByRole('button', { name: 'Continuer' }));
    await user.press(screen.getByRole('button', { name: 'Continuer sans « Toujours »' }));

    expect(location.alwaysRequests).toBe(1);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    expect(screen.getByText(TITLE_FR)).toBeOnTheScreen();
    expect(store.answered).toBe(false);

    await act(async () => location.answerPrompt('limited'));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(store.answered).toBe(true);
    expect(location.alwaysRequests).toBe(1);
  });
});

describe('the explanation after the Home tab asked for « While using the app »', () => {
  it('shows on the first Scanner open even though Home already asked iOS, and asks « Always » only on « Continuer »', async () => {
    const homeLocation = new FakeDeviceLocationClient('granted');
    const location = new FakeBackgroundLocationClient();
    await renderPalierApp({
      ...signedInJulie(),
      clients: () => ({ location: homeLocation, backgroundLocation: location, locationExplanation: new MemoryLocationExplanationStore(false) }),
    });
    const user = userEvent.setup();
    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    expect(homeLocation.permissionRequests).toBeGreaterThanOrEqual(1);
    expect(location.alwaysRequests).toBe(0);

    await user.press(screen.getByRole('tab', { name: 'Scanner' }));

    expect(await screen.findByText(TITLE_FR)).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
    await user.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(1);
  });
});
