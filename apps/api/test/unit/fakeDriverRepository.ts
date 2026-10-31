import type { SavedCard } from '@palier/shared-types';
import type { Driver } from '../../src/domain/drivers/Driver.ts';
import type { DriverRepository } from '../../src/domain/drivers/DriverRepository.ts';
import { hashSessionToken } from '../../src/domain/drivers/driverSessions.ts';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';

export const julie: Driver = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie', lastName: 'Tremblay' };
export const marc: Driver = { id: '00000000-0000-4000-8000-000000000502', firstName: 'Marc', lastName: 'Gagnon' };

export class FakeDriverRepository implements DriverRepository {
  readonly #drivers: readonly Driver[];
  readonly #activeTokens = new Map<string, string>();
  readonly #noticeVersions = new Map<string, string>();
  readonly #stripeCustomerIds = new Map<string, string>();
  readonly #savedCards = new Map<string, { paymentMethodId: string; card: SavedCard }>();

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

  findLatestNoticeVersion(driverId: string): Promise<string | null> {
    return Promise.resolve(this.#noticeVersions.get(driverId) ?? null);
  }

  saveNoticeAcceptance(driverId: string, noticeVersion: string): Promise<void> {
    this.#noticeVersions.set(driverId, noticeVersion);
    return Promise.resolve();
  }

  findStripeCustomerId(driverId: string): Promise<string | null> {
    return Promise.resolve(this.#stripeCustomerIds.get(driverId) ?? null);
  }

  saveStripeCustomerId(driverId: string, stripeCustomerId: string): Promise<void> {
    this.#stripeCustomerIds.set(driverId, stripeCustomerId);
    return Promise.resolve();
  }

  findSavedCard(driverId: string): Promise<SavedCard | null> {
    return Promise.resolve(this.#savedCards.get(driverId)?.card ?? null);
  }

  saveSavedCard(driverId: string, paymentMethodId: string, card: SavedCard): Promise<void> {
    this.#savedCards.set(driverId, { paymentMethodId, card });
    return Promise.resolve();
  }

  savedPaymentMethodId(driverId: string): string | null {
    return this.#savedCards.get(driverId)?.paymentMethodId ?? null;
  }
}

export async function acceptNoticeAs(repository: DriverRepository, driver: Driver, noticeVersion = PRIVACY_NOTICE_VERSION) {
  await repository.saveNoticeAcceptance(driver.id, noticeVersion);
}

export async function authorizationFor(repository: DriverRepository, driver: Driver, token = `${driver.firstName}-token`) {
  await repository.saveSessionToken(driver.id, hashSessionToken(token));
  return { authorization: `Bearer ${token}` };
}
