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

  it('replaces the open barrier with the cancellation as an alert VoiceOver moves to, and keeps the form usable', async () => {
    const sendAccessibilityEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const { client, user } = await scan();
    await screen.findByText('Barrière ouverte');
    client.sessionState = 'CANCELLED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    const message = 'Entrée annulée : aucun passage détecté. Aucun montant retenu.';
    expect(screen.getByRole('alert')).toHaveTextContent(message, visibleText);
    expect(sendAccessibilityEvent).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(screen.queryByText('Barrière ouverte')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Terminé' })).not.toBeOnTheScreen();
    client.sessionState = 'CREATED';
    await user.press(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('reads "Entry cancelled: no passage detected. Nothing charged." on an English device, and moves focus to it', async () => {
    const sendAccessibilityEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const client = new FakeEntryClient();
    await scan({ language: 'en', client });
    await screen.findByText('Barrier open');
    client.sessionState = 'CANCELLED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(screen.getByRole('alert')).toHaveTextContent('Entry cancelled: no passage detected. Nothing charged.');
    expect(sendAccessibilityEvent).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  it('moves VoiceOver to the cancellation when it replaces the open barrier', async () => {
    const { client } = await scan();
    await screen.findByText('Barrière ouverte');
    const sendAccessibilityEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    client.sessionState = 'CANCELLED';

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    const onTheAlert = expect.objectContaining({ props: expect.objectContaining({ accessibilityRole: 'alert' }) });
    expect(sendAccessibilityEvent).toHaveBeenLastCalledWith(onTheAlert, 'focus');
  });
});
