import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { DeveloperEntry } from '../src/screens/DeveloperEntry';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

const developerEntry: DeveloperEntry = {
  label: 'Développeur',
  Panel: ({ onBack }) => <Text onPress={onBack}>Panneau de test</Text>,
};

async function renderSignedInApp(entry: DeveloperEntry | undefined) {
  return renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, developerEntry: entry });
}

describe('Account developer entry', () => {
  it('opens the developer panel from Compte and returns to the account page', async () => {
    await renderSignedInApp(developerEntry);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));
    await user.press(await screen.findByRole('button', { name: 'Développeur' }));
    expect(screen.getByText('Panneau de test')).toBeOnTheScreen();
    await user.press(screen.getByText('Panneau de test'));

    expect(await screen.findByRole('button', { name: 'Développeur' })).toBeOnTheScreen();
  });

  it('shows no Développeur entry without developer tools', async () => {
    await renderSignedInApp(undefined);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Compte' }));

    expect(await screen.findByRole('button', { name: 'Mes véhicules' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Développeur' })).not.toBeOnTheScreen();
  });
});
