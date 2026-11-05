import { findDriverPrerequisites, type DriverPrerequisites, type DriverPrerequisiteSources } from '../drivers/driverPrerequisites.ts';
import { checkLotTerms, type LotTermsRefusal } from '../lots/lotTerms.ts';
import type { EntryPolicy } from '../payments/EntryPolicy.ts';
import { hasRoomForAnotherVehicle } from '../occupancy/hasRoomForAnotherVehicle.ts';
import type { PricingPolicy } from '../pricing/PricingPolicy.ts';
import type { SpotHoldRepository, UsableSpotHoldQuery } from '../spotHolds/SpotHoldRepository.ts';
import type { EntryGate, EntryGateRepository } from './EntryGateRepository.ts';
import { EntryRefusedError } from './EntryRefusedError.ts';
import { isSignedWith, readGateToken } from './gateToken.ts';

export interface EntryEligibilityDependencies extends DriverPrerequisiteSources {
  readonly gates: EntryGateRepository;
  readonly policy: EntryPolicy;
  readonly spotHolds: Pick<SpotHoldRepository, 'hasUsableSpotHold'>;
}

export interface EntryAttempt {
  readonly driverId: string;
  readonly qrContent: string;
  readonly now: Date;
}

export interface EligibleEntry {
  readonly driverId: string;
  readonly now: Date;
  readonly gate: { readonly id: string; readonly lotId: string };
  readonly vehicle: DriverPrerequisites['vehicle'];
  readonly payment: {
    readonly customerId: string;
    readonly paymentMethodId: string;
    readonly amountCents: number;
    readonly destinationAccountId: string | null;
  };
  readonly pricing: PricingPolicy;
}

// Every check reads only: nothing is written before the entry is known to be possible.
export class EntryEligibility {
  readonly #dependencies: EntryEligibilityDependencies;

  constructor(dependencies: EntryEligibilityDependencies) {
    this.#dependencies = dependencies;
  }

  async check({ driverId, qrContent, now }: EntryAttempt): Promise<EligibleEntry> {
    const gate = await this.#recognizedGate(qrContent);
    const pricing = this.#admittingLotPricing(gate);
    await this.#requireRoom({ driverId, lotId: gate.lot.id, now }, gate);
    const prerequisites = await this.#driverPrerequisites(driverId);
    return {
      driverId,
      now,
      gate: { id: gate.id, lotId: gate.lot.id },
      vehicle: prerequisites.vehicle,
      payment: {
        customerId: prerequisites.customerId,
        paymentMethodId: prerequisites.paymentMethodId,
        amountCents: gate.lot.dailyCapCents,
        destinationAccountId: gate.lot.operatorStripeAccountId,
      },
      pricing,
    };
  }

  // A malformed token, an unknown gate and a wrong signature get the same refusal, so a QR reveals nothing.
  async #recognizedGate(qrContent: string): Promise<EntryGate> {
    const token = readGateToken(qrContent);
    const gate = token === null ? null : await this.#dependencies.gates.findGate(token.gateId);
    if (token === null || gate === null || !isSignedWith(token, gate.qrSecret)) {
      throw new EntryRefusedError('QR_NOT_RECOGNIZED');
    }
    return gate;
  }

  #admittingLotPricing(gate: EntryGate): PricingPolicy {
    if (gate.kind !== 'ENTRY') {
      throw new EntryRefusedError('NOT_AN_ENTRY_GATE');
    }
    const terms = checkLotTerms(gate.lot, this.#dependencies.policy);
    if (!terms.accepted) {
      throw entryRefusalOf(terms.refusal);
    }
    if (gate.integrationKind !== 'SIMULATED') {
      throw new EntryRefusedError('GATE_UNAVAILABLE');
    }
    return terms.pricing;
  }

  // A live hold already counts in the lot's held spots: it is the driver's room, whatever else filled the lot.
  async #requireRoom(holder: UsableSpotHoldQuery, gate: EntryGate): Promise<void> {
    if (hasRoomForAnotherVehicle(gate.lot)) {
      return;
    }
    if (!(await this.#dependencies.spotHolds.hasUsableSpotHold(holder))) {
      throw new EntryRefusedError('LOT_FULL');
    }
  }

  async #driverPrerequisites(driverId: string): Promise<DriverPrerequisites> {
    const prerequisites = await findDriverPrerequisites(this.#dependencies, driverId);
    if (prerequisites === null) {
      throw new EntryRefusedError('PREREQUISITES_MISSING');
    }
    return prerequisites;
  }
}

// A lot without a usable price cannot bill a session, so it is out of service until its operator fixes the policy.
function entryRefusalOf(refusal: LotTermsRefusal): EntryRefusedError {
  switch (refusal.kind) {
    case 'offline':
      return new EntryRefusedError('LOT_NOT_IN_SERVICE');
    case 'operatorNotPayable':
      return new EntryRefusedError('OPERATOR_NOT_PAYABLE');
    case 'pricingInvalid':
      return new EntryRefusedError('LOT_NOT_IN_SERVICE', { cause: refusal.cause });
  }
}
