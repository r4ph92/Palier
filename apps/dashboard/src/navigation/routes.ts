export type Route =
  | { readonly page: 'home' }
  | { readonly page: 'newLot' }
  | { readonly page: 'lot'; readonly lotId: string }
  | { readonly page: 'occupancy'; readonly lotId: string }
  | { readonly page: 'map'; readonly lotId: string }
  | { readonly page: 'notFound' };

export const NEW_LOT_PATH = '/lots/new';

const LOT_PATH = /^\/lots\/([^/]+)\/?$/;
const OCCUPANCY_PATH = /^\/lots\/([^/]+)\/occupancy\/?$/;
const MAP_PATH = /^\/lots\/([^/]+)\/map\/?$/;

export function routeOf(pathname: string): Route {
  if (pathname === '/' || pathname === '') {
    return { page: 'home' };
  }
  // Before the lot pattern, which "new" would match as a lot id.
  if (pathname === NEW_LOT_PATH || pathname === `${NEW_LOT_PATH}/`) {
    return { page: 'newLot' };
  }
  const lotSubpage = lotSubpageOf(pathname);
  if (lotSubpage !== null) {
    return lotSubpage;
  }
  const lotId = decodedSegment(LOT_PATH.exec(pathname)?.[1]);
  return lotId === null ? { page: 'notFound' } : { page: 'lot', lotId };
}

const LOT_SUBPAGES = [
  ['occupancy', OCCUPANCY_PATH],
  ['map', MAP_PATH],
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

export const HOME_PATH = '/';
