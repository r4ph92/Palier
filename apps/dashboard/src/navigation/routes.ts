export type Route = { readonly page: 'home' } | { readonly page: 'lot'; readonly lotId: string } | { readonly page: 'notFound' };

const LOT_PATH = /^\/lots\/([^/]+)\/?$/;

export function routeOf(pathname: string): Route {
  if (pathname === '/' || pathname === '') {
    return { page: 'home' };
  }
  const lotMatch = LOT_PATH.exec(pathname);
  return lotMatch?.[1] === undefined ? { page: 'notFound' } : { page: 'lot', lotId: decodeURIComponent(lotMatch[1]) };
}

export function lotPath(lotId: string): string {
  return `/lots/${encodeURIComponent(lotId)}`;
}

export const HOME_PATH = '/';
