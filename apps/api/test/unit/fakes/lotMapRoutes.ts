import type { DashboardLotMap } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { writeHeader } from './dashboardServer.ts';

export type Cookies = Record<string, string>;

export const aisleA = { code: 'A', beaconMinor: 1, rectangle: { x: 0, y: 0, width: 100, height: 40 } };

// The four lot map routes, on Garage Roy unless a test names another lot.
export function lotMapRoutesOf(server: FastifyInstance) {
  return {
    readMap: (cookies: Cookies, lotId = GARAGE_ROY_ID) => server.inject({ method: 'GET', url: `/v1/dashboard/lots/${lotId}/map`, cookies }),
    addLevel: (cookies: Cookies, code: string) =>
      server.inject({ method: 'POST', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels`, cookies, headers: writeHeader, payload: { code } }),
    reorder: (cookies: Cookies, levelIds: readonly string[], fromLevelIds?: readonly string[]) => {
      const payload = fromLevelIds === undefined ? { levelIds } : { levelIds, fromLevelIds };
      return server.inject({ method: 'PUT', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels/order`, cookies, headers: writeHeader, payload });
    },
    addAisle: (cookies: Cookies, levelId: string, payload: object = aisleA) =>
      server.inject({ method: 'POST', url: `/v1/dashboard/lots/${GARAGE_ROY_ID}/levels/${levelId}/aisles`, cookies, headers: writeHeader, payload }),
  };
}

export type LotMapRoutes = ReturnType<typeof lotMapRoutesOf>;

export function levelIdOf(map: DashboardLotMap, code: string): string {
  return map.levels.find((level) => level.code === code)?.id ?? '';
}
