import type { Vehicle, VehicleListResponse } from '@palier/shared-types';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { DriverRepository } from '../../domain/drivers/DriverRepository.ts';
import { readPlate } from '../../domain/vehicles/plate.ts';
import { isProvinceCode } from '../../domain/vehicles/provinces.ts';
import type { VehicleRepository } from '../../domain/vehicles/VehicleRepository.ts';
import { requireConsent } from '../requireConsent.ts';
import { requireDriver, signedInDriver } from '../requireDriver.ts';
import { addVehicleBodySchema, vehicleListSchema, vehicleParamsSchema, vehicleSchema } from '../schemas/vehicleSchemas.ts';

const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

interface AddVehicleRequest {
  readonly Body: { readonly plate: string; readonly province: string };
}

interface VehicleParamsRequest {
  readonly Params: { readonly id: string };
}

export function registerVehicleRoutes(server: FastifyInstance, repository: VehicleRepository, driverRepository: DriverRepository): void {
  // Guards run as onRequest, not preHandler: body validation runs before preHandler, so a driver without a token or consent
  // is refused before a malformed body is looked at.
  const guards = [requireDriver(driverRepository), requireConsent(driverRepository)];
  registerListRoute(server, repository, guards);
  registerReadRoute(server, repository, guards);
  registerAddRoute(server, repository, guards);
}

function registerListRoute(server: FastifyInstance, repository: VehicleRepository, guards: preHandlerAsyncHookHandler[]): void {
  server.get('/v1/me/vehicles', { onRequest: guards, schema: { response: { 200: vehicleListSchema } } }, (request): Promise<VehicleListResponse> => {
    return repository.listVehicles(signedInDriver(request).id);
  });
}

function registerReadRoute(server: FastifyInstance, repository: VehicleRepository, guards: preHandlerAsyncHookHandler[]): void {
  server.get<VehicleParamsRequest>(
    '/v1/me/vehicles/:id',
    { onRequest: guards, schema: { params: vehicleParamsSchema, response: { 200: vehicleSchema } } },
    async (request, reply) => {
      const vehicle = await repository.findVehicle(signedInDriver(request).id, request.params.id);
      if (vehicle === null) {
        return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'NOT_FOUND', message: 'No such vehicle.' });
      }
      return vehicle;
    },
  );
}

function registerAddRoute(server: FastifyInstance, repository: VehicleRepository, guards: preHandlerAsyncHookHandler[]): void {
  server.post<AddVehicleRequest>(
    '/v1/me/vehicles',
    { onRequest: guards, schema: { body: addVehicleBodySchema, response: { 201: vehicleSchema } } },
    async (request, reply) => {
      const plate = readPlate(request.body.plate);
      if (plate === null) {
        return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'INVALID_PLATE', message: 'Invalid plate.' });
      }
      if (!isProvinceCode(request.body.province)) {
        return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'INVALID_PROVINCE', message: 'Choose a province.' });
      }
      const saved: Vehicle | null = await repository.saveVehicle(signedInDriver(request).id, { ...plate, province: request.body.province });
      if (saved === null) {
        return reply.status(CONFLICT).send({ statusCode: CONFLICT, error: 'VEHICLE_ALREADY_REGISTERED', message: 'This vehicle is already registered.' });
      }
      return reply.status(CREATED).send(saved);
    },
  );
}
