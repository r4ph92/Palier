import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { hasSpotHoldEnded, type SpotHold } from '../../../src/domain/spotHolds/SpotHold.ts';
import { SpotHoldRefusedError } from '../../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldDraft, SpotHoldExpiry, SpotHoldLot, SpotHoldRelease, SpotHoldRepository, UsableSpotHoldQuery } from '../../../src/domain/spotHolds/SpotHoldRepository.ts';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import { LAVOIE_ACCOUNT, PARKING_DEMO_POLICY } from './entryGateFakes.ts';


export const parkingDemoSpotHoldLot: SpotHoldLot = {
  id: PARKING_DEMO_ID,
  isOnline: true,
  pricingPolicy: PARKING_DEMO_POLICY,
  dailyCapCents: 2500,
  operatorStripeAccountId: LAVOIE_ACCOUNT,
};

const garageRoySpotHoldLot: SpotHoldLot = { ...parkingDemoSpotHoldLot, id: GARAGE_ROY_ID, isOnline: false, operatorStripeAccountId: null };

const LOT_NAMES: Readonly<Record<string, string>> = { [PARKING_DEMO_ID]: 'Parking Démo', [GARAGE_ROY_ID]: 'Garage Roy' };

export function fakeSpotHoldId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(900 + sequence).padStart(12, '0')}`;
}

// Applies no lot rule of its own: refusals under the lock are scripted with refusal, the real ones are proven on scripted SQL.
export class FakeSpotHoldRepository implements SpotHoldRepository {
  readonly drafts: SpotHoldDraft[] = [];
  readonly releases: SpotHoldRelease[] = [];
  readonly expiries: { readonly lotId: string; readonly now: Date }[] = [];
  freedSpots = 0;
  readonly lots: Map<string, SpotHoldLot>;
  refusal: SpotHoldRefusalCode | null = null;
  readonly #active = new Map<string, SpotHold>();

  constructor(lots: readonly SpotHoldLot[] = [parkingDemoSpotHoldLot, garageRoySpotHoldLot]) {
    this.lots = new Map(lots.map((lot) => [lot.id, lot]));
  }

  findActiveSpotHold(driverId: string): Promise<SpotHold | null> {
    return Promise.resolve(this.#active.get(driverId) ?? null);
  }

  findOwnActiveSpotHold(driverId: string, spotHoldId: string): Promise<SpotHold | null> {
    const spotHold = this.#active.get(driverId);
    return Promise.resolve(spotHold?.id === spotHoldId ? spotHold : null);
  }

  hasUsableSpotHold({ driverId, lotId, now }: UsableSpotHoldQuery): Promise<boolean> {
    const spotHold = this.#active.get(driverId);
    return Promise.resolve(spotHold?.lotId === lotId && !hasSpotHoldEnded(spotHold, now));
  }

  // Seeds a hold already taken, as placeSpotHold would have left it.
  seed(driverId: string, spotHold: SpotHold): void {
    this.#active.set(driverId, spotHold);
  }

  findSpotHoldLot(lotId: string): Promise<SpotHoldLot | null> {
    return Promise.resolve(this.lots.get(lotId) ?? null);
  }

  placeSpotHold(draft: SpotHoldDraft): Promise<SpotHold> {
    this.drafts.push(draft);
    if (this.refusal !== null) {
      return Promise.reject(new SpotHoldRefusedError(this.refusal));
    }
    const spotHold = { id: fakeSpotHoldId(this.drafts.length), lotId: draft.lotId, lotName: LOT_NAMES[draft.lotId] ?? 'Parking', expiresAt: draft.expiresAt };
    this.#active.set(draft.driverId, spotHold);
    return Promise.resolve(spotHold);
  }

  releaseSpotHold(release: SpotHoldRelease): Promise<void> {
    this.releases.push(release);
    if (this.refusal !== null) {
      return Promise.reject(new SpotHoldRefusedError(this.refusal));
    }
    this.#active.delete(release.driverId);
    return Promise.resolve();
  }

  findLotsWithExpiredHolds(now: Date): Promise<string[]> {
    const lotIds = [...this.#active.values()].filter(({ expiresAt }) => expiresAt <= now).map(({ lotId }) => lotId);
    return Promise.resolve([...new Set(lotIds)]);
  }

  // Frees one spot per hold it ends, like the real repository under the lot lock.
  expireLotSpotHolds(lotId: string, now: Date): Promise<SpotHoldExpiry> {
    this.expiries.push({ lotId, now });
    const ended = [...this.#active].filter(([, spotHold]) => spotHold.lotId === lotId && spotHold.expiresAt <= now);
    ended.forEach(([driverId]) => this.#active.delete(driverId));
    this.freedSpots += ended.length;
    return Promise.resolve({ expired: ended.length, freed: ended.length });
  }
}
