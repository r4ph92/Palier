import { LOTS_REFRESH_MILLISECONDS } from '../src/lots/useLots';

describe('the lot list refresh', () => {
  it('reads the lots again at least every 30 seconds', () => {
    expect(LOTS_REFRESH_MILLISECONDS).toBeLessThanOrEqual(30_000);
  });
});
