import { act, screen, userEvent } from '@testing-library/react-native';
import { PalierStatusError } from '../src/api/LotsClient';
import { SESSION_REFRESH_MILLISECONDS } from '../src/parkingSessions/useCurrentParkingSession';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { renderPalierApp, signedInJulie } from './renderPalierApp';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { visibleText } from './visibleText';

async function relaunchAsJulie(parkingSession: FakeParkingSessionClient, language: SupportedLanguage = 'fr') {
  await renderPalierApp({ ...signedInJulie(), testSignInEnabled: false, language, clients: () => ({ parkingSession }) });
}

async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('the current session over its life', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 21, 17) }));
  afterEach(() => jest.useRealTimers());

  it('reads the session once at relaunch, not again on each render or tab change', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Montant à ce jour : 9,75 $', visibleText);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });

    await user.press(screen.getByRole('tab', { name: 'Stationnements' }));
    await user.press(screen.getByRole('tab', { name: 'Compte' }));
    await user.press(screen.getByRole('tab', { name: 'Session' }));

    expect(parkingSession.requests).toBe(1);
  });

  it('goes back to the scanner and its empty line once the session is gone', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Montant à ce jour : 9,75 $', visibleText);
    parkingSession.session = null;

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByRole('tab', { name: 'Scanner', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Aucune session en cours')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contenu du QR')).toBeOnTheScreen();
  });

  it('keeps the session on screen when a refresh answers a server error', async () => {
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    await relaunchAsJulie(parkingSession);
    await screen.findByText('Montant à ce jour : 9,75 $', visibleText);
    parkingSession.failure = new PalierStatusError(500);

    await advance(SESSION_REFRESH_MILLISECONDS);

    expect(screen.getByText('Montant à ce jour : 9,75 $', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('A-1 · Palier P1 · Allée A', visibleText)).toBeOnTheScreen();
  });

  it('opens on the session in English after a relaunch, with the amount, cap and entry time', async () => {
    await relaunchAsJulie(new FakeParkingSessionClient(julieAtParkingDemo()), 'en');

    expect(await screen.findByText('Amount so far: $9.75', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Entered 6:02 PM', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Daily cap: $25.00', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Session', selected: true })).toBeOnTheScreen();
  });
});
