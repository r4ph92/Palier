import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { ScanScreen, spotLabel } from '../src/screens/ScanScreen';
import { ENTREE_DEMO_QR, FakeEntryClient, spotA1 } from './fakeEntryClient';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

interface Scan {
  readonly client?: FakeEntryClient;
  readonly language?: SupportedLanguage;
  readonly onAddPlate?: () => void;
  readonly onAddCard?: () => void;
}

async function scan({ client = new FakeEntryClient(), language = 'fr', onAddPlate = jest.fn(), onAddCard = jest.fn() }: Scan = {}) {
  applyLanguage(language);
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ScanScreen client={client} onAddPlate={onAddPlate} onAddCard={onAddCard} />
    </SafeAreaProvider>,
  );
  const user = userEvent.setup();
  const labels = language === 'fr' ? { field: 'Contenu du QR', submit: 'Scanner' } : { field: 'QR content', submit: 'Scan' };
  await user.type(screen.getByLabelText(labels.field), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: labels.submit }));
  return { client, user };
}

describe('ScanScreen, entering Parking Démo', () => {
  it('shows Julie her spot and the open barrier in French', async () => {
    const { client } = await scan();

    expect(await screen.findByText('Votre place : A-1 · Palier P1 · Allée A')).toBeOnTheScreen();
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
    expect(client.scanned).toEqual([ENTREE_DEMO_QR]);
  });

  it('shows the spot and the open barrier in English', async () => {
    await scan({ language: 'en' });

    expect(await screen.findByText('Your spot: A-1 · Level P1 · Aisle A')).toBeOnTheScreen();
    expect(screen.getByText('Barrier open')).toBeOnTheScreen();
  });

  it('keeps the French colon on the line of the word before it', () => {
    applyLanguage('fr');

    expect(spotLabel(spotA1)).toBe('Votre place\u00A0: A-1 · Palier P1 · Allée A');
  });

  it('goes back to an empty form with "Terminé"', async () => {
    const { user } = await scan();

    await user.press(await screen.findByRole('button', { name: 'Terminé' }));

    expect(screen.getByLabelText('Contenu du QR')).toHaveDisplayValue('');
    expect(screen.queryByText('Barrière ouverte')).not.toBeOnTheScreen();
  });

  it('shows the button busy while Palier checks the QR', async () => {
    const client = new FakeEntryClient();
    client.holdsAnswer = true;
    await scan({ client });

    expect(screen.getByRole('button', { name: 'Vérification…' })).toBeDisabled();

    client.answer();
    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
  });
});

describe('ScanScreen refusals', () => {
  const refusals = [
    ['QR_NOT_RECOGNIZED', 'QR non reconnu', 'QR not recognized'],
    ['NOT_AN_ENTRY_GATE', 'Ce QR n’est pas une borne d’entrée', 'This QR is not an entry terminal'],
    ['LOT_NOT_IN_SERVICE', 'Ce parking n’est pas en service', 'This lot is not in service'],
    ['PREREQUISITES_MISSING', 'Ajoutez une plaque et une carte avant d’entrer', 'Add a plate and a card before entering'],
    ['OPERATOR_NOT_PAYABLE', 'Ce parking n’accepte pas les paiements pour le moment', 'This lot cannot take payments right now'],
    ['LOT_FULL', 'Ce parking est complet', 'This lot is full'],
    ['ALREADY_INSIDE', 'Vous avez déjà une entrée en cours', 'You already have an entry in progress'],
    ['CARD_DECLINED', 'Carte refusée', 'Card declined'],
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

  it('shows no prerequisite buttons for another refusal', async () => {
    const client = new FakeEntryClient();
    client.nextRejection = 'NOT_AN_ENTRY_GATE';
    await scan({ client });

    await screen.findByText('Ce QR n’est pas une borne d’entrée');

    expect(screen.queryByRole('button', { name: 'Ajouter une plaque' })).not.toBeOnTheScreen();
  });
});

describe('ScanScreen when Palier cannot answer', () => {
  it.each([
    ['the network fails', (client: FakeEntryClient) => (client.isReachable = false)],
    ['Stripe or the gate is unavailable (503)', (client: FakeEntryClient) => (client.nextStatus = 503)],
    ['the API refuses the request shape', (client: FakeEntryClient) => (client.nextRejection = 'FST_ERR_VALIDATION')],
  ])('says it cannot reach Palier when %s, and retries the same QR', async (_case, breakClient) => {
    const client = new FakeEntryClient();
    breakClient(client);
    const { user } = await scan({ client });

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    Object.assign(client, { isReachable: true, nextStatus: null, nextRejection: null });
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Barrière ouverte')).toBeOnTheScreen();
    expect(client.scanned).toEqual([ENTREE_DEMO_QR, ENTREE_DEMO_QR]);
  });
});
