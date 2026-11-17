export type Route =
  | { readonly page: 'home' }
  | { readonly page: 'newLot' }
  | { readonly page: 'lot'; readonly lotId: string }
  | { readonly page: 'occupancy'; readonly lotId: string }
  | { readonly page: 'map'; readonly lotId: string }
  | { readonly page: 'equipment'; readonly lotId: string }
  | { readonly page: 'spotsToCheck'; readonly lotId: string }
  | { readonly page: 'gates'; readonly lotId: string }
  | { readonly page: 'publication'; readonly lotId: string }
  | { readonly page: 'sessions'; readonly lotId: string }
  | { readonly page: 'staleSessions'; readonly lotId: string }
  | { readonly page: 'exits'; readonly lotId: string }
  | { readonly page: 'session'; readonly lotId: string; readonly sessionId: string }
  | { readonly page: 'notFound' };

export const NEW_LOT_PATH = '/lots/new';

const LOT_PATH = /^\/lots\/([^/]+)\/?$/;
const OCCUPANCY_PATH = /^\/lots\/([^/]+)\/occupancy\/?$/;
const MAP_PATH = /^\/lots\/([^/]+)\/map\/?$/;
const SPOTS_TO_CHECK_PATH = /^\/lots\/([^/]+)\/spots-to-check\/?$/;
const EQUIPMENT_PATH = /^\/lots\/([^/]+)\/equipment\/?$/;
const GATES_PATH = /^\/lots\/([^/]+)\/gates\/?$/;
const PUBLICATION_PATH = /^\/lots\/([^/]+)\/publication\/?$/;
const SESSIONS_PATH = /^\/lots\/([^/]+)\/sessions\/?$/;
const STALE_SESSIONS_PATH = /^\/lots\/([^/]+)\/stale-sessions\/?$/;
const EXITS_PATH = /^\/lots\/([^/]+)\/exits\/?$/;
const SESSION_PATH = /^\/lots\/([^/]+)\/sessions\/([^/]+)\/?$/;

export function routeOf(pathname: string): Route {
  if (pathname === '/' || pathname === '') {
    return { page: 'home' };
  }
  // Before the lot pattern, which "new" would match as a lot id.
  if (pathname === NEW_LOT_PATH || pathname === `${NEW_LOT_PATH}/`) {
    return { page: 'newLot' };
  }
  const lotSubpage = lotSubpageOf(pathname) ?? sessionRouteOf(pathname);
  if (lotSubpage !== null) {
    return lotSubpage;
  }
  const lotId = decodedSegment(LOT_PATH.exec(pathname)?.[1]);
  return lotId === null ? { page: 'notFound' } : { page: 'lot', lotId };
}

const LOT_SUBPAGES = [
  ['occupancy', OCCUPANCY_PATH],
  ['map', MAP_PATH],
  ['spotsToCheck', SPOTS_TO_CHECK_PATH],
  ['equipment', EQUIPMENT_PATH],
  ['gates', GATES_PATH],
  ['publication', PUBLICATION_PATH],
  ['sessions', SESSIONS_PATH],
  ['staleSessions', STALE_SESSIONS_PATH],
  ['exits', EXITS_PATH],
] as const;

function lotSubpageOf(pathname: string): Route | null {
  for (const [page, pattern] of LOT_SUBPAGES) {
    const lotId = decodedSegment(pattern.exec(pathname)?.[1]);
    if (lotId !== null) {
      return { page, lotId };
    }
  }
  return null;
}

function sessionRouteOf(pathname: string): Route | null {
  const [, encodedLotId, encodedSessionId] = SESSION_PATH.exec(pathname) ?? [];
  const lotId = decodedSegment(encodedLotId);
  const sessionId = decodedSegment(encodedSessionId);
  return lotId === null || sessionId === null ? null : { page: 'session', lotId, sessionId };
}

// A typed or pasted address can hold a broken escape such as "%E0%A4%A", which decodeURIComponent refuses.
function decodedSegment(segment: string | undefined): string | null {
  if (segment === undefined) {
    return null;
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function lotPath(lotId: string): string {
  return `/lots/${encodeURIComponent(lotId)}`;
}

export function occupancyPath(lotId: string): string {
  return `${lotPath(lotId)}/occupancy`;
}

export function mapPath(lotId: string): string {
  return `${lotPath(lotId)}/map`;
}

export function spotsToCheckPath(lotId: string): string {
  return `${lotPath(lotId)}/spots-to-check`;
}

export function equipmentPath(lotId: string): string {
  return `${lotPath(lotId)}/equipment`;
}

export function gatesPath(lotId: string): string {
  return `${lotPath(lotId)}/gates`;
}

export function publicationPath(lotId: string): string {
  return `${lotPath(lotId)}/publication`;
}

export function sessionsPath(lotId: string): string {
  return `${lotPath(lotId)}/sessions`;
}

export function staleSessionsPath(lotId: string): string {
  return `${lotPath(lotId)}/stale-sessions`;
}

export function exitsPath(lotId: string): string {
  return `${lotPath(lotId)}/exits`;
}

export function sessionPath(lotId: string, sessionId: string): string {
  return `${sessionsPath(lotId)}/${encodeURIComponent(sessionId)}`;
}

export const HOME_PATH = '/';
