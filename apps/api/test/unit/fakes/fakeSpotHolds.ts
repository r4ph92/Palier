import type { SpotHoldRefusalCode } from '@palier/shared-types';
import type { SpotHold } from '../../../src/domain/spotHolds/SpotHold.ts';
import { SpotHoldRefusedError } from '../../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import type { SpotHoldDraft, SpotHoldLot, SpotHoldRepository } from '../../../src/domain/spotHolds/SpotHoldRepository.ts';
import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import { LAVOIE_ACCOUNT, PARKING_DEMO_POLICY } from './entryGateFakes.ts';

export const GARAGE_ROY_ID = '00000000-0000-4000-8000-000000000202';

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
  readonly lots: Map<string, SpotHoldLot>;
  refusal: SpotHoldRefusalCode | null = null;
  readonly #active = new Map<string, SpotHold>();

  constructor(lots: readonly SpotHoldLot[] = [parkingDemoSpotHoldLot, garageRoySpotHoldLot]) {
    this.lots = new Map(lots.map((lot) => [lot.id, lot]));
  }

  findActiveSpotHold(driverId: string): Promise<SpotHold | null> {
    return Promise.resolve(this.#active.get(driverId) ?? null);
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
}
