export type Route =
  | { readonly page: 'home' }
  | { readonly page: 'newLot' }
  | { readonly page: 'lot'; readonly lotId: string }
  | { readonly page: 'occupancy'; readonly lotId: string }
  | { readonly page: 'notFound' };

export const NEW_LOT_PATH = '/lots/new';

const LOT_PATH = /^\/lots\/([^/]+)\/?$/;
const OCCUPANCY_PATH = /^\/lots\/([^/]+)\/occupancy\/?$/;

export function routeOf(pathname: string): Route {
  if (pathname === '/' || pathname === '') {
    return { page: 'home' };
  }
  // Before the lot pattern, which "new" would match as a lot id.
  if (pathname === NEW_LOT_PATH || pathname === `${NEW_LOT_PATH}/`) {
    return { page: 'newLot' };
  }
  const occupancyLotId = decodedSegment(OCCUPANCY_PATH.exec(pathname)?.[1]);
  if (occupancyLotId !== null) {
    return { page: 'occupancy', lotId: occupancyLotId };
  }
  const lotId = decodedSegment(LOT_PATH.exec(pathname)?.[1]);
  return lotId === null ? { page: 'notFound' } : { page: 'lot', lotId };
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

export const HOME_PATH = '/';
