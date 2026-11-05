import { findDriverPrerequisites, type DriverPrerequisiteSources } from '../drivers/driverPrerequisites.ts';
import { checkLotTerms } from '../lots/lotTerms.ts';
import type { EntryPolicy } from '../payments/EntryPolicy.ts';
import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';
import { SpotHoldRefusedError } from './SpotHoldRefusedError.ts';
import type { SpotHoldLot, SpotHoldRepository } from './SpotHoldRepository.ts';

export interface SpotHoldEligibilityDependencies {
  readonly prerequisites: DriverPrerequisiteSources;
  readonly spotHolds: Pick<SpotHoldRepository, 'findActiveSpotHold' | 'findSpotHoldLot'>;
  readonly policy: EntryPolicy;
}

export interface SpotHoldAttempt {
  readonly driverId: string;
  readonly lotId: string;
}

export interface EligibleSpotHold extends SpotHoldAttempt {
  readonly needs: VehicleNeeds;
}

// Reads only, on the pool: the cheap refusals never wait for the lot lock.
export class SpotHoldEligibility {
  readonly #dependencies: SpotHoldEligibilityDependencies;

  constructor(dependencies: SpotHoldEligibilityDependencies) {
    this.#dependencies = dependencies;
  }

  async check({ driverId, lotId }: SpotHoldAttempt): Promise<EligibleSpotHold> {
    const needs = await this.#vehicleNeeds(driverId);
    if ((await this.#dependencies.spotHolds.findActiveSpotHold(driverId)) !== null) {
      throw new SpotHoldRefusedError('HOLD_ALREADY_EXISTS');
    }
    this.#ensureLotTakesSpotHolds(await this.#dependencies.spotHolds.findSpotHoldLot(lotId));
    return { driverId, lotId, needs };
  }

  async #vehicleNeeds(driverId: string): Promise<VehicleNeeds> {
    const prerequisites = await findDriverPrerequisites(this.#dependencies.prerequisites, driverId);
    if (prerequisites === null) {
      throw new SpotHoldRefusedError('PREREQUISITES_MISSING');
    }
    return prerequisites.vehicle.needs;
  }

  // A hold promises an entry, so any lot term an entry would refuse refuses the hold too.
  #ensureLotTakesSpotHolds(lot: SpotHoldLot | null): void {
    if (lot === null) {
      throw new SpotHoldRefusedError('LOT_NOT_FOUND');
    }
    const terms = checkLotTerms(lot, this.#dependencies.policy);
    if (!terms.accepted) {
      const cause = terms.refusal.kind === 'pricingInvalid' ? { cause: terms.refusal.cause } : undefined;
      throw new SpotHoldRefusedError('LOT_NOT_IN_SERVICE', cause);
    }
  }
}
