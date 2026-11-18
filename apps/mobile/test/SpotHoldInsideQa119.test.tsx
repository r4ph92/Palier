import { screen, userEvent, within } from '@testing-library/react-native';
import { HttpSpotHoldClient } from '../src/api/HttpSpotHoldClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import { FakeLotsClient, PARKING_DEMO_ID, parkingDemo, parkingTestPaliers } from './fakeLotsClient';
import { FakeSpotHoldClient } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';

// The body the lane API answered to Julie inside Parking Démo (QA #119, http://127.0.0.1:3119).
const ALREADY_INSIDE_ANSWER = { statusCode: 409, error: 'ALREADY_INSIDE', message: 'You are already in a parking lot.' };

async function tapHoldWhileInside(button: string, language: 'fr' | 'en' = 'fr') {
  const spotHoldClient = new FakeSpotHoldClient();
  spotHoldClient.nextRejection = 'ALREADY_INSIDE';
  const lotsClient = new FakeLotsClient([parkingDemo(10), parkingTestPaliers]);
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient }, language);
  await userEvent.setup().press(await screen.findByRole('button', { name: button }));
  return { lotsClient, spotHoldClient };
}

describe('Julie refused a hold while inside a lot (QA #119)', () => {
  it('reads the API 409 ALREADY_INSIDE answer as a refusal with its code', async () => {
    const fetchFunction = jest.fn(() => Promise.resolve(new Response(JSON.stringify(ALREADY_INSIDE_ANSWER), { status: 409 })));
    const client = new HttpSpotHoldClient({ baseUrl: 'http://localhost:3000', token: 'julie-token', onUnauthorized: jest.fn(), onConsentRequired: jest.fn(), fetchFunction });

    await expect(client.hold(PARKING_DEMO_ID)).rejects.toEqual(new PalierRejectedError('ALREADY_INSIDE'));
  });

  it('tells Julie under Parking Démo’s own button, with no banner and Parking Démo still at 10 free spots', async () => {
    const { lotsClient } = await tapHoldWhileInside('Garantir une place 15 min à Parking Démo');

    expect(await within(screen.getByTestId(`lot-spot-hold-${PARKING_DEMO_ID}`)).findByText('Vous êtes déjà dans un stationnement')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`lot-spot-hold-${parkingTestPaliers.id}`)).queryByText('Vous êtes déjà dans un stationnement')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
    expect(screen.getByText('10 places libres')).toBeOnTheScreen();
    expect(lotsClient.callCount).toBe(1);
  });

  it('reads "You are already in a parking lot" under Parking Test Paliers on an English device, with no banner', async () => {
    await tapHoldWhileInside('Guarantee a spot for 15 min at Parking Test Paliers', 'en');

    expect(await within(screen.getByTestId(`lot-spot-hold-${parkingTestPaliers.id}`)).findByText('You are already in a parking lot')).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes déjà dans un stationnement')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('spot-hold-banner')).not.toBeOnTheScreen();
  });
});
