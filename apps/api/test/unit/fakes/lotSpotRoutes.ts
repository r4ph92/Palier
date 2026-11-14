import type { DashboardLotMap } from '@palier/shared-types';
import type { AddSpotsRequest, SpotAttributes } from '@palier/shared-types/spotDraft';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { writeHeader } from './dashboardServer.ts';
import type { Cookies } from './lotMapRoutes.ts';

export const standard: SpotAttributes = { isEv: false, isAccessible: false, isOversize: false, distanceToExit: 30 };

// Standard spots, 30 m from the exit.
export function spotsOf(prefix: string, first: string, last: string): AddSpotsRequest {
  return { range: { prefix, first, last }, attributes: standard };
}

// The four spot routes on one lot, Garage Roy unless a test names another.
export function lotSpotRoutesOf(server: FastifyInstance, lotId = GARAGE_ROY_ID) {
  const lotPath = `/v1/dashboard/lots/${lotId}`;
  return {
    readSpots: (cookies: Cookies, aisleId: string) => server.inject({ method: 'GET', url: `${lotPath}/aisles/${aisleId}/spots`, cookies }),
    addSpots: (cookies: Cookies, aisleId: string, payload: object) =>
      server.inject({ method: 'POST', url: `${lotPath}/aisles/${aisleId}/spots`, cookies, headers: writeHeader, payload }),
    changeSpot: (cookies: Cookies, spotId: string, payload: object) => server.inject({ method: 'PUT', url: `${lotPath}/spots/${spotId}`, cookies, headers: writeHeader, payload }),
    removeSpot: (cookies: Cookies, spotId: string) => server.inject({ method: 'DELETE', url: `${lotPath}/spots/${spotId}`, cookies, headers: writeHeader }),
  };
}

export type LotSpotRoutes = ReturnType<typeof lotSpotRoutesOf>;

export function aisleIdOf(map: DashboardLotMap, code: string): string {
  return map.levels.flatMap(({ aisles }) => aisles).find((aisle) => aisle.code === code)?.id ?? '';
}
