import { act, screen, userEvent } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { FakeBackgroundLocationClient } from './fakeBackgroundLocationClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { visibleText } from './visibleText';

export const TITLE_FR = 'Pourquoi « Toujours » ?';
export const DETECTION_OFF_FR = 'Détection automatique désactivée — votre place sera présumée occupée après 30 min';

// iOS keeps its prompt open until the driver answers it.
export class PendingPromptLocationClient extends FakeBackgroundLocationClient {
  #answer: () => void = () => undefined;

  override requestAlways(): Promise<void> {
    this.alwaysRequests += 1;
    return new Promise((resolve) => {
      this.#answer = resolve;
    });
  }

  answerPrompt(isAlwaysGranted: boolean): void {
    this.hasAlwaysPermission = isAlwaysGranted;
    this.#answer();
  }
}

export class FailingStatusLocationClient extends FakeBackgroundLocationClient {
  override hasAlways(): Promise<boolean> {
    return Promise.reject(new Error('fake status failure'));
  }
}

export interface Harness {
  readonly location?: FakeBackgroundLocationClient;
  readonly store?: MemoryLocationExplanationStore;
  readonly parkingSession?: FakeParkingSessionClient;
  readonly homeLocation?: FakeDeviceLocationClient;
  readonly language?: SupportedLanguage;
}

export async function signInAndOpenScanner(harness: Harness = {}) {
  const location = harness.location ?? new FakeBackgroundLocationClient();
  const store = harness.store ?? new MemoryLocationExplanationStore(false);
  const parkingSession = harness.parkingSession ?? new FakeParkingSessionClient(null);
  const homeLocation = harness.homeLocation ?? new FakeDeviceLocationClient();
  const entry = new FakeEntryClient();
  await renderPalierApp({
    ...signedInJulie(),
    testSignInEnabled: false,
    language: harness.language ?? 'fr',
    clients: () => ({ backgroundLocation: location, locationExplanation: store, parkingSession, location: homeLocation, entry }),
  });
  const user = userEvent.setup();
  if (parkingSession.session === null) {
    await user.press(await screen.findByRole('tab', { name: harness.language === 'en' ? 'Scan' : 'Scanner' }));
  }
  return { user, location, store, parkingSession, homeLocation, entry };
}

export async function scanEntreeDemoAndOpenSession(user: ReturnType<typeof userEvent.setup>, parkingSession: FakeParkingSessionClient) {
  parkingSession.session = julieAtParkingDemo({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
  await user.type(await screen.findByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: 'Scanner' }));
  expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Terminé' }));
  expect(await screen.findByText('Montant à ce jour : 0,75 $', visibleText)).toBeOnTheScreen();
}

export function captureAppStateListeners() {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
  return async (state: AppStateStatus) => {
    await act(async () => {
      listeners.forEach((listener) => listener(state));
      await Promise.resolve();
    });
  };
}

export function renderedStrings(node: unknown, found: string[] = []): string[] {
  if (typeof node === 'string') {
    found.push(node);
  } else if (Array.isArray(node)) {
    node.forEach((child) => renderedStrings(child, found));
  } else if (node !== null && typeof node === 'object') {
    const element = node as { props?: Record<string, unknown>; children?: unknown };
    const label = element.props?.accessibilityLabel;
    if (typeof label === 'string') {
      found.push(label);
    }
    renderedStrings(element.children ?? null, found);
  }
  return found;
}
