import { screen } from '@testing-library/react-native';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { scan } from './renderScanScreen';

describe('ScanScreen refusals', () => {
  const refusals = [
    ['QR_NOT_RECOGNIZED', 'QR non reconnu', 'QR not recognized'],
    ['NOT_AN_ENTRY_GATE', 'Ce QR n’est pas une borne d’entrée', 'This QR is not an entry terminal'],
    ['LOT_NOT_IN_SERVICE', 'Ce parking n’est pas en service', 'This lot is not in service'],
    ['GATE_UNAVAILABLE', 'Cette borne n’est pas disponible', 'This terminal is not available'],
    ['GATE_SILENT', 'Borne hors service — entrée impossible', 'Terminal out of service — entry not possible'],
    ['PREREQUISITES_MISSING', 'Ajoutez une plaque et une carte avant d’entrer', 'Add a plate and a card before entering'],
    ['OPERATOR_NOT_PAYABLE', 'Ce parking n’accepte pas les paiements pour le moment', 'This lot cannot take payments right now'],
    ['LOT_FULL', 'Complet — la barrière reste fermée', 'Full — the barrier stays closed'],
    ['NO_SUITABLE_SPOT', 'Aucune place adaptée à votre véhicule — la barrière reste fermée', 'No suitable spot for your vehicle — the barrier stays closed'],
    ['ALREADY_INSIDE', 'Vous avez déjà une entrée en cours', 'You already have an entry in progress'],
    ['CARD_DECLINED', 'Carte refusée', 'Card declined'],
    ['PAYMENTS_UNAVAILABLE', 'Paiement momentanément indisponible — la barrière reste fermée', 'Payment temporarily unavailable — the barrier stays closed'],
    ['TOO_MANY_ENTRIES', 'Trop de tentatives, réessayez dans quelques minutes', 'Too many attempts, try again in a few minutes'],
  ] as const;
  const cases = refusals.flatMap(([code, french, english]) => [
    [code, 'fr', french],
    [code, 'en', english],
  ] as const);

  it.each(cases)('reads %s in %s as "%s", without a spot', async (code, language, message) => {
    const client = new FakeEntryClient();
    client.nextRejection = code;
    await scan({ client, language });

    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.queryByText(/A-1/)).not.toBeOnTheScreen();
  });

  it('keeps what was pasted, so a wrong QR can be corrected', async () => {
    const client = new FakeEntryClient();
    client.nextRejection = 'QR_NOT_RECOGNIZED';
    await scan({ client });

    await screen.findByText('QR non reconnu');

    expect(screen.getByLabelText('Contenu du QR')).toHaveDisplayValue(ENTREE_DEMO_QR);
  });

  it('offers a button to add a plate and one to add a card when either is missing', async () => {
    const client = new FakeEntryClient();
    client.nextRejection = 'PREREQUISITES_MISSING';
    const onAddPlate = jest.fn();
    const onAddCard = jest.fn();
    const { user } = await scan({ client, onAddPlate, onAddCard });

    await user.press(await screen.findByRole('button', { name: 'Ajouter une plaque' }));
    await user.press(screen.getByRole('button', { name: 'Ajouter une carte' }));

    expect(onAddPlate).toHaveBeenCalledTimes(1);
    expect(onAddCard).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['fr', 'Votre carte a refusé l’autorisation de 25,00\u00A0$. Mettez à jour votre moyen de paiement.'],
    ['en', 'Your card declined the $25.00 authorization. Update your payment method.'],
  ] as const)('names the refused amount when the card is declined, in %s', async (language, message) => {
    const client = new FakeEntryClient();
    client.nextRejection = 'CARD_DECLINED';
    client.nextRejectionCents = 2500;
    await scan({ client, language });

    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.queryByText(/A-1/)).not.toBeOnTheScreen();
  });

  it('opens the payment method from a declined card', async () => {
    const client = new FakeEntryClient();
    client.nextRejection = 'CARD_DECLINED';
    client.nextRejectionCents = 2500;
    const onAddCard = jest.fn();
    const { user } = await scan({ client, onAddCard });

    await user.press(await screen.findByRole('button', { name: 'Moyen de paiement' }));

    expect(onAddCard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Ajouter une plaque' })).not.toBeOnTheScreen();
  });

  it('shows no prerequisite buttons for another refusal', async () => {
    const client = new FakeEntryClient();
    client.nextRejection = 'NOT_AN_ENTRY_GATE';
    await scan({ client });

    await screen.findByText('Ce QR n’est pas une borne d’entrée');

    expect(screen.queryByRole('button', { name: 'Ajouter une plaque' })).not.toBeOnTheScreen();
  });
});

describe('ScanScreen when Palier cannot answer', () => {
  it('says it cannot reach Palier when the network fails, asks to check the connection, and retries the same QR', async () => {
    const client = new FakeEntryClient();
    client.isReachable = false;
    const { user } = await scan({ client });

    expect(await screen.findByText('Impossible de joindre Palier')).toBeOnTheScreen();
    expect(screen.getByText('Vérifiez votre connexion, puis réessayez.')).toBeOnTheScreen();
    client.isReachable = true;
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
  });

  it.each([
    ['the API fails (500)', (client: FakeEntryClient) => (client.nextStatus = 500)],
    ['the API answers a code the app does not know', (client: FakeEntryClient) => (client.nextRejection = 'SOMETHING_NEW')],
  ])('says Palier is not responding when %s, without blaming the connection, and retries the same QR', async (_case, breakClient) => {
    const client = new FakeEntryClient();
    breakClient(client);
    const { user } = await scan({ client });

    expect(await screen.findByText('Palier ne répond pas, réessayez dans un instant')).toBeOnTheScreen();
    expect(screen.queryByText('Vérifiez votre connexion, puis réessayez.')).not.toBeOnTheScreen();
    Object.assign(client, { nextStatus: null, nextRejection: null });
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
    expect(client.scanned).toEqual([ENTREE_DEMO_QR, ENTREE_DEMO_QR]);
  });
});
