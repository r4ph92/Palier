import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';

describe('HomeScreen', () => {
  it('greets the signed-in driver by first name', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)));

    expect(await screen.findByText('Bonjour Julie')).toBeOnTheScreen();
  });

  it('lists Parking Démo with its 10 free spots', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)));

    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
    expect(screen.getByText('10 places libres')).toBeOnTheScreen();
  });

  it('shows 9 free spots after pulling down once A-1 is out of service', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9)));
    await screen.findByText('10 places libres');

    await userEvent.setup().pullToRefresh(screen.getByTestId('lot-list'));

    expect(await screen.findByText('9 places libres')).toBeOnTheScreen();
    expect(screen.queryByText('10 places libres')).not.toBeOnTheScreen();
  });

  it('reloads the counts when Actualiser is pressed', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9)));
    await screen.findByText('10 places libres');

    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByText('9 places libres')).toBeOnTheScreen();
  });

  it('says so when no lot is online', async () => {
    await renderHomeScreen(new FakeLotsClient([]));

    expect(await screen.findByText('Aucun stationnement en ligne.')).toBeOnTheScreen();
  });
});

describe('HomeScreen freshness stamp', () => {
  afterEach(() => jest.useRealTimers());

  it('shows when the counts were last updated, and moves it on each load', async () => {
    jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 9, 27, 13, 25) });
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9)));
    expect(await screen.findByText('Mis à jour à 13 h 25')).toBeOnTheScreen();

    jest.setSystemTime(new Date(2026, 9, 27, 13, 40));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByText('Mis à jour à 13 h 40')).toBeOnTheScreen();
  });

  it('shows no stamp while the API is unreachable', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'));

    await screen.findByText('Impossible de joindre Palier.');

    expect(screen.queryByText(/Mis à jour/)).not.toBeOnTheScreen();
  });

  it('writes the stamp in English on an English device', async () => {
    jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 9, 27, 13, 25) });
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)), 'en');

    expect(await screen.findByText('Updated 1:25 PM')).toBeOnTheScreen();
  });
});

describe('HomeScreen when the API is unreachable', () => {
  it('shows the error and a retry button without any count on open', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'));

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    expect(screen.queryByText(/places? libres?/)).not.toBeOnTheScreen();
  });

  it('announces the error to VoiceOver', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderHomeScreen(new FakeLotsClient('unreachable'));

    await screen.findByText('Impossible de joindre Palier.');

    expect(announce).toHaveBeenCalledWith('Impossible de joindre Palier.');
    announce.mockRestore();
  });

  it('drops the stale counts when a refresh fails', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10), 'unreachable'));
    await screen.findByText('10 places libres');

    await userEvent.setup().pullToRefresh(screen.getByTestId('lot-list'));

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    expect(screen.queryByText(/places? libres?/)).not.toBeOnTheScreen();
  });

  it('loads the lots again when Réessayer is pressed', async () => {
    const client = new FakeLotsClient('unreachable', parkingDemoWith(10));
    await renderHomeScreen(client);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('10 places libres')).toBeOnTheScreen();
    expect(client.callCount).toBe(2);
  });
});

describe('HomeScreen in English', () => {
  it('shows every label in English', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)), 'en');

    expect(await screen.findByText('10 free spots')).toBeOnTheScreen();
    expect(screen.getByText('Parking lots')).toBeOnTheScreen();
    expect(screen.getByText('Hello Julie')).toBeOnTheScreen();
  });

  it('shows the unreachable message in English', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'), 'en');

    expect(await screen.findByText('Can’t reach Palier.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
