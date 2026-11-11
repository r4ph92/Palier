import type { Vehicle, VehicleListResponse } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import type { NewVehicleInput, VehicleClient, VehicleEdit } from './VehicleClient';
import { parseVehicle, parseVehicleList } from './parseVehicles';

const BAD_REQUEST = 400;
const CONFLICT = 409;

export type HttpVehicleClientOptions = AuthorizedClientOptions;

export class HttpVehicleClient implements VehicleClient {
  readonly #requester: AuthorizedRequester;

  constructor(options: HttpVehicleClientOptions) {
    this.#requester = new AuthorizedRequester(options, new Set([BAD_REQUEST, CONFLICT]));
  }

  async listVehicles(): Promise<VehicleListResponse> {
    return parseVehicleList(await readJson(await this.#requester.send('/v1/me/vehicles', { method: 'GET' })));
  }

  async addVehicle({ plate, province, isElectric, hasAccessiblePermit, isOversize }: NewVehicleInput): Promise<Vehicle> {
    const response = await this.#requester.send('/v1/me/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate, province, isElectric, hasAccessiblePermit, isOversize }),
    });
    return parseVehicle(await readJson(response));
  }

  async updateVehicleNeeds(vehicleId: string, { isElectric, hasAccessiblePermit, isOversize, transponder }: VehicleEdit): Promise<Vehicle> {
    const response = await this.#requester.send(`/v1/me/vehicles/${vehicleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isElectric, hasAccessiblePermit, isOversize, transponder }),
    });
    return parseVehicle(await readJson(response));
  }

  async setDefaultVehicle(vehicleId: string): Promise<Vehicle> {
    return parseVehicle(await readJson(await this.#requester.send(`/v1/me/vehicles/${vehicleId}/default`, { method: 'POST' })));
  }

  async deleteVehicle(vehicleId: string): Promise<void> {
    await this.#requester.send(`/v1/me/vehicles/${vehicleId}`, { method: 'DELETE' });
  }
}
