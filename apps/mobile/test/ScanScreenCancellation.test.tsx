import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ENTRY_STATUS_POLL_MILLISECONDS } from '../src/entries/useConfirmationPolling';
import { FakeEntryClient } from './fakeEntryClient';
import { scan } from './renderScanScreen';
import { visibleText } from './visibleText';

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('ScanScreen, when Palier cancels the entry nobody drove through', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

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
});
