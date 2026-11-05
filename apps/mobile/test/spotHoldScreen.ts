import { act, screen, userEvent } from '@testing-library/react-native';
import { FakeDeviceLocationClient } from './fakeDeviceLocationClient';
import type { FakeLotsClient } from './fakeLotsClient';
import { FakeSpotHoldClient } from './fakeSpotHoldClient';
import { renderHomeScreenWith } from './renderHomeScreen';

export const HOLD_BUTTON_FR = 'Garantir une place 15 min à Parking Démo';

export async function holdAtParkingDemo(lotsClient: FakeLotsClient, spotHoldClient = new FakeSpotHoldClient(), language: 'fr' | 'en' = 'fr') {
  await renderHomeScreenWith({ lotsClient, locationClient: new FakeDeviceLocationClient(), spotHoldClient }, language);
  const name = language === 'fr' ? HOLD_BUTTON_FR : 'Guarantee a spot for 15 min at Parking Démo';
  await userEvent.setup().press(await screen.findByRole('button', { name }));
  return spotHoldClient;
}

export async function tick(seconds: number): Promise<void> {
  await act(() => jest.advanceTimersByTimeAsync(seconds * 1000));
}
