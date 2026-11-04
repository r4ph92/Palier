import type { EntryStatusResponse } from '@palier/shared-types';
import { Component, type ReactNode } from 'react';
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { ENTRY_STATUS_POLL_LIMIT_MILLISECONDS, ENTRY_STATUS_POLL_MILLISECONDS } from '../src/entries/useConfirmationPolling';
import { PalierUnauthorizedError } from '../src/api/AuthClient';
import { PalierStatusError } from '../src/api/LotsClient';
import { PalierConsentRequiredError } from '../src/api/VehicleClient';
import { FakeEntryClient, spotA1 } from './fakeEntryClient';
import { scan } from './renderScanScreen';
import { visibleText } from './visibleText';

class CaughtErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly caught?: Error }> {
  override state: { readonly caught?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { caught: error };
  }

  override render() {
    return this.state.caught === undefined ? this.props.children : <Text>{`caught: ${this.state.caught.message}`}</Text>;
  }
}

// Holds each status answer until the test releases it, to land an answer after the driver moved on.
class SlowStatusClient extends FakeEntryClient {
  readonly #held: ((response: EntryStatusResponse) => void)[] = [];

  override status(sessionId: string): Promise<EntryStatusResponse> {
    this.statusRequests.push(sessionId);
    return new Promise((resolve) => this.#held.push(resolve));
  }

  confirmHeldAnswers(): void {
    const confirmed: EntryStatusResponse = { sessionId: 'session-1', state: 'ENTRY_CONFIRMED', spot: spotA1, entryConfirmedAt: '2026-10-27T22:02:00.000Z' };
    this.#held.splice(0).forEach((resolve) => resolve(confirmed));
  }
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('ScanScreen, confirming the entry', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it('keeps showing the open barrier while the loop has not closed', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 2);

    expect(client.statusRequests).toEqual(['session-1', 'session-1']);
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
  });

  it('shows "Entrée confirmée" instead of the open barrier once the loop confirms the session, and announces it', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    client.sessionState = 'ENTRY_CONFIRMED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByText('Entrée confirmée')).toBeOnTheScreen();
    expect(screen.queryByText('Barrière ouverte')).not.toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Entrée confirmée');
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeOnTheScreen();
  });

  it('shows "Entry confirmed" on an English device', async () => {
    const client = new FakeEntryClient();
    await scan({ language: 'en', client });
    await screen.findByText('Barrier open');
    client.sessionState = 'ENTRY_CONFIRMED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByText('Entry confirmed')).toBeOnTheScreen();
  });

  it('stops asking once the session is confirmed', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    client.sessionState = 'ENTRY_CONFIRMED';
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 5);

    expect(client.statusRequests).toHaveLength(1);
  });

  it('keeps asking when the API is unreachable', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    client.failingStatusRequests = 1;
    client.sessionState = 'ENTRY_CONFIRMED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByText('Entrée confirmée')).toBeOnTheScreen();
  });

  it('stops asking when the API answers with a status such as 404', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    client.statusCode = 404;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 3);

    expect(client.statusRequests).toHaveLength(1);
  });

  it.each([
    ['401', new PalierUnauthorizedError()],
    ['403', new PalierConsentRequiredError()],
  ])('stops asking when the API answers %s', async (_label, failure) => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    client.statusFailure = failure;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 3);

    expect(client.statusRequests).toHaveLength(1);
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
    expect(screen.queryByText(/Palier ne répond pas/)).not.toBeOnTheScreen();
  });

  it('keeps asking after a 500 and confirms once the API recovers', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    client.statusFailure = new PalierStatusError(500);
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    client.statusFailure = null;
    client.sessionState = 'ENTRY_CONFIRMED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByText('Entrée confirmée')).toBeOnTheScreen();
  });

  it('stops asking and lets the error reach the error boundary on an unexpected failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = await scan({ wrap: (screen) => <CaughtErrorBoundary>{screen}</CaughtErrorBoundary> });
    await screen.findByText('Barrière ouverte');
    client.statusFailure = new TypeError('unexpected');

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 3);

    expect(client.statusRequests).toHaveLength(1);
    expect(screen.getByText('caught: unexpected')).toBeOnTheScreen();
  });

  it('stops asking after "Terminé"', async () => {
    const { client, user } = await scan();
    await user.press(await screen.findByRole('button', { name: 'Terminé' }));

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 5);

    expect(client.statusRequests).toEqual([]);
  });

  it('stops asking after two minutes', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    await advance(ENTRY_STATUS_POLL_LIMIT_MILLISECONDS);
    const askedByTheLimit = client.statusRequests.length;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 5);

    expect(askedByTheLimit).toBe(ENTRY_STATUS_POLL_LIMIT_MILLISECONDS / ENTRY_STATUS_POLL_MILLISECONDS);
    expect(client.statusRequests).toHaveLength(askedByTheLimit);
  });

  it('stops asking when a cancelled session is reported', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    client.sessionState = 'CANCELLED';
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 5);

    expect(client.statusRequests).toHaveLength(1);
  });

  it('replaces the open barrier with the cancellation as an announced alert, and keeps the form usable', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { client, user } = await scan();
    await screen.findByText('Barrière ouverte');
    client.sessionState = 'CANCELLED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    const message = 'Entrée annulée : aucun passage détecté. Aucun montant retenu.';
    expect(screen.getByRole('alert')).toHaveTextContent(message, visibleText);
    expect(announce).toHaveBeenCalledWith('Entrée annulée\u00A0: aucun passage détecté. Aucun montant retenu.');
    expect(screen.queryByText('Barrière ouverte')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Terminé' })).not.toBeOnTheScreen();
    client.sessionState = 'CREATED';
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('reads "Entry cancelled: no passage detected. Nothing charged." on an English device', async () => {
    const client = new FakeEntryClient();
    await scan({ language: 'en', client });
    await screen.findByText('Barrier open');
    client.sessionState = 'CANCELLED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByRole('alert')).toHaveTextContent('Entry cancelled: no passage detected. Nothing charged.');
  });

  it('names the confirmation in the result VoiceOver reads, not the open barrier', async () => {
    const { client } = await scan();
    await screen.findByLabelText(/Barrière ouverte/);
    client.sessionState = 'ENTRY_CONFIRMED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByLabelText(/A-1.*\. Entrée confirmée$/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Barrière ouverte/)).not.toBeOnTheScreen();
  });

  it('ignores a confirmation that answers after "Terminé", and a new scan starts unconfirmed', async () => {
    const client = new SlowStatusClient();
    const { user } = await scan({ client });
    await screen.findByText('Barrière ouverte');
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    expect(client.statusRequests).toHaveLength(1);
    await user.press(screen.getByRole('button', { name: 'Terminé' }));
    await user.type(screen.getByLabelText('Contenu du QR'), 'https://palier.app/q/palier1.00000000-0000-4000-8000-000000000701.signature');
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    await screen.findByText('Barrière ouverte');

    await act(async () => client.confirmHeldAnswers());

    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
    expect(screen.queryByText('Entrée confirmée')).not.toBeOnTheScreen();
  });
});
