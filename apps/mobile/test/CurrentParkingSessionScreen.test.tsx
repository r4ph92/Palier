import type { CurrentParkingSession } from '@palier/shared-types';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { CurrentParkingSessionScreen } from '../src/screens/CurrentParkingSessionScreen';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { IPHONE_MINI_METRICS } from './renderPalierApp';
import { visibleText } from './visibleText';

const readAt = new Date(2026, 10, 4, 21, 17);

async function showSession(session: CurrentParkingSession = julieAtParkingDemo(), language: SupportedLanguage = 'fr', isStale = false) {
  applyLanguage(language);
  const onRetry = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={IPHONE_MINI_METRICS}>
      <CurrentParkingSessionScreen reading={{ status: 'current', session, readAt, isStale }} onRetry={onRetry} />
    </SafeAreaProvider>,
  );
  return onRetry;
}

describe('CurrentParkingSessionScreen', () => {
  it('shows Julie her spot, entry, 3 h 15, the amount so far and the cap in French', async () => {
    await showSession();

    expect(screen.getByText('Parking Démo')).toBeOnTheScreen();
    expect(screen.getByText('A-1 · Palier P1 · Allée A', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Entrée 18 h 02', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('3 h 15', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Montant à ce jour : 9,75 $', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Plafond : 25,00 $', visibleText)).toBeOnTheScreen();
  });

  it('reads "Amount so far: $9.75" and "Entered 6:02 PM" on an English device', async () => {
    await showSession(julieAtParkingDemo(), 'en');

    expect(screen.getByText('Amount so far: $9.75', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Entered 6:02 PM', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('3 h 15 min', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Daily cap: $25.00', visibleText)).toBeOnTheScreen();
  });

  it('shows the amount as the largest figure, in mono with tabular digits', async () => {
    await showSession();

    expect(screen.getByText('9,75 $', visibleText)).toHaveStyle({ fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 30, fontVariant: ['tabular-nums'] });
    expect(screen.getByText('3 h 15', visibleText)).toHaveStyle({ fontFamily: 'IBMPlexMono_500Medium', fontVariant: ['tabular-nums'] });
  });

  it('says the entry is confirmed, or still waiting for the loop', async () => {
    await showSession(julieAtParkingDemo({ state: 'CREATED' }));

    expect(screen.getByText('Entrée en attente de confirmation')).toBeOnTheScreen();
    expect(screen.queryByText('Entrée confirmée')).not.toBeOnTheScreen();
  });

  it('gives VoiceOver the spot and the entry state as one stop', async () => {
    await showSession();

    expect(screen.getByLabelText('A-1 · Palier P1 · Allée A. Entrée confirmée', visibleText)).toBeOnTheScreen();
  });

  it('tells when Palier was last heard from', async () => {
    await showSession();

    expect(screen.getByText('Mis à jour à 21 h 17', visibleText)).toBeOnTheScreen();
  });

  it('says nothing about the network while the last read worked', async () => {
    await showSession();

    expect(screen.queryByText('Hors ligne, montant au dernier relevé')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeOnTheScreen();
  });

  it('marks the amount as the last read after a missed refresh, and reads again on Réessayer', async () => {
    const onRetry = await showSession(julieAtParkingDemo(), 'fr', true);

    expect(screen.getByText('Hors ligne, montant au dernier relevé')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('says it is offline in English too', async () => {
    await showSession(julieAtParkingDemo(), 'en', true);

    expect(screen.getByText('Offline, amount as of last check')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
