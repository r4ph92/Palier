import { act, screen, userEvent } from '@testing-library/react-native';
import { createSimulatedToolkit } from '../src/dev/simulatedToolkit';
import type { SimulatedPositioningModule } from '../src/dev/SimulatedPositioningModule';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { PositioningCore } from '../src/positioning/PositioningCore';
import { MemoryOfflineWalkStore } from './fakeOfflineWalkStore';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

export const WALKING = 'Stationné (à pied, confiance élevée)';
export const PENDING_FR = 'Hors ligne — 1 signal en attente';
export const SENT_FR = '1 signal envoyé';

export interface OfflineWalksAppOptions {
  readonly language?: SupportedLanguage;
  readonly store?: MemoryOfflineWalkStore;
  readonly parkingSession?: FakeParkingSessionClient;
}

// Same wiring as App.tsx: the panel's module feeds the core and its network is the app's.
export async function julieWithPanelNetwork({ language = 'fr', store = new MemoryOfflineWalkStore(), parkingSession = new FakeParkingSessionClient(julieAtParkingDemo()) }: OfflineWalksAppOptions = {}) {
  const toolkit = createSimulatedToolkit(() => Date.now());
  const positioning = new PositioningCore(toolkit.module);
  const developerEntry = toolkit.bind(positioning);
  const clients = () => ({ parkingSession, offlineWalks: store });
  const rendered = await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, developerEntry, positioning, connectivity: toolkit.connectivity, clients });
  await screen.findByRole('tab', { name: 'Session', selected: true });
  const simulator = toolkit.module as SimulatedPositioningModule;
  const signal = (send: (module: SimulatedPositioningModule) => void) => act(async () => send(simulator));
  return { ...rendered, simulator, signal, parkingSession, store, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }) };
}
