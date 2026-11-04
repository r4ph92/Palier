import { act, screen, userEvent } from '@testing-library/react-native';
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
  fr: { scan: 'Scanner', lots: 'Stationnements', qr: 'Contenu du QR', barrierOpen: 'Barrière ouverte', cancelled: 'Entrée annulée : aucun passage détecté. Aucun montant retenu.' },
  en: { scan: 'Scan', lots: 'Parking lots', qr: 'QR content', barrierOpen: 'Barrier open', cancelled: 'Entry cancelled: no passage detected. Nothing charged.' },
} as const;

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

async function julieOpensEntreeDemo(language: SupportedLanguage) {
  const entryClient = new FakeEntryClient();
  const parkingSession = new FakeParkingSessionClient(null);
  await renderPalierApp({ ...signedInJulie(), language, testSignInEnabled: false, clients: () => ({ entry: entryClient, parkingSession }) });
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
  const text = TEXT[language];
  await user.press(await screen.findByRole('tab', { name: text.scan }));
  parkingSession.session = julieAtParkingDemo({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
  await user.type(screen.getByLabelText(text.qr), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: text.scan }));
  await screen.findByText(text.barrierOpen);
  return { entryClient, parkingSession, user, text };
}

// AC1 asks Julie to see 10 free spots, on the Stationnements tab: she leaves the open barrier without pressing Terminé.
describe('an entry cancelled while the driver looks at another tab, without pressing Terminé', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it.each(['fr', 'en'] as const)('still tells the driver the entry was cancelled when she comes back to the scan tab (%s)', async (language) => {
    const { entryClient, parkingSession, user, text } = await julieOpensEntreeDemo(language);
    await user.press(screen.getByRole('tab', { name: text.lots }));
    entryClient.sessionState = 'CANCELLED';
    parkingSession.session = null;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 3);
    await user.press(screen.getByRole('tab', { name: /Session|Scanner|Scan/ }));
    await advance(60_000);

    expect(await screen.findByText(text.cancelled, visibleText)).toBeOnTheScreen();
  });

  it('still follows the entry after a round trip to another tab, and shows its later cancellation in place', async () => {
    const { entryClient, parkingSession, user, text } = await julieOpensEntreeDemo('fr');
    await user.press(screen.getByRole('tab', { name: text.lots }));
    await user.press(screen.getByRole('tab', { name: 'Session' }));
    entryClient.sessionState = 'CANCELLED';
    parkingSession.session = null;

    await advance(ENTRY_STATUS_POLL_MILLISECONDS * 3);

    expect(await screen.findByText(text.cancelled, visibleText)).toBeOnTheScreen();
  });
});
