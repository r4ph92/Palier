import type { CurrentParkingSession } from '@palier/shared-types';
import { act, screen } from '@testing-library/react-native';
import type { ReceiptClient } from '../src/api/ReceiptClient';
import type { SupportedLanguage } from '../src/i18n/i18n';
import type { ParkedConfidence } from '../src/positioning/PositioningModule';
import { FakeParkingSessionClient } from './fakeParkingSessionClient';
import { positioningRig } from './positioningRig';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

export const PARKED_IN_A1 = 'Garé en A-1';
export const GO_TO_A1 = 'Rendez-vous allée A, place A-1';
const KEEP_ALIVE_COMMAND = /^keepAlive /;

// A recording core without the panel: the test sends the signals itself and reads the commands, oldest first.
export async function julieWith(session: CurrentParkingSession, language: SupportedLanguage = 'fr', receipts?: ReceiptClient) {
  const rig = positioningRig();
  const parkingSession = new FakeParkingSessionClient(session);
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, positioning: rig.core, clients: () => ({ parkingSession, ...(receipts === undefined ? {} : { receipts }) }) });
  await screen.findByRole('tab', { name: 'Session', selected: true });
  const walkAway = (confidence: ParkedConfidence = 'high') => act(async () => rig.simulator.detectParked(confidence));
  const enterAisle = (minor: number) => act(async () => rig.simulator.enterAisle(minor));
  const keepAliveCommands = () => rig.commands().filter((command) => KEEP_ALIVE_COMMAND.test(command));
  return { ...rig, parkingSession, walkAway, enterAisle, keepAliveCommands };
}

export async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}
