import type { LotListResponse } from '@palier/shared-types';
import { screen, userEvent } from '@testing-library/react-native';
import type { LotsClient } from '../src/api/LotsClient';
import { parkingDemoWith } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';

class SlowRefreshLotsClient implements LotsClient {
  callCount = 0;

  listLots(): Promise<LotListResponse> {
    this.callCount += 1;
    if (this.callCount === 1) {
      return Promise.resolve(parkingDemoWith(10));
    }
    return new Promise<LotListResponse>(() => undefined);
  }
}

describe('HomeScreen Actualiser while a refresh is in flight', () => {
  it('does not start another request when Actualiser is pressed again before the first refresh settles', async () => {
    const client = new SlowRefreshLotsClient();
    await renderHomeScreen(client);
    await screen.findByText('10 places libres');
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Actualiser' }));
    await user.press(screen.getByRole('button', { name: 'Actualiser' }));
    await user.press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(client.callCount).toBe(2);
  });
});
