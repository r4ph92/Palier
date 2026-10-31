import { render, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { PalierApp } from '../src/PalierApp';
import { FakeAuthClient, julie, MemoryTokenStore } from './fakeAuth';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakePaymentMethodClient } from './fakePaymentMethodClient';
import { FakeVehicleClient } from './fakeVehicleClient';

const mockConfirmSetupIntent = jest.fn();
const mockCardState = { complete: true };

// The card field reports its completeness on mount; the confirmation answer is set per test.
jest.mock('@stripe/stripe-react-native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    CardField: ({ onCardChange }: { onCardChange: (details: { complete: boolean }) => void }) => {
      useEffect(() => onCardChange({ complete: mockCardState.complete }), [onCardChange]);
      return null;
    },
    useConfirmSetupIntent: () => ({ confirmSetupIntent: mockConfirmSetupIntent, loading: false }),
  };
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const JULIE_TOKEN = `${julie.id}-token`;

beforeEach(() => {
  mockCardState.complete = true;
  mockConfirmSetupIntent.mockReset();
});

async function renderSignedInApp(paymentClient: FakePaymentMethodClient, language: SupportedLanguage = 'fr') {
  applyLanguage(language);
  const authClient = new FakeAuthClient();
  authClient.validTokens.add(JULIE_TOKEN);
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <PalierApp
        authClient={authClient}
        tokenStore={new MemoryTokenStore(JULIE_TOKEN)}
        testSignInEnabled={false}
        createLotsClient={() => new FakeLotsClient(parkingDemoWith(10))}
        createPaymentMethodClient={() => paymentClient}
        createVehicleClient={() => new FakeVehicleClient()}
      />
    </SafeAreaProvider>,
  );
}

async function openPaymentMethod() {
  const user = userEvent.setup();
  await user.press(await screen.findByRole('tab', { name: 'Compte' }));
  await user.press(await screen.findByRole('button', { name: 'Moyen de paiement' }));
  return user;
}

describe('payment method on the account', () => {
  it('shows the saved card on Compte as brand and last four digits', async () => {
    await renderSignedInApp(new FakePaymentMethodClient({ brand: 'visa', last4: '4242' }));
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));

    expect(await screen.findByText('Visa •••• 4242')).toBeTruthy();
  });

  it('says no card is saved when the driver has none', async () => {
    await renderSignedInApp(new FakePaymentMethodClient(null));
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));

    expect(await screen.findByText('Aucune carte enregistrée.')).toBeTruthy();
  });

  it('titles the payment method screen "Payment method" when the device is in English', async () => {
    await renderSignedInApp(new FakePaymentMethodClient(null), 'en');
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Account' }));
    await user.press(await screen.findByRole('button', { name: 'Payment method' }));

    expect(await screen.findByRole('header', { name: 'Payment method' })).toBeTruthy();
  });

  it('saves a new card and shows it on Compte, replacing the Visa', async () => {
    const paymentClient = new FakePaymentMethodClient({ brand: 'visa', last4: '4242' });
    mockConfirmSetupIntent.mockResolvedValue({ setupIntent: { paymentMethod: { id: 'pm_mastercard' } }, error: undefined });
    await renderSignedInApp(paymentClient);
    const user = await openPaymentMethod();

    await user.press(await screen.findByRole('button', { name: 'Enregistrer la carte' }));
    await user.press(await screen.findByRole('button', { name: 'Retour' }));

    expect(paymentClient.savedPaymentMethodIds).toEqual(['pm_mastercard']);
    expect(await screen.findByText('Mastercard •••• 4444')).toBeTruthy();
  });

  it('shows the issuer refusal and saves nothing when the card is declined', async () => {
    const paymentClient = new FakePaymentMethodClient(null);
    mockConfirmSetupIntent.mockResolvedValue({ setupIntent: undefined, error: { code: 'Failed' } });
    await renderSignedInApp(paymentClient);
    const user = await openPaymentMethod();

    await user.press(await screen.findByRole('button', { name: 'Enregistrer la carte' }));

    expect(await screen.findByText("Carte refusée par l'émetteur")).toBeTruthy();
    expect(paymentClient.savedPaymentMethodIds).toEqual([]);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Carte refusée par l'émetteur");
  });

  it('confirms the card only once when the button is pressed again while saving', async () => {
    const paymentClient = new FakePaymentMethodClient(null);
    mockConfirmSetupIntent.mockReturnValue(new Promise(() => undefined));
    await renderSignedInApp(paymentClient);
    const user = await openPaymentMethod();
    const save = await screen.findByRole('button', { name: 'Enregistrer la carte' });

    await user.press(save);
    await user.press(save);

    expect(await screen.findByRole('button', { name: 'Enregistrement…' })).toBeTruthy();
    expect(mockConfirmSetupIntent).toHaveBeenCalledTimes(1);
  });

  it('asks for complete card details and does not confirm an incomplete card', async () => {
    const paymentClient = new FakePaymentMethodClient(null);
    mockCardState.complete = false;
    await renderSignedInApp(paymentClient);
    const user = await openPaymentMethod();

    await user.press(await screen.findByRole('button', { name: 'Enregistrer la carte' }));

    expect(await screen.findByText('Complétez les renseignements de la carte.')).toBeTruthy();
    expect(mockConfirmSetupIntent).not.toHaveBeenCalled();
    expect(paymentClient.savedPaymentMethodIds).toEqual([]);
  });
});
