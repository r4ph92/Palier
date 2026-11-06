import { act, fireEvent, screen } from '@testing-library/react-native';
import { fr } from '../src/i18n/fr';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { DETECTION_OFF_FR, PendingPromptLocationClient, renderedStrings, signInAndOpenScanner, TITLE_FR } from './locationExplanationHarness';

afterEach(() => jest.restoreAllMocks());

describe('the « Always » explanation before the first scan', () => {
  it('explains « Toujours » before any iOS prompt, then asks once on « Continuer » and opens the scanner', async () => {
    const { user, location, store } = await signInAndOpenScanner();

    expect(await screen.findByText(TITLE_FR)).toBeOnTheScreen();
    expect(screen.getByText(/2 à 3 minutes après votre scan/)).toBeOnTheScreen();
    expect(screen.getByText(/indicateur bleu/)).toBeOnTheScreen();
    expect(screen.getByText(/l’entrée, la sortie et la facturation fonctionnent quand même/)).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);

    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(1);
    expect(store.answered).toBe(true);
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
  });

  it('gives the explanation title the header role', async () => {
    await signInAndOpenScanner();

    expect(await screen.findByRole('header', { name: TITLE_FR })).toBeOnTheScreen();
  });

  it('records the answer without any request on « Continuer sans »', async () => {
    const { user, location, store } = await signInAndOpenScanner();

    await user.press(await screen.findByRole('button', { name: 'Continuer sans « Toujours »' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
    expect(store.answered).toBe(true);
  });

  it('still opens the scanner when the request fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const location = new FakeBackgroundLocationClient();
    location.failAlwaysRequest = true;
    const { user, store } = await signInAndOpenScanner({ location });

    await user.press(await screen.findByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(store.answered).toBe(true);
  });

  it('shows an empty scanner frame, not the session skeleton, while the flag is read', async () => {
    const store = new MemoryLocationExplanationStore(false);
    store.readMode = 'pending';
    await signInAndOpenScanner({ store });

    expect(await screen.findByRole('header', { name: 'Scanner' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Vérification de votre session en cours')).not.toBeOnTheScreen();
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
    await act(async () => store.finishRead());
    expect(await screen.findByText(TITLE_FR)).toBeOnTheScreen();
  });

  it('shows on the first Scanner open even though Home already asked « While using the app »', async () => {
    const homeLocation = new FakeDeviceLocationClient('granted');
    const { location } = await signInAndOpenScanner({ homeLocation });

    expect(await screen.findByText(TITLE_FR)).toBeOnTheScreen();
    expect(homeLocation.permissionRequests).toBeGreaterThanOrEqual(1);
    expect(location.alwaysRequests).toBe(0);
  });

  it('skips the explanation for a session already underway while still flagging detection off', async () => {
    const location = new FakeBackgroundLocationClient();
    location.hasAlwaysPermission = false;
    const { store } = await signInAndOpenScanner({ location, parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()) });

    expect(await screen.findByText(DETECTION_OFF_FR)).toBeOnTheScreen();
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
    expect(store.answered).toBe(false);
  });

  it('is entirely in English on an English device, labels included', async () => {
    await signInAndOpenScanner({ language: 'en' });

    expect(await screen.findByText('Why “Always”?')).toBeOnTheScreen();
    expect(screen.getByText('Location')).toBeOnTheScreen();
    expect(screen.getByText(/stays awake for 2 to 3 minutes/)).toBeOnTheScreen();
    expect(screen.getByText(/blue location indicator/)).toBeOnTheScreen();
    expect(screen.getByText(/entry, exit and billing still work/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue without “Always”' })).toBeOnTheScreen();
    const shown = renderedStrings(screen.toJSON());
    const french = Object.values(fr.locationExplanation);
    expect(shown.filter((text) => french.includes(text as never))).toEqual([]);
    expect(shown.join(' ')).not.toMatch(/Toujours|Continuer|Localisation|Pourquoi/);
  });
});

describe('the explanation while the iOS prompt is open', () => {
  it('asks iOS once however Julie taps, and keeps both buttons busy until iOS answers', async () => {
    const location = new PendingPromptLocationClient();
    const { user, store } = await signInAndOpenScanner({ location });
    const continueButton = await screen.findByRole('button', { name: 'Continuer' });

    await act(async () => {
      fireEvent.press(continueButton);
      fireEvent.press(continueButton);
    });
    await user.press(screen.getByRole('button', { name: 'Continuer' }));
    await user.press(screen.getByRole('button', { name: 'Continuer sans « Toujours »' }));

    expect(location.alwaysRequests).toBe(1);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Continuer sans « Toujours »' })).toBeBusy();
    expect(screen.getByText(TITLE_FR)).toBeOnTheScreen();
    expect(store.answered).toBe(false);

    await act(async () => location.answerPrompt(false));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(store.answered).toBe(true);
    expect(location.alwaysRequests).toBe(1);
  });
});

describe('the explanation is shown once per device', () => {
  it('does not show the explanation again once Julie answered', async () => {
    const { location } = await signInAndOpenScanner({ store: new MemoryLocationExplanationStore(true) });

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
  });

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
    const { user, location } = await signInAndOpenScanner({ testSignInEnabled: true });
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
    store.readMode = 'failing';
    const { user, location } = await signInAndOpenScanner({ store });

    expect(await screen.findByText(TITLE_FR)).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it.each(['Continuer', 'Continuer sans « Toujours »'])('opens the scanner after « %s » when the flag cannot be saved, and keeps the explanation away after leaving the tab', async (buttonName) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new MemoryLocationExplanationStore(false);
    store.writeMode = 'failing';
    const { user } = await signInAndOpenScanner({ store });

    await user.press(await screen.findByRole('button', { name: buttonName }));
    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(warn).toHaveBeenCalled();

    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
  });
});
