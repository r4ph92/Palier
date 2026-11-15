import { LOTS_REFRESH_MILLISECONDS } from '../src/lots/useLots';

// A lot the operator puts online or offline shows up, or leaves, the driver's list within one refresh (#68).
describe('the lot list refresh', () => {
  it('reads the lots again at least every 30 seconds', () => {
    expect(LOTS_REFRESH_MILLISECONDS).toBeLessThanOrEqual(30_000);
  });
});
