import { screen } from '@testing-library/react-native';
import { fr } from '../src/i18n/fr';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import {
  captureAppStateListeners,
  DETECTION_OFF_FR,
  FailingStatusLocationClient,
  renderedStrings,
  signInAndOpenScanner,
  TITLE_FR,
} from './locationExplanationHarness';

afterEach(() => jest.restoreAllMocks());

describe('the detection notice on the session screen', () => {
  it('shows no notice and does not crash when iOS cannot say whether « Always » is granted', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await signInAndOpenScanner({
      location: new FailingStatusLocationClient(),
      store: new MemoryLocationExplanationStore(true),
      parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()),
    });

    expect(await screen.findByText('Session en cours')).toBeOnTheScreen();
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
    expect(warn).toHaveBeenCalled();
  });

  it('reads the permission again when Julie comes back from Settings, in both directions', async () => {
    const emit = captureAppStateListeners();
    const location = new FakeBackgroundLocationClient();
    location.hasAlwaysPermission = true;
    await signInAndOpenScanner({ location, store: new MemoryLocationExplanationStore(true), parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()) });
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

  it('skips the explanation for a session already underway while still flagging detection off', async () => {
    const location = new FakeBackgroundLocationClient();
    location.hasAlwaysPermission = false;
    const store = new MemoryLocationExplanationStore(false);
    await signInAndOpenScanner({ location, store, parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()) });

    expect(await screen.findByText(DETECTION_OFF_FR)).toBeOnTheScreen();
    expect(screen.queryByText(TITLE_FR)).not.toBeOnTheScreen();
    expect(location.alwaysRequests).toBe(0);
    expect(store.answered).toBe(false);
  });
});

describe('the explanation on an English device', () => {
  it('shows no French word anywhere on the screen, labels included', async () => {
    await signInAndOpenScanner({ language: 'en' });
    expect(await screen.findByText('Why “Always”?')).toBeOnTheScreen();

    const shown = renderedStrings(screen.toJSON());
    const french = Object.values(fr.locationExplanation);

    expect(shown.filter((text) => french.includes(text as never))).toEqual([]);
    expect(shown.join(' ')).not.toMatch(/Toujours|Continuer|Localisation|Pourquoi/);
  });
});
