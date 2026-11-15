import type { GateDraft, GateSettings } from '@palier/shared-types/gateDraft';
import type { FastifyInstance } from 'fastify';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { writeHeader } from './dashboardServer.ts';
import type { Cookies } from './lotMapRoutes.ts';

// AC1's gate: an entry on the access-control API, at an https address, reporting its loops.
export const entreePrincipale: GateDraft = {
  name: 'Entrée principale',
  kind: 'ENTRY',
  integrationKind: 'ACCESS_CONTROL_API',
  endpoint: 'https://controle.garageroy.ca/portes/1',
  reportsLoops: true,
  exitIdentification: 'NONE',
};

export const sortieNord: GateDraft = { ...entreePrincipale, name: 'Sortie Nord', kind: 'EXIT', integrationKind: 'DRY_CONTACT', endpoint: null };

export function settingsOf({ name, integrationKind, endpoint, reportsLoops, exitIdentification }: GateDraft): GateSettings {
  return { name, integrationKind, endpoint, reportsLoops, exitIdentification };
}

interface GateWrite {
  readonly method: 'POST' | 'PUT';
  readonly url: string;
  readonly payload?: object;
}

// The gate routes on one lot, Garage Roy unless a test names another.
export function lotGateRoutesOf(server: FastifyInstance, lotId = GARAGE_ROY_ID) {
  const gatesPath = `/v1/dashboard/lots/${lotId}/gates`;
  const write = (cookies: Cookies, { method, url, payload }: GateWrite) => server.inject({ method, url, cookies, headers: writeHeader, ...(payload === undefined ? {} : { payload }) });
  return {
    readGates: (cookies: Cookies) => server.inject({ method: 'GET', url: gatesPath, cookies }),
    addGate: (cookies: Cookies, payload: object) => write(cookies, { method: 'POST', url: gatesPath, payload }),
    changeGate: (cookies: Cookies, gateId: string, payload: object) => write(cookies, { method: 'PUT', url: `${gatesPath}/${gateId}`, payload }),
    replaceDeviceKey: (cookies: Cookies, gateId: string) => write(cookies, { method: 'POST', url: `${gatesPath}/${gateId}/device-key` }),
    replaceQrSecret: (cookies: Cookies, gateId: string) => write(cookies, { method: 'POST', url: `${gatesPath}/${gateId}/qr-secret` }),
    readQrLink: (cookies: Cookies, gateId: string) => server.inject({ method: 'GET', url: `${gatesPath}/${gateId}/qr-link`, cookies }),
  };
}

export type LotGateRoutes = ReturnType<typeof lotGateRoutesOf>;
