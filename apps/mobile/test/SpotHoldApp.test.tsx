import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

jest.mock('@stripe/stripe-react-native', () => ({
  CardField: () => null,
  useConfirmSetupIntent: () => ({ confirmSetupIntent: jest.fn(), loading: false }),
}));

describe('a spot hold across the app', () => {
  it('shows the hold Julie took before relaunching, without moving VoiceOver to it', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ spotHold: spotHoldClient }) });

    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Garantir une place/ })).not.toBeOnTheScreen();
  });

  it('keeps the hold on screen after a tab change, with focus moved only when it was taken', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const spotHoldClient = new FakeSpotHoldClient();
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ spotHold: spotHoldClient }) });
    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: 'Garantir une place 15 min à Parking Démo' }));
    await screen.findByTestId('spot-hold-banner');
    focus.mockClear();

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));

    expect(await screen.findByTestId('spot-hold-banner')).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();
  });

  it('shows a refusal again after a tab change without announcing it twice', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'NO_SUITABLE_SPOT';
    await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ spotHold: spotHoldClient }) });
    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: 'Garantir une place 15 min à Parking Démo' }));
    await screen.findByText('Aucune place disponible');
    announce.mockClear();

    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    await screen.findByRole('button', { name: 'Garantir une place 15 min à Parking Démo' });

    expect(announce).not.toHaveBeenCalledWith('Aucune place disponible');
  });
});
