import { act, screen, userEvent } from '@testing-library/react-native';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import { visibleText } from './visibleText';

async function relaunchAsJulie(parkingSession: FakeParkingSessionClient) {
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, clients: () => ({ parkingSession }) });
}

async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('the current session after a relaunch', () => {
  it('opens on the session screen without any tab press', async () => {
    await relaunchAsJulie(new FakeParkingSessionClient(julieAtParkingDemo()));

    expect(await screen.findByText('Montant à ce jour : 9,75 $', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('A-1 · Palier P1 · Allée A', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Session', selected: true })).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('stays on the lots and offers the scanner when Julie has no session', async () => {
    await relaunchAsJulie(new FakeParkingSessionClient(null));
    await screen.findByText('Parking Démo');
    const user = userEvent.setup();

    await user.press(screen.getByRole('tab', { name: 'Scanner' }));

    expect(screen.getByText('Aucune session en cours')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contenu du QR')).toBeOnTheScreen();
  });

  it('leaves Julie on the tab she picked before Palier answered', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    parkingSession.holdsAnswer = true;
    await relaunchAsJulie(parkingSession);
    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: 'Compte' }));

    await act(async () => parkingSession.answer());

    expect(screen.getByRole('tab', { name: 'Compte', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Session' })).toBeOnTheScreen();
  });

  it('shows a loading state in place of the scan form until Palier first answers', async () => {
    const parkingSession = new FakeParkingSessionClient(null);
    parkingSession.holdsAnswer = true;
    await relaunchAsJulie(parkingSession);
    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));

    expect(screen.getByLabelText('Vérification de votre session en cours')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Contenu du QR')).not.toBeOnTheScreen();
    await act(async () => parkingSession.answer());

    expect(screen.getByText('Aucune session en cours')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contenu du QR')).toBeOnTheScreen();
  });

  it('says the session could not be checked while Palier cannot be reached, above the scan form', async () => {
    const parkingSession = new FakeParkingSessionClient(null);
    parkingSession.failure = new PalierUnreachableError('fake');
    await relaunchAsJulie(parkingSession);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));

    expect(screen.getByText('Impossible de vérifier votre session en cours.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toHaveStyle({ minHeight: 44 });
    expect(screen.queryByText('Aucune session en cours')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Contenu du QR')).toBeOnTheScreen();
  });

  it('reads the session again when Julie presses Réessayer once Palier is back', async () => {
    const parkingSession = new FakeParkingSessionClient(null);
    parkingSession.failure = new PalierUnreachableError('fake');
    await relaunchAsJulie(parkingSession);
    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: 'Scanner' }));
    parkingSession.failure = null;
    parkingSession.session = julieAtParkingDemo();

    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Montant à ce jour : 9,75 $', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Impossible de vérifier votre session en cours.')).not.toBeOnTheScreen();
  });
});

describe('the current session while signed in', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 21, 17) }));
  afterEach(() => jest.useRealTimers());

  it('reads the amount again every minute', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Montant à ce jour : 9,75 $', visibleText);
    parkingSession.session = julieAtParkingDemo({ elapsedMinutes: 196, amountCents: 1050 });

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByText('Montant à ce jour : 10,50 $', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('3 h 16', visibleText)).toBeOnTheScreen();
  });

  it('keeps the session and the time of the last read when a refresh misses', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Mis à jour à 21 h 17', visibleText);
    parkingSession.failure = new PalierUnreachableError('fake');

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByText('Montant à ce jour : 9,75 $', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Mis à jour à 21 h 17', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Hors ligne, montant au dernier relevé')).toBeOnTheScreen();
  });

  it('clears the offline mark once a read works again', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Montant à ce jour : 9,75 $', visibleText);
    parkingSession.failure = new PalierUnreachableError('fake');
    await advance(SESSION_REFRESH_MILLISECONDS);
    parkingSession.failure = null;
    parkingSession.session = julieAtParkingDemo({ elapsedMinutes: 196, amountCents: 1050 });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });

    await user.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Montant à ce jour : 10,50 $', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Hors ligne, montant au dernier relevé')).not.toBeOnTheScreen();
  });

  it('switches to the session only once: a session found later relabels the tab without moving Julie', async () => {
    const parkingSession = new FakeParkingSessionClient(null);
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Parking Démo');
    parkingSession.session = julieAtParkingDemo();

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByRole('tab', { name: 'Stationnements', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Session' })).toBeOnTheScreen();
  });

  it('stops reading the session once Julie signs out', async () => {
    const parkingSession = new FakeParkingSessionClient(null);
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Parking Démo');
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    const requestsAtSignOut = parkingSession.requests;

    await advance(SESSION_REFRESH_MILLISECONDS * 2);

    expect(parkingSession.requests).toBe(requestsAtSignOut);
  });
});
