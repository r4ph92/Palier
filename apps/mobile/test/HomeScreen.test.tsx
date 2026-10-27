import { screen, userEvent } from '@testing-library/react-native';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';

describe('HomeScreen', () => {
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

  it('lists only the lots the API returns as online', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(10)));

    await screen.findByText('Parking Démo');

    expect(screen.queryByText('Garage Roy')).not.toBeOnTheScreen();
  });

  it('says so when no lot is online', async () => {
    await renderHomeScreen(new FakeLotsClient([]));

    expect(await screen.findByText('Aucun stationnement en ligne.')).toBeOnTheScreen();
  });
});

describe('HomeScreen when the API is unreachable', () => {
  it('shows the error and a retry button without any count on open', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'));

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    expect(screen.queryByText(/places? libres?/)).not.toBeOnTheScreen();
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
  });

  it('shows the unreachable message in English', async () => {
    await renderHomeScreen(new FakeLotsClient('unreachable'), 'en');

    expect(await screen.findByText('Can’t reach Palier.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
