import { act, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { ENTRY_STATUS_POLL_MILLISECONDS } from '../src/entries/useConfirmationPolling';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { visibleText } from './visibleText';

jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

const TEXT = {
  fr: {
    scan: 'Scanner',
    session: 'Session',
    lots: 'Stationnements',
    done: 'Terminé',
    barrierOpen: 'Barrière ouverte',
    pending: 'Entrée en attente de confirmation',
    cancelled: 'Entrée annulée : aucun passage détecté. Aucun montant retenu.',
  },
  en: {
    scan: 'Scan',
    session: 'Session',
    lots: 'Parking lots',
    done: 'Done',
    barrierOpen: 'Barrier open',
    pending: 'Entry awaiting confirmation',
    cancelled: 'Entry cancelled: no passage detected. Nothing charged.',
  },
} as const;

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

// Julie scans Entrée Démo: the session read then finds her CREATED session, until Palier cancels it.
async function julieEntersParkingDemo(language: SupportedLanguage) {
  const entryClient = new FakeEntryClient();
  const parkingSession = new FakeParkingSessionClient(null);
  await renderPalierApp({ ...signedInJulie(), language, testSignInEnabled: false, clients: () => ({ entry: entryClient, parkingSession }) });
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
  const text = TEXT[language];
  await user.press(await screen.findByRole('tab', { name: text.scan }));
  parkingSession.session = julieAtParkingDemo({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
  await user.type(screen.getByLabelText(language === 'fr' ? 'Contenu du QR' : 'QR content'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: text.scan }));
  await screen.findByText(text.barrierOpen);
  expect(await screen.findByRole('tab', { name: text.session })).toBeOnTheScreen();
  return { entryClient, parkingSession, user, text };
}

describe('the scan tab when Palier cancels an entry nobody drove through', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it.each(['fr', 'en'] as const)('shows the cancellation in place, announces it and names the tab Scanner again (%s)', async (language) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { entryClient, parkingSession, text } = await julieEntersParkingDemo(language);
    entryClient.sessionState = 'CANCELLED';
    parkingSession.session = null;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);

    expect(await screen.findByText(text.cancelled, visibleText)).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/annulée|cancelled/));
    expect(await screen.findByRole('tab', { name: text.scan, selected: true })).toBeOnTheScreen();
  });

  it.each(['fr', 'en'] as const)('shows a cancellation that comes after Terminé above the form, across a tab switch (%s)', async (language) => {
    const { entryClient, parkingSession, user, text } = await julieEntersParkingDemo(language);
    await user.press(screen.getByRole('button', { name: text.done }));
    expect(await screen.findByText(text.pending)).toBeOnTheScreen();
    await user.press(screen.getByRole('tab', { name: text.lots }));
    entryClient.sessionState = 'CANCELLED';
    parkingSession.session = null;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    await user.press(screen.getByRole('tab', { name: text.scan }));

    expect(await screen.findByText(text.cancelled, visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: text.scan, selected: true })).toBeOnTheScreen();
  });

  it('clears the cancellation shown after Terminé on the next scan', async () => {
    const { entryClient, parkingSession, user, text } = await julieEntersParkingDemo('fr');
    await user.press(screen.getByRole('button', { name: text.done }));
    entryClient.sessionState = 'CANCELLED';
    parkingSession.session = null;
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    await screen.findByText(text.cancelled, visibleText);
    entryClient.sessionState = 'ENTRY_CONFIRMED';

    await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
    await user.press(screen.getByRole('button', { name: text.scan }));
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    await screen.findByText('Entrée confirmée');
    await user.press(screen.getByRole('button', { name: text.done }));

    expect(await screen.findByLabelText('Contenu du QR')).toBeOnTheScreen();
    expect(screen.queryByText(text.cancelled, visibleText)).not.toBeOnTheScreen();
  });

  it('stops following the entry once the loop confirms it after Terminé', async () => {
    const { entryClient, user, text } = await julieEntersParkingDemo('fr');
    await user.press(screen.getByRole('button', { name: text.done }));
    entryClient.sessionState = 'ENTRY_CONFIRMED';
    await advance(ENTRY_STATUS_POLL_MILLISECONDS);
    const asked = entryClient.statusRequests.length;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 5);

    expect(entryClient.statusRequests).toHaveLength(asked);
    expect(screen.queryByText(text.cancelled, visibleText)).not.toBeOnTheScreen();
  });
});
