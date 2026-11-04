import type { SavedCard } from '@palier/shared-types';
import type { Driver } from '../../src/domain/drivers/Driver.ts';
import type { DriverRepository } from '../../src/domain/drivers/DriverRepository.ts';
import type { UserDirectory } from '../../src/domain/sessions/UserDirectory.ts';
import { hashSessionToken } from '../../src/domain/sessions/sessionTokens.ts';
import { FakeSessionTokenRepository } from './fakes/fakeSessionTokenRepository.ts';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';

export const julie: Driver = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie', lastName: 'Tremblay' };
export const marc: Driver = { id: '00000000-0000-4000-8000-000000000502', firstName: 'Marc', lastName: 'Gagnon' };

// Drivers and the user directory read the same user rows, so one fake plays both.
export class FakeDriverRepository implements DriverRepository, UserDirectory {
  readonly #drivers: readonly Driver[];
  // Session tokens join the same user rows, so the fake keeps them beside the drivers it knows.
  readonly sessions: FakeSessionTokenRepository;
  readonly #noticeVersions = new Map<string, string>();
  readonly #stripeCustomerIds = new Map<string, string>();
  readonly #savedCards = new Map<string, { paymentMethodId: string; card: SavedCard }>();

  constructor(drivers: readonly Driver[] = [julie, marc]) {
    this.#drivers = drivers;
    this.sessions = new FakeSessionTokenRepository(drivers);
  }

  findUser(userId: string): Promise<Driver | null> {
    return Promise.resolve(this.#drivers.find((driver) => driver.id === userId) ?? null);
  }

  findUsers(userIds: readonly string[]): Promise<readonly Driver[]> {
    return Promise.resolve(userIds.flatMap((userId) => this.#drivers.filter((driver) => driver.id === userId)));
  }

  findLatestNoticeVersion(driverId: string): Promise<string | null> {
    return Promise.resolve(this.#noticeVersions.get(driverId) ?? null);
  }

  hasLatestNoticeVersion(driverId: string, noticeVersion: string): Promise<boolean> {
    return Promise.resolve(this.#noticeVersions.get(driverId) === noticeVersion);
  }

  saveNoticeAcceptance(driverId: string, noticeVersion: string): Promise<void> {
    this.#noticeVersions.set(driverId, noticeVersion);
    return Promise.resolve();
  }

  findStripeCustomerId(driverId: string): Promise<string | null> {
    return Promise.resolve(this.#stripeCustomerIds.get(driverId) ?? null);
  }

  saveStripeCustomerIdIfMissing(driverId: string, stripeCustomerId: string): Promise<string> {
    if (!this.#stripeCustomerIds.has(driverId)) {
      this.#stripeCustomerIds.set(driverId, stripeCustomerId);
    }
    return Promise.resolve(this.#stripeCustomerIds.get(driverId) ?? stripeCustomerId);
  }

  findSavedCard(driverId: string): Promise<SavedCard | null> {
    return Promise.resolve(this.#savedCards.get(driverId)?.card ?? null);
  }

  saveSavedCard(driverId: string, paymentMethodId: string, card: SavedCard): Promise<void> {
    this.#savedCards.set(driverId, { paymentMethodId, card });
    return Promise.resolve();
  }

  findDefaultPaymentMethodId(driverId: string): Promise<string | null> {
    return Promise.resolve(this.#savedCards.get(driverId)?.paymentMethodId ?? null);
  }

  savedPaymentMethodId(driverId: string): string | null {
    return this.#savedCards.get(driverId)?.paymentMethodId ?? null;
  }
}

export async function acceptNoticeAs(repository: DriverRepository, driver: Driver, noticeVersion = PRIVACY_NOTICE_VERSION) {
  await repository.saveNoticeAcceptance(driver.id, noticeVersion);
}

const APP_TOKEN_LIFETIME_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

export async function authorizationFor(repository: FakeDriverRepository, driver: Driver, token = `${driver.firstName}-token`) {
  const expiresAt = new Date(Date.now() + APP_TOKEN_LIFETIME_MILLISECONDS);
  await repository.sessions.saveSessionToken({ userId: driver.id, tokenHash: hashSessionToken(token), scope: 'APP', expiresAt });
  return { authorization: `Bearer ${token}` };
}
