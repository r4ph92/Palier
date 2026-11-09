import { screen, userEvent } from '@testing-library/react-native';
import { julieReceipt, FakeReceiptClient } from './fakeReceiptClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

const monday = julieReceipt({
  sessionId: 'session-mon',
  lotName: 'Stationnement Lavoie',
  enteredAt: new Date(2026, 10, 2, 9, 0).toISOString(),
  exitedAt: new Date(2026, 10, 2, 10, 0).toISOString(),
  durationMinutes: 60,
  increments: 4,
  totalCents: 300,
  cardLast4: '1111',
});
const tuesday = julieReceipt({
  sessionId: 'session-tue',
  enteredAt: new Date(2026, 10, 3, 14, 0).toISOString(),
  exitedAt: new Date(2026, 10, 3, 17, 15).toISOString(),
});
const wednesday = julieReceipt({
  sessionId: 'session-wed',
  enteredAt: new Date(2026, 10, 4, 8, 0).toISOString(),
  exitedAt: new Date(2026, 10, 4, 17, 0).toISOString(),
  durationMinutes: 540,
  increments: 36,
  totalCents: 2500,
  capped: true,
  cardLast4: null,
});

// The app keeps figures and units together with no-break spaces; a plain space in the expected text matches either.
function exactly(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/ /g, '[\\s\u00A0\u202F]')}$`);
}

async function openReceipts(receipts: FakeReceiptClient, language: 'fr' | 'en' = 'fr') {
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, clients: () => ({ receipts }) });
  const user = userEvent.setup();
  await user.press(await screen.findByRole('tab', { name: language === 'fr' ? 'Compte' : 'Account' }));
  await user.press(screen.getByRole('button', { name: language === 'fr' ? 'Reçus' : 'Receipts' }));
  return user;
}

describe('the receipts page of the account tab', () => {
  it('lists the 3 receipts newest first, each with lot, date, duration and total', async () => {
    await openReceipts(new FakeReceiptClient([wednesday, tuesday, monday]));

    const rows = await screen.findAllByTestId(/^receipt-row-/);

    expect(rows.map((row) => row.props.testID)).toEqual(['receipt-row-session-wed', 'receipt-row-session-tue', 'receipt-row-session-mon']);
    expect(screen.getByRole('button', { name: exactly('Stationnement Lavoie, 2 nov. 2026 · 10 h 00, Durée 1 h 00, Total 3,00 $') })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: exactly('Parking Démo, 3 nov. 2026 · 17 h 15, Durée 3 h 15, Total 9,75 $') })).toBeOnTheScreen();
  });

  it('opens one receipt with entry and exit times, price per increment, increments, total and card', async () => {
    const user = await openReceipts(new FakeReceiptClient([wednesday, tuesday, monday]));

    await user.press(await screen.findByTestId('receipt-row-session-tue'));

    expect(await screen.findByRole('header', { name: exactly('Parking Démo') })).toBeOnTheScreen();
    expect(screen.getByLabelText(exactly('Entrée, 3 nov. 2026 · 14 h 00'))).toBeOnTheScreen();
    expect(screen.getByLabelText(exactly('Sortie, 3 nov. 2026 · 17 h 15'))).toBeOnTheScreen();
    expect(screen.getByLabelText(exactly('Tarif par tranche, 0,75 $'))).toBeOnTheScreen();
    expect(screen.getByLabelText(exactly('Tranches, 13'))).toBeOnTheScreen();
    expect(screen.getByLabelText(exactly('Total, 9,75 $'))).toBeOnTheScreen();
    expect(screen.getByLabelText(exactly('Carte, Carte se terminant par 4242'))).toBeOnTheScreen();
  });

  it('names the daily cap on a capped receipt and leaves the card out when none was recorded', async () => {
    const user = await openReceipts(new FakeReceiptClient([wednesday]));

    await user.press(await screen.findByTestId('receipt-row-session-wed'));

    expect(await screen.findByLabelText(exactly('Tranches, 36 · Plafond journalier'))).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Carte/)).not.toBeOnTheScreen();
  });

  it('goes back from a receipt to the list, and from the list to Compte', async () => {
    const user = await openReceipts(new FakeReceiptClient([tuesday]));

    await user.press(await screen.findByTestId('receipt-row-session-tue'));
    await user.press(await screen.findByRole('button', { name: 'Retour' }));
    expect(await screen.findByTestId('receipt-row-session-tue')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByRole('button', { name: 'Reçus' })).toBeOnTheScreen();
  });

  it('says there is no receipt yet when the list is empty', async () => {
    await openReceipts(new FakeReceiptClient());

    expect(await screen.findByText('Aucun reçu pour le moment.')).toBeOnTheScreen();
  });

  it('offers a retry when Palier is unreachable, then shows the receipts', async () => {
    const receipts = new FakeReceiptClient([tuesday]);
    receipts.isReachable = false;
    const user = await openReceipts(receipts);

    await user.press(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();

    receipts.isReachable = true;
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByTestId('receipt-row-session-tue')).toBeOnTheScreen();
  });

  it('reads "Receipts" and English dates when the device language is English', async () => {
    const user = await openReceipts(new FakeReceiptClient([tuesday]), 'en');

    expect(await screen.findByRole('header', { name: 'Receipts' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: exactly('Parking Démo, Nov 3, 2026 · 5:15 PM, Duration 3 h 15, Total $9.75') })).toBeOnTheScreen();

    await user.press(screen.getByTestId('receipt-row-session-tue'));
    expect(await screen.findByLabelText(exactly('Card, Card ending in 4242'))).toBeOnTheScreen();
  });
});
