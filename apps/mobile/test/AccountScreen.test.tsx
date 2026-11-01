import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { AccountScreen } from '../src/screens/AccountScreen';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

async function renderAccountScreen(onSignOut: () => void) {
  applyLanguage('fr');
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AccountScreen
        cardState={{ status: 'loaded', card: null }}
        onOpenVehicles={() => undefined}
        onOpenPaymentMethod={() => undefined}
        onSignOut={onSignOut}
      />
    </SafeAreaProvider>,
  );
}

describe('AccountScreen header', () => {
  it('reads "Compte" as its eyebrow', async () => {
    await renderAccountScreen(() => undefined);

    expect(screen.getByTestId('header-eyebrow-row')).toHaveTextContent('Compte');
  });
});

describe('AccountScreen sign-out', () => {
  it('reads "Déconnexion…" and stays busy until the sign-out finishes', async () => {
    const onSignOut = jest.fn();
    await renderAccountScreen(onSignOut);
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    await user.press(screen.getByRole('button', { name: 'Déconnexion…' }));

    expect(screen.getByRole('button', { name: 'Déconnexion…' })).toBeDisabled();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
