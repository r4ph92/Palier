import { describe, expect, it } from 'vitest';
import { lotPath, occupancyPath, routeOf } from '../src/navigation/routes.ts';

describe('dashboard addresses', () => {
  it('opens the lot page for an encoded lot id', () => {
    expect(routeOf(lotPath('00000000-0000-4000-8000-000000000201'))).toEqual({ page: 'lot', lotId: '00000000-0000-4000-8000-000000000201' });
  });

  it('opens the occupancy page for a lot, with or without a trailing slash', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';

    expect(routeOf(occupancyPath(lotId))).toEqual({ page: 'occupancy', lotId });
    expect(routeOf(`${occupancyPath(lotId)}/`)).toEqual({ page: 'occupancy', lotId });
    expect(routeOf(`/lots/${lotId}/occupancy/extra`)).toEqual({ page: 'notFound' });
  });

  it.each(['/lots/new', '/lots/new/'])('opens the new lot page at %s, not a lot whose id is "new"', (pathname) => {
    expect(routeOf(pathname)).toEqual({ page: 'newLot' });
  });

  // A static host that serves index.html for every path hands these to the app; decodeURIComponent throws on them.
  it.each(['/lots/%E0%A4%A', '/lots/%'])('treats the malformed address %s as not found instead of crashing', (pathname) => {
    expect(() => routeOf(pathname)).not.toThrow();
    expect(routeOf(pathname)).toEqual({ page: 'notFound' });
  });
});
