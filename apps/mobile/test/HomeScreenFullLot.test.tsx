import { screen } from '@testing-library/react-native';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';

describe('HomeScreen when Parking Démo is full', () => {
  it('shows Complet instead of 0 free spots', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(0)));

    expect(await screen.findByText('Complet')).toBeOnTheScreen();
    expect(screen.queryByText(/places? libres?/)).not.toBeOnTheScreen();
  });

  it('still tells VoiceOver that no spot is free', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(0)));

    expect(await screen.findByLabelText('Complet, 0 place libre')).toBeOnTheScreen();
  });

  it('says Full in English', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(0)), 'en');

    expect(await screen.findByText('Full')).toBeOnTheScreen();
    expect(screen.getByLabelText('Full, 0 free spots')).toBeOnTheScreen();
  });

  it('shows the count again once a spot frees up', async () => {
    await renderHomeScreen(new FakeLotsClient(parkingDemoWith(1)));

    expect(await screen.findByText('1 place libre')).toBeOnTheScreen();
    expect(screen.queryByText('Complet')).not.toBeOnTheScreen();
  });
});
