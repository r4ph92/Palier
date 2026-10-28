import type { Driver } from '../../src/domain/drivers/Driver.ts';
import type { DriverRepository } from '../../src/domain/drivers/DriverRepository.ts';
import { hashSessionToken } from '../../src/domain/drivers/driverSessions.ts';

export const julie: Driver = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie', lastName: 'Tremblay' };
export const marc: Driver = { id: '00000000-0000-4000-8000-000000000502', firstName: 'Marc', lastName: 'Gagnon' };

export class FakeDriverRepository implements DriverRepository {
  readonly #drivers: readonly Driver[];
  readonly #activeTokens = new Map<string, string>();

  constructor(drivers: readonly Driver[] = [julie, marc]) {
    this.#drivers = drivers;
  }

  get activeTokenHashes(): readonly string[] {
    return [...this.#activeTokens.keys()];
  }

  listDrivers(): Promise<readonly Driver[]> {
    return Promise.resolve(this.#drivers);
  }

  findDriver(driverId: string): Promise<Driver | null> {
    return Promise.resolve(this.#drivers.find((driver) => driver.id === driverId) ?? null);
  }

  saveSessionToken(driverId: string, tokenHash: string): Promise<void> {
    this.#activeTokens.set(tokenHash, driverId);
    return Promise.resolve();
  }

  findDriverBySessionToken(tokenHash: string): Promise<Driver | null> {
    const driverId = this.#activeTokens.get(tokenHash);
    return driverId === undefined ? Promise.resolve(null) : this.findDriver(driverId);
  }

  revokeSessionToken(tokenHash: string): Promise<void> {
    this.#activeTokens.delete(tokenHash);
    return Promise.resolve();
  }
}

export async function authorizationFor(repository: DriverRepository, driver: Driver, token = `${driver.firstName}-token`) {
  await repository.saveSessionToken(driver.id, hashSessionToken(token));
  return { authorization: `Bearer ${token}` };
}
