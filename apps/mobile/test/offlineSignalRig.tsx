import { screen, userEvent } from '@testing-library/react-native';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { memoryQueueStorage, ParkedSignalQueue } from '../src/parkingSessions/ParkedSignalQueue';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

export const WALKING = 'Stationné (à pied, confiance élevée)';
export const WAITING_FR = 'Hors ligne — 1 signal en attente';
export const SENT_FR = '1 signal envoyé';

type User = ReturnType<typeof userEvent.setup>;

export async function pressInPanel(user: User, signal: string, language: SupportedLanguage = 'fr') {
  await user.press(screen.getByRole('tab', { name: language === 'fr' ? 'Compte' : 'Account' }));
  await user.press(await screen.findByRole('button', { name: 'Développeur' }));
  await user.press(await screen.findByRole('button', { name: signal }));
  await user.press(screen.getByRole('tab', { name: 'Session' }));
}

// Same wiring as App.tsx, over a queue the test can reopen to play a relaunch.
export async function julieWithPanel(
  language: SupportedLanguage = 'fr',
  storage = memoryQueueStorage(),
  parkingSession = new FakeParkingSessionClient(julieAtParkingDemo()),
) {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioning = new PositioningCore(toolkit.module);
  const view = await renderPalierApp({
    ...signedInJulie(),
    testSignInEnabled: false,
    language,
    developerEntry: toolkit.bind(positioning),
    positioning,
    parkedSignals: new ParkedSignalQueue(storage),
    clients: () => ({ parkingSession }),
  });
  await screen.findByRole('tab', { name: 'Session', selected: true });
  return { view, storage, parkingSession, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }) };
}
