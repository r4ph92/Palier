import type { BeaconBatteryReading } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { recordHeartbeat, type GateReportSources } from '../../domain/equipment/recordHeartbeat.ts';
import { reportBeaconBattery } from '../../domain/equipment/reportBeaconBattery.ts';
import { authenticatedGateOf } from '../gates/gateDeviceAuthentication.ts';
import { batteryReadingBodySchema } from '../schemas/beaconBatterySchemas.ts';
import { batteryReportParametersSchema, gateIdParametersSchema, type BatteryReportParameters, type GateIdParameters } from '../schemas/gateSchemas.ts';

const NO_CONTENT = 204;

interface BatteryReportRoute {
  Params: BatteryReportParameters;
  Body: BeaconBatteryReading;
}

// Registered in the gate scope, behind the device-key hook: a controller tells it is alive and how its lot's beacons are doing.
export function registerGateHealthRoutes(scope: FastifyInstance, sources: GateReportSources): void {
  registerHeartbeatRoute(scope, sources);
  registerBatteryReportRoute(scope, sources);
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
