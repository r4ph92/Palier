import type { BeaconBatteryReading, GateTestPassageResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { recordHeartbeat, type GateReportSources } from '../../domain/equipment/recordHeartbeat.ts';
import { recordTestPassage } from '../../domain/equipment/recordTestPassage.ts';
import { reportBeaconBattery } from '../../domain/equipment/reportBeaconBattery.ts';
import { authenticatedGateOf } from '../gates/gateDeviceAuthentication.ts';
import { batteryReadingBodySchema } from '../schemas/beaconBatterySchemas.ts';
import {
  batteryReportParametersSchema,
  gateIdParametersSchema,
  testPassageResponseSchema,
  type BatteryReportParameters,
  type GateIdParameters,
} from '../schemas/gateSchemas.ts';

const NO_CONTENT = 204;

interface BatteryReportRoute {
  Params: BatteryReportParameters;
  Body: BeaconBatteryReading;
}

// Registered in the gate scope, behind the device-key hook: a controller tells it is alive, passed its self-test, and how its lot's beacons are doing.
export function registerGateHealthRoutes(scope: FastifyInstance, sources: GateReportSources): void {
  registerHeartbeatRoute(scope, sources);
  registerBatteryReportRoute(scope, sources);
  registerTestPassageRoute(scope, sources);
}

function registerHeartbeatRoute(scope: FastifyInstance, sources: GateReportSources): void {
  scope.post<{ Params: GateIdParameters }>('/:id/heartbeat', { schema: { params: gateIdParametersSchema } }, async (request, reply): Promise<FastifyReply> => {
    await recordHeartbeat({ gate: authenticatedGateOf(request), requestedGateId: request.params.id }, sources);
    return reply.status(NO_CONTENT).send();
  });
}

function registerBatteryReportRoute(scope: FastifyInstance, sources: GateReportSources): void {
  const schema = { params: batteryReportParametersSchema, body: batteryReadingBodySchema };
  scope.post<BatteryReportRoute>('/:id/beacons/:minor/battery', { schema }, async (request, reply): Promise<FastifyReply> => {
    const command = { gate: authenticatedGateOf(request), requestedGateId: request.params.id, beaconMinor: Number(request.params.minor), percent: request.body.percent };
    await reportBeaconBattery(command, sources);
    return reply.status(NO_CONTENT).send();
  });
}

function registerTestPassageRoute(scope: FastifyInstance, sources: GateReportSources): void {
  const schema = { params: gateIdParametersSchema, response: { 200: testPassageResponseSchema } };
  scope.post<{ Params: GateIdParameters }>('/:id/test-passage', { schema }, async (request): Promise<GateTestPassageResponse> => {
    const verifiedAt = await recordTestPassage({ gate: authenticatedGateOf(request), requestedGateId: request.params.id }, sources);
    return { verifiedAt: verifiedAt.toISOString() };
  });
}
