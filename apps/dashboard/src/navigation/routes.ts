export type Route = { readonly page: 'home' } | { readonly page: 'lot'; readonly lotId: string } | { readonly page: 'notFound' };

const LOT_PATH = /^\/lots\/([^/]+)\/?$/;

export function routeOf(pathname: string): Route {
  if (pathname === '/' || pathname === '') {
    return { page: 'home' };
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

export const HOME_PATH = '/';
