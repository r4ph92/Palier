import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Linking } from 'react-native';
import { fr } from '../src/i18n/fr';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { ENTREE_DEMO_QR } from './fakeEntryClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import {
  captureAppStateListeners,
  DETECTION_OFF_FR,
  FailingStatusLocationClient,
  PendingPromptLocationClient,
  scanEntreeDemoAndOpenSession,
  signInAndOpenScanner,
  UnansweredStatusLocationClient,
} from './locationExplanationHarness';

afterEach(() => jest.restoreAllMocks());

function openSessionUnderway(location: FakeBackgroundLocationClient, language: SupportedLanguage = 'fr') {
  return signInAndOpenScanner({
    location,
    store: new MemoryLocationExplanationStore(true),
    parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()),
    language,
  });
}

function withoutAlways(): FakeBackgroundLocationClient {
  const location = new FakeBackgroundLocationClient();
  location.hasAlwaysPermission = false;
  return location;
}

describe('the automatic detection notice after an entry', () => {
  it.each([
    ['Continuer', 1],
    ['Continuer sans « Toujours »', 0],
  ] as const)('lets Julie enter without « Always » after « %s », then flags detection off with a link to iOS Settings', async (answer, requests) => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    openSettings.mockClear();
    const location = withoutAlways();
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
    location.hasAlwaysPermission = false;
    const { user, parkingSession } = await signInAndOpenScanner({ location });

    await user.press(await screen.findByRole('button', { name: 'Continuer' }));
    await act(async () => location.answerPrompt(true));
    await scanEntreeDemoAndOpenSession(user, parkingSession);

    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ouvrir les réglages' })).not.toBeOnTheScreen();
  });
});

describe('the automatic detection notice on a session already underway', () => {
  it('says it in English on an English device', async () => {
    await openSessionUnderway(withoutAlways(), 'en');

    expect(await screen.findByText('Automatic detection is off — your spot will be assumed occupied after 30 min')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeOnTheScreen();
  });

  it('queues the detection announcement so it does not cut off another one', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => undefined);
    await openSessionUnderway(withoutAlways());
    await screen.findByText(DETECTION_OFF_FR);

    expect(announce).toHaveBeenCalledWith(fr.session.detectionOff, { queue: true });
  });

  it('shows no notice before iOS has answered', async () => {
    await openSessionUnderway(new UnansweredStatusLocationClient());

    expect(await screen.findByText('Session en cours')).toBeOnTheScreen();
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
  });

  it('shows no notice and does not crash when iOS cannot say whether « Always » is granted', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await openSessionUnderway(new FailingStatusLocationClient());

    expect(await screen.findByText('Session en cours')).toBeOnTheScreen();
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
    expect(warn).toHaveBeenCalled();
  });

  it('reads the permission again when Julie comes back from Settings, in both directions', async () => {
    const emit = captureAppStateListeners();
    const location = new FakeBackgroundLocationClient();
    location.hasAlwaysPermission = true;
    await openSessionUnderway(location);
    expect(await screen.findByText('Session en cours')).toBeOnTheScreen();
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();

    location.hasAlwaysPermission = false;
    await emit('background');
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
    await emit('active');
    expect(await screen.findByText(DETECTION_OFF_FR)).toBeOnTheScreen();

    location.hasAlwaysPermission = true;
    await emit('active');
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
  });
});
