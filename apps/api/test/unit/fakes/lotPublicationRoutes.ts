import type { FastifyInstance } from 'fastify';
import { writeHeader } from './dashboardServer.ts';
import type { Cookies } from './lotMapRoutes.ts';
import { GARAGE_ROY_NORD_ID } from './publicationFixtures.ts';

// The "Mise en ligne" routes on one lot, Garage Roy Nord unless a test names another.
export function lotPublicationRoutesOf(server: FastifyInstance, lotId = GARAGE_ROY_NORD_ID) {
  const lotPath = `/v1/dashboard/lots/${lotId}`;
  const put = (cookies: Cookies, url: string, payload: object) => server.inject({ method: 'PUT', url, cookies, headers: writeHeader, payload });
  return {
    readPublication: (cookies: Cookies) => server.inject({ method: 'GET', url: `${lotPath}/publication`, cookies }),
    changeOnline: (cookies: Cookies, online: boolean) => put(cookies, `${lotPath}/online`, { online }),
    attestWifi: (cookies: Cookies, payload: object) => put(cookies, `${lotPath}/attestations/wifi`, payload),
    attestCellular: (cookies: Cookies, payload: object) => put(cookies, `${lotPath}/attestations/cellular`, payload),
  };
}

export type LotPublicationRoutes = ReturnType<typeof lotPublicationRoutesOf>;
