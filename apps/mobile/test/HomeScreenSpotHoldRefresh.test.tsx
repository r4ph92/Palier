import { screen, userEvent } from '@testing-library/react-native';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemoWith } from './fakeLotsClient';
import { FakeSpotHoldClient, julieHoldAtParkingDemo } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';
import { HOLD_BUTTON_FR, holdAtParkingDemo, tick } from './spotHoldScreen';
import { visibleText } from './visibleText';

describe('HomeScreen spot hold across list refreshes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 14, 2));
  });
  afterEach(() => jest.useRealTimers());

  it('offers no hold until Palier has said whether Julie already holds one, and reads it again with the list', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.isReachable = false;
    await renderHomeScreenWith({ lotsClient: new FakeLotsClient(parkingDemoWith(10)), locationClient: new FakeDeviceLocationClient(), spotHoldClient });
    await screen.findByText('10 places libres', visibleText);
    expect(screen.queryByRole('button', { name: HOLD_BUTTON_FR })).not.toBeOnTheScreen();

    spotHoldClient.isReachable = true;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByRole('button', { name: HOLD_BUTTON_FR })).toBeOnTheScreen();
  });

  it('keeps a refusal on screen through the 30-second refresh of the list', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'HOLD_QUOTA_REACHED';
    const lotsClient = new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9));
    await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient });
    await screen.findByRole('button', { name: HOLD_BUTTON_FR });
    await tick(29);
    await userEvent.setup().press(screen.getByRole('button', { name: HOLD_BUTTON_FR }));
    await screen.findByText('Trop de places garanties dans ce parking pour le moment');

    await tick(2);

    expect(await screen.findByText('9 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Trop de places garanties dans ce parking pour le moment')).toBeOnTheScreen();
  });

  it('clears a refusal when the driver pulls the list down', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'HOLD_QUOTA_REACHED';
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9)), spotHoldClient);
    await screen.findByText('Trop de places garanties dans ce parking pour le moment');

    await userEvent.setup().pullToRefresh(screen.getByTestId('lot-list'));

    expect(await screen.findByText('9 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Trop de places garanties dans ce parking pour le moment')).not.toBeOnTheScreen();
  });

  it('sends no hold read with the 30-second refresh once the hold is known', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    const lotsClient = new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9));
    await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient });
    await screen.findByRole('button', { name: HOLD_BUTTON_FR });
    const readsBefore = spotHoldClient.currentRequests;

    await tick(30);

    expect(await screen.findByText('9 places libres', visibleText)).toBeOnTheScreen();
    expect(spotHoldClient.currentRequests).toBe(readsBefore);
  });

  it('reads the hold once at launch', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    await renderHomeScreenWith({ lotsClient: new FakeLotsClient(parkingDemoWith(10)), locationClient: new FakeDeviceLocationClient(), spotHoldClient });

    await screen.findByRole('button', { name: HOLD_BUTTON_FR });

    expect(spotHoldClient.currentRequests).toBe(1);
  });

  it('clears a refusal on Actualiser', async () => {
    const spotHoldClient = new FakeSpotHoldClient();
    spotHoldClient.nextRejection = 'HOLD_QUOTA_REACHED';
    await holdAtParkingDemo(new FakeLotsClient(parkingDemoWith(10), parkingDemoWith(9)), spotHoldClient);
    await screen.findByText('Trop de places garanties dans ce parking pour le moment');

    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByText('9 places libres', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Trop de places garanties dans ce parking pour le moment')).not.toBeOnTheScreen();
  });

  it('removes the banner when a read on Actualiser finds no hold any more', async () => {
    const spotHoldClient = new FakeSpotHoldClient(julieHoldAtParkingDemo());
    await renderHomeScreenWith({ lotsClient: new FakeLotsClient(parkingDemoWith(10)), locationClient: new FakeDeviceLocationClient(), spotHoldClient });
    await screen.findByTestId('spot-hold-banner');
    spotHoldClient.activeHold = null;

    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByRole('button', { name: HOLD_BUTTON_FR })).toBeOnTheScreen();
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });
});
