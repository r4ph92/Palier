import { screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import type { SupportedLanguage } from '../src/i18n/i18n';

const DETECTION_OFF_FR = 'Détection automatique désactivée — votre place sera présumée occupée après 30 min';

async function openScanner(options: {
  readonly location?: FakeBackgroundLocationClient;
  readonly store?: MemoryLocationExplanationStore;
  readonly parkingSession?: FakeParkingSessionClient;
  readonly language?: SupportedLanguage;
}) {
  const location = options.location ?? new FakeBackgroundLocationClient();
  const locationExplanation = options.store ?? new MemoryLocationExplanationStore(false);
  const parkingSession = options.parkingSession ?? new FakeParkingSessionClient(null);
  await renderPalierApp({
    ...signedInJulie(),
    testSignInEnabled: false,
    language: options.language ?? 'fr',
    clients: () => ({ backgroundLocation: location, locationExplanation, parkingSession }),
  });
  const user = userEvent.setup();
  // A session already underway opens its tab by itself.
  if (parkingSession.session === null) {
    await user.press(await screen.findByRole('tab', { name: options.language === 'en' ? 'Scan' : 'Scanner' }));
  }
  return { user, location, locationExplanation };
}

describe('the « Always » explanation before the first scan', () => {
  it('explains « Toujours » before any iOS prompt, then asks once on « Continuer » and opens the scanner', async () => {
    const { user, location, locationExplanation } = await openScanner({});

    expect(await screen.findByText('Pourquoi « Toujours » ?')).toBeOnTheScreen();
    expect(screen.getByText(/2 à 3 minutes après votre scan/)).toBeOnTheScreen();
    expect(screen.getByText(/indicateur bleu/)).toBeOnTheScreen();
    expect(screen.getByText(/l’entrée, la sortie et la facturation fonctionnent quand même/)).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);

    await user.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(1);
    expect(locationExplanation.answered).toBe(true);
    expect(screen.queryByText('Pourquoi « Toujours » ?')).not.toBeOnTheScreen();
  });

  it('opens the scanner with no further notice when Julie grants « Always »', async () => {
    const { user } = await openScanner({});

    await user.press(await screen.findByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
  });

  it('still opens the scanner when the request fails', async () => {
    const location = new FakeBackgroundLocationClient();
    location.failAlwaysRequest = true;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { user, locationExplanation } = await openScanner({ location });

    await user.press(await screen.findByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(locationExplanation.answered).toBe(true);
    warn.mockRestore();
  });

  it('records the answer without any request on « Continuer sans »', async () => {
    const { user, location, locationExplanation } = await openScanner({});

    await user.press(await screen.findByRole('button', { name: 'Continuer sans « Toujours »' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
    expect(locationExplanation.answered).toBe(true);
  });

  it('does not show the explanation again once Julie answered', async () => {
    const { location } = await openScanner({ store: new MemoryLocationExplanationStore(true) });

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText('Pourquoi « Toujours » ?')).not.toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
  });

  it('skips the explanation for a session already underway', async () => {
    const { location } = await openScanner({ parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()) });

    expect(await screen.findByText('Session en cours')).toBeOnTheScreen();
    expect(screen.queryByText('Pourquoi « Toujours » ?')).not.toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
  });

  it('is entirely in English on an English device', async () => {
    await openScanner({ language: 'en' });

    expect(await screen.findByText('Why “Always”?')).toBeOnTheScreen();
    expect(screen.getByText('Location')).toBeOnTheScreen();
    expect(screen.getByText(/stays awake for 2 to 3 minutes/)).toBeOnTheScreen();
    expect(screen.getByText(/blue location indicator/)).toBeOnTheScreen();
    expect(screen.getByText(/entry, exit and billing still work/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue without “Always”' })).toBeOnTheScreen();
  });
});

describe('the session screen when « Always » is not granted', () => {
  async function sessionScreen(background: 'always' | 'limited' | 'denied', language: SupportedLanguage = 'fr') {
    const location = new FakeBackgroundLocationClient();
    location.status = background;
    await openScanner({ location, store: new MemoryLocationExplanationStore(true), parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()), language });
  }

  it.each(['limited', 'denied'] as const)('says detection is off for %s and links to iOS Settings', async (background) => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await sessionScreen(background);
    const user = userEvent.setup();

    expect(await screen.findByText(DETECTION_OFF_FR)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));

    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('shows no notice when « Always » is granted', async () => {
    await sessionScreen('always');

    expect(await screen.findByText('Session en cours')).toBeOnTheScreen();
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
  });

  it('says it in English on an English device', async () => {
    await sessionScreen('denied', 'en');

    expect(await screen.findByText('Automatic detection is off — your spot will be assumed occupied after 30 min')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeOnTheScreen();
  });
});
