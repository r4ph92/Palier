import { getDefaultNormalizer, screen, userEvent } from '@testing-library/react-native';
import { ENTREE_DEMO_QR, FakeEntryClient } from './fakeEntryClient';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';

const visibleText = { normalizer: (text: string) => getDefaultNormalizer()(text.replaceAll('⁠', '')) };

async function scanAtEntreeDemo(parkingSession: FakeParkingSessionClient) {
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ entry: new FakeEntryClient(), parkingSession }) });
  const user = userEvent.setup();
  await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
  await screen.findByText('Aucune session en cours');
  parkingSession.session = julieAtParkingDemo({ state: 'CREATED', elapsedMinutes: 0, amountCents: 75 });
  await user.type(screen.getByLabelText('Contenu du QR'), ENTREE_DEMO_QR);
  await user.press(screen.getByRole('button', { name: 'Scanner' }));
  return user;
}

describe('the scan tab once the barrier opens', () => {
  it('keeps the entered spot on screen while the session read finds the new session', async () => {
    const parkingSession = new FakeParkingSessionClient(null);
    await scanAtEntreeDemo(parkingSession);

    expect(await screen.findByRole('tab', { name: 'Session', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Barrière ouverte')).toBeOnTheScreen();
    expect(screen.getByText('Votre place : A-1 · Palier P1 · Allée A', visibleText)).toBeOnTheScreen();
    expect(parkingSession.requests).toBeGreaterThanOrEqual(2);
  });

  it('shows the session once Julie presses Terminé', async () => {
    const parkingSession = new FakeParkingSessionClient(null);
    const user = await scanAtEntreeDemo(parkingSession);
    await screen.findByRole('tab', { name: 'Session' });

    await user.press(screen.getByRole('button', { name: 'Terminé' }));

    expect(await screen.findByText('Montant à ce jour : 0,75 $', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Entrée en attente de confirmation')).toBeOnTheScreen();
  });
});
