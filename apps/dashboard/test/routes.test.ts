import { describe, expect, it } from 'vitest';
import { equipmentPath, exitsPath, gatesPath, lotPath, mapPath, occupancyPath, publicationPath, routeOf, sessionPath, sessionsPath, staleSessionsPath } from '../src/navigation/routes.ts';

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

  it('opens the equipment page for a lot, with or without a trailing slash', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';

    expect(routeOf(equipmentPath(lotId))).toEqual({ page: 'equipment', lotId });
    expect(routeOf(`${equipmentPath(lotId)}/`)).toEqual({ page: 'equipment', lotId });
    expect(routeOf(`/lots/${lotId}/equipment/extra`)).toEqual({ page: 'notFound' });
  });

  it('opens the gates page for a lot, with or without a trailing slash', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';

    expect(routeOf(gatesPath(lotId))).toEqual({ page: 'gates', lotId });
    expect(routeOf(`${gatesPath(lotId)}/`)).toEqual({ page: 'gates', lotId });
    expect(routeOf(`/lots/${lotId}/gates/extra`)).toEqual({ page: 'notFound' });
  });

  it('opens the go-live page for a lot, with or without a trailing slash', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';

    expect(routeOf(publicationPath(lotId))).toEqual({ page: 'publication', lotId });
    expect(routeOf(`${publicationPath(lotId)}/`)).toEqual({ page: 'publication', lotId });
    expect(routeOf(`/lots/${lotId}/publication/extra`)).toEqual({ page: 'notFound' });
  });

  it('opens the map page for a lot, with or without a trailing slash', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';

    expect(routeOf(mapPath(lotId))).toEqual({ page: 'map', lotId });
    expect(routeOf(`${mapPath(lotId)}/`)).toEqual({ page: 'map', lotId });
    expect(routeOf(`/lots/${lotId}/map/extra`)).toEqual({ page: 'notFound' });
  });

  it('opens the sessions page of a lot and the page of one session, with or without a trailing slash', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';
    const sessionId = '00000000-0000-4000-8000-000000000801';

    expect(routeOf(sessionsPath(lotId))).toEqual({ page: 'sessions', lotId });
    expect(routeOf(`${sessionsPath(lotId)}/`)).toEqual({ page: 'sessions', lotId });
    expect(routeOf(sessionPath(lotId, sessionId))).toEqual({ page: 'session', lotId, sessionId });
    expect(routeOf(`${sessionPath(lotId, sessionId)}/`)).toEqual({ page: 'session', lotId, sessionId });
    expect(routeOf(`${sessionPath(lotId, sessionId)}/extra`)).toEqual({ page: 'notFound' });
  });

  it('opens the sessions with no exit of a lot, with or without a trailing slash, and nothing under it', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';

    expect(routeOf(staleSessionsPath(lotId))).toEqual({ page: 'staleSessions', lotId });
    expect(routeOf(`${staleSessionsPath(lotId)}/`)).toEqual({ page: 'staleSessions', lotId });
    expect(routeOf(`${staleSessionsPath(lotId)}/extra`)).toEqual({ page: 'notFound' });
  });

  it('opens the exits of a lot, with or without a trailing slash, and nothing under it', () => {
    const lotId = '00000000-0000-4000-8000-000000000201';

    expect(routeOf(exitsPath(lotId))).toEqual({ page: 'exits', lotId });
    expect(routeOf(`${exitsPath(lotId)}/`)).toEqual({ page: 'exits', lotId });
    expect(routeOf(`${exitsPath(lotId)}/extra`)).toEqual({ page: 'notFound' });
  });

  it('treats a session address with a broken escape as not found instead of crashing', () => {
    expect(routeOf('/lots/00000000-0000-4000-8000-000000000201/sessions/%E0%A4%A')).toEqual({ page: 'notFound' });
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
