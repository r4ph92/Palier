import type { SavedCard } from '@palier/shared-types';
import type { Driver } from '../../src/domain/drivers/Driver.ts';
import type { DriverRepository } from '../../src/domain/drivers/DriverRepository.ts';
import { hashSessionToken } from '../../src/domain/drivers/driverSessions.ts';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';

export const julie: Driver = { id: '00000000-0000-4000-8000-000000000501', firstName: 'Julie', lastName: 'Tremblay' };
export const marc: Driver = { id: '00000000-0000-4000-8000-000000000502', firstName: 'Marc', lastName: 'Gagnon' };

interface SessionToken {
  readonly driverId: string;
  readonly expiresAt: Date;
  revokedAt: Date | null;
}

const SESSION_TOKEN_LIFETIME_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

function isActive(token: SessionToken, now: Date): boolean {
  return token.revokedAt === null && token.expiresAt > now;
}

export class FakeDriverRepository implements DriverRepository {
  readonly #drivers: readonly Driver[];
  readonly #sessionTokens = new Map<string, SessionToken>();
  readonly #noticeVersions = new Map<string, string>();
  readonly #stripeCustomerIds = new Map<string, string>();
  readonly #savedCards = new Map<string, { paymentMethodId: string; card: SavedCard }>();

  constructor(drivers: readonly Driver[] = [julie, marc]) {
    this.#drivers = drivers;
  }

  get activeTokenHashes(): readonly string[] {
    const now = new Date();
    return [...this.#sessionTokens].filter(([, token]) => isActive(token, now)).map(([tokenHash]) => tokenHash);
  }

  listDrivers(): Promise<readonly Driver[]> {
    return Promise.resolve(this.#drivers);
  }

  findDriver(driverId: string): Promise<Driver | null> {
    return Promise.resolve(this.#drivers.find((driver) => driver.id === driverId) ?? null);
  }

  saveSessionToken(driverId: string, tokenHash: string): Promise<void> {
    const expiresAt = new Date(Date.now() + SESSION_TOKEN_LIFETIME_MILLISECONDS);
    this.#sessionTokens.set(tokenHash, { driverId, expiresAt, revokedAt: null });
    return Promise.resolve();
  }

  findDriverBySessionToken(tokenHash: string): Promise<Driver | null> {
    const token = this.#sessionTokens.get(tokenHash);
    return token !== undefined && isActive(token, new Date()) ? this.findDriver(token.driverId) : Promise.resolve(null);
  }

  revokeSessionToken(tokenHash: string): Promise<void> {
    const token = this.#sessionTokens.get(tokenHash);
    if (token !== undefined && token.revokedAt === null) {
      token.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  revokeOldestSessionTokens(driverId: string, keep: number): Promise<void> {
    // Map keeps insertion order, so the first entries of a driver are its oldest tokens.
    const now = new Date();
    const driverTokens = [...this.#sessionTokens].filter(([, token]) => token.driverId === driverId && isActive(token, now));
    for (const [, token] of driverTokens.slice(0, Math.max(0, driverTokens.length - keep))) {
      token.revokedAt = now;
    }
    return Promise.resolve();
  }

  purgeEndedSessionTokens(endedBefore: Date): Promise<number> {
    let purged = 0;
    for (const [tokenHash, token] of this.#sessionTokens) {
      const revokedBefore = token.revokedAt !== null && token.revokedAt < endedBefore;
      if (token.expiresAt < endedBefore || revokedBefore) {
        this.#sessionTokens.delete(tokenHash);
        purged += 1;
      }
    }
    return Promise.resolve(purged);
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

export async function authorizationFor(repository: DriverRepository, driver: Driver, token = `${driver.firstName}-token`) {
  await repository.saveSessionToken(driver.id, hashSessionToken(token));
  return { authorization: `Bearer ${token}` };
}
