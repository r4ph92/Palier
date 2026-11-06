import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { fr } from '../src/i18n/fr';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { DETECTION_OFF_FR, PendingPromptLocationClient, signInAndOpenScanner, TITLE_FR } from './locationExplanationHarness';

afterEach(() => jest.restoreAllMocks());

describe('the decisions of the « Always » explanation', () => {
  it('keeps both buttons busy while the iOS prompt is open', async () => {
    const location = new PendingPromptLocationClient();
    const { user } = await signInAndOpenScanner({ location });

    await user.press(await screen.findByRole('button', { name: 'Continuer' }));

    expect(screen.getByRole('button', { name: 'Continuer' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Continuer sans « Toujours »' })).toBeBusy();
    await act(async () => location.answerPrompt(true));
  });

  it('shows the explanation again when the flag cannot be read', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new MemoryLocationExplanationStore(true);
    store.readMode = 'failing';
    await signInAndOpenScanner({ store });

    expect(await screen.findByText(TITLE_FR)).toBeOnTheScreen();
  });

  it('opens the scanner even when the flag cannot be saved', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new MemoryLocationExplanationStore(false);
    store.writeMode = 'failing';
    const { user } = await signInAndOpenScanner({ store });

    await user.press(await screen.findByRole('button', { name: 'Continuer' }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
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

  it('shows no detection notice before iOS has answered', async () => {
    const location = new FakeBackgroundLocationClient();
    location.hasAlwaysPermission = false;
    location.hasAlways = () => new Promise(() => undefined);
    await signInAndOpenScanner({ location, store: new MemoryLocationExplanationStore(true), parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()) });

    expect(await screen.findByText('Session en cours')).toBeOnTheScreen();
    expect(screen.queryByText(DETECTION_OFF_FR)).not.toBeOnTheScreen();
  });

  it('queues the detection announcement so it does not cut off another one', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => undefined);
    const location = new FakeBackgroundLocationClient();
    location.hasAlwaysPermission = false;
    await signInAndOpenScanner({ location, store: new MemoryLocationExplanationStore(true), parkingSession: new FakeParkingSessionClient(julieAtParkingDemo()) });
    await screen.findByText(DETECTION_OFF_FR);

    expect(announce).toHaveBeenCalledWith(fr.session.detectionOff, { queue: true });
  });

  it('gives the explanation title the header role', async () => {
    await signInAndOpenScanner();

    expect(await screen.findByRole('header', { name: TITLE_FR })).toBeOnTheScreen();
  });
});
