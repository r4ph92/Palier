import type { BeaconBatteryReading, DashboardLotMap, LevelOrderRequest } from '@palier/shared-types';
import type { AisleRequest } from '@palier/shared-types/aisleDraft';
import type { LevelDraft } from '@palier/shared-types/levelDraft';
import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import {
  addAisleOfMember,
  addLevelOfMember,
  readLotMapOfMember,
  recordBeaconBatteryOfMember,
  reorderLevelsOfMember,
  type LotMapSources,
} from '../../domain/dashboard/lotMap.ts';
import { batteryReadingBodySchema } from '../schemas/beaconBatterySchemas.ts';
import { lotIdParametersSchema } from '../schemas/dashboardSchemas.ts';
import { aisleBodySchema, dashboardLotMapSchema, levelDraftBodySchema, levelOrderBodySchema, lotLevelParametersSchema } from '../schemas/lotMapSchemas.ts';
import { lotAisleParametersSchema } from '../schemas/lotSpotSchemas.ts';
import type { DashboardRouteDependencies } from './DashboardRouteDependencies.ts';
import { memberLotOf, refuseMalformedRequest, type AisleParams, type LotParams } from './memberRequest.ts';
import { refuseMalformedLotId } from './refuseMalformedLotId.ts';
import { requireDashboardUser } from './requireDashboardUser.ts';

interface LevelParams extends LotParams {
  readonly levelId: string;
}

interface MapRoutesContext {
  readonly scope: FastifyInstance;
  readonly sources: LotMapSources;
  // onRequest, not preHandler: body and params validation run before preHandler, so a visitor without a session is refused first.
  readonly onRequest: onRequestAsyncHookHandler;
}

const response = { 200: dashboardLotMapSchema };

export function registerDashboardLotMapRoutes(scope: FastifyInstance, { access, operators, maps, clock }: DashboardRouteDependencies): void {
  const context: MapRoutesContext = { scope, sources: { operators, maps, clock }, onRequest: requireDashboardUser(access.sessions) };
  registerReadMapRoute(context);
  registerAddLevelRoute(context);
  registerReorderLevelsRoute(context);
  registerAddAisleRoute(context);
  registerBeaconBatteryRoute(context);
}

function registerReadMapRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotIdParametersSchema, response };
  scope.get<{ readonly Params: LotParams }>('/v1/dashboard/lots/:id/map', { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedLotId(request);
    return readLotMapOfMember(sources, memberLotOf(request));
  });
}

function registerAddLevelRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotIdParametersSchema, body: levelDraftBodySchema, response };
  const route = '/v1/dashboard/lots/:id/levels';
  scope.post<{ readonly Params: LotParams; readonly Body: LevelDraft }>(route, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedRequest(request);
    return addLevelOfMember(sources, memberLotOf(request), request.body);
  });
}

function registerReorderLevelsRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotIdParametersSchema, body: levelOrderBodySchema, response };
  const route = '/v1/dashboard/lots/:id/levels/order';
  scope.put<{ readonly Params: LotParams; readonly Body: LevelOrderRequest }>(route, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedRequest(request);
    return reorderLevelsOfMember(sources, memberLotOf(request), request.body);
  });
}

// A malformed level id answers the lot's 404 too: the answer never tells which of the two ids was wrong.
function registerAddAisleRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotLevelParametersSchema, body: aisleBodySchema, response };
  const route = '/v1/dashboard/lots/:id/levels/:levelId/aisles';
  scope.post<{ readonly Params: LevelParams; readonly Body: AisleRequest }>(route, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedRequest(request);
    return addAisleOfMember(sources, { ...memberLotOf(request), levelId: request.params.levelId }, request.body);
  });
}

// The exit lane's beacon is an aisle too, so its battery is recorded the same way.
function registerBeaconBatteryRoute({ scope, sources, onRequest }: MapRoutesContext): void {
  const schema = { params: lotAisleParametersSchema, body: batteryReadingBodySchema, response };
  const route = '/v1/dashboard/lots/:id/aisles/:aisleId/beacon-battery';
  scope.put<{ readonly Params: AisleParams; readonly Body: BeaconBatteryReading }>(route, { onRequest, attachValidation: true, schema }, (request): Promise<DashboardLotMap> => {
    refuseMalformedRequest(request);
    return recordBeaconBatteryOfMember(sources, { ...memberLotOf(request), aisleId: request.params.aisleId }, request.body);
  });
}
