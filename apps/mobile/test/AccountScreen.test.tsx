import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage } from '../src/i18n/i18n';
import { AccountScreen } from '../src/screens/AccountScreen';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

async function renderAccountScreen(onSignOut: () => void, developerLink?: { label: string; onOpen: () => void }) {
  applyLanguage('fr');
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AccountScreen
        cardState={{ status: 'loaded', card: null }}
        onOpenVehicles={() => undefined}
        onOpenPaymentMethod={() => undefined}
        onSignOut={onSignOut}
        {...(developerLink === undefined ? {} : { developerLink })}
      />
    </SafeAreaProvider>,
  );
}

describe('AccountScreen header', () => {
  it('shows the title without an eyebrow', async () => {
    await renderAccountScreen(() => undefined);

    expect(screen.getByRole('header', { name: 'Compte' })).toBeOnTheScreen();
    expect(screen.queryByTestId('header-eyebrow-row')).not.toBeOnTheScreen();
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

describe('AccountScreen developer link', () => {
  it('shows no Développeur button unless a link is given', async () => {
    await renderAccountScreen(() => undefined);

    expect(screen.queryByRole('button', { name: 'Développeur' })).not.toBeOnTheScreen();
  });

  it('opens the developer panel from the Développeur button', async () => {
    const onOpen = jest.fn();
    await renderAccountScreen(() => undefined, { label: 'Développeur', onOpen });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Développeur' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
