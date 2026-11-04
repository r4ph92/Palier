import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ENTRY_STATUS_POLL_LIMIT_MILLISECONDS, ENTRY_STATUS_POLL_MILLISECONDS } from '../src/entries/useConfirmationPolling';
import { FakeEntryClient } from './fakeEntryClient';
import { scan } from './renderScanScreen';

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

  it('ignores a failed answer and asks again on the next tick', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    client.failingStatusRequests = 1;
    client.sessionState = 'ENTRY_CONFIRMED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByText('Entrée confirmée')).toBeOnTheScreen();
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
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
  });
});
