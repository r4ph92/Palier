import { findDriverPrerequisites, type DriverPrerequisites, type DriverPrerequisiteSources } from '../drivers/driverPrerequisites.ts';
import { hasRoomForAnotherVehicle } from '../occupancy/hasRoomForAnotherVehicle.ts';
import { isOperatorPayable } from '../payments/isOperatorPayable.ts';
import { PricingPolicyInvalidError, readLotPricing, type PricingPolicy } from '../pricing/PricingPolicy.ts';
import type { EntryGate, EntryGateLot, EntryGateRepository } from './EntryGateRepository.ts';
import { EntryRefusedError } from './EntryRefusedError.ts';
import { isSignedWith, readGateToken } from './gateToken.ts';

export interface EntryPolicy {
  readonly allowPlatformChargesWithoutOperatorAccount: boolean;
}

export interface EntryEligibilityDependencies extends DriverPrerequisiteSources {
  readonly gates: EntryGateRepository;
  readonly policy: EntryPolicy;
}

export interface EntryAttempt {
  readonly driverId: string;
  readonly qrContent: string;
}

export interface EligibleEntry {
  readonly driverId: string;
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

  async check({ driverId, qrContent }: EntryAttempt): Promise<EligibleEntry> {
    const gate = await this.#recognizedGate(qrContent);
    this.#ensureGateAdmitsEntries(gate);
    const pricing = lotPricing(gate.lot);
    const prerequisites = await this.#driverPrerequisites(driverId);
    return {
      driverId,
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

  #ensureGateAdmitsEntries(gate: EntryGate): void {
    if (gate.kind !== 'ENTRY') {
      throw new EntryRefusedError('NOT_AN_ENTRY_GATE');
    }
    if (!gate.lot.isOnline) {
      throw new EntryRefusedError('LOT_NOT_IN_SERVICE');
    }
    if (gate.integrationKind !== 'SIMULATED') {
      throw new EntryRefusedError('GATE_UNAVAILABLE');
    }
    if (!isOperatorPayable(gate.lot.operatorStripeAccountId, this.#dependencies.policy)) {
      throw new EntryRefusedError('OPERATOR_NOT_PAYABLE');
    }
    if (!hasRoomForAnotherVehicle(gate.lot)) {
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
function lotPricing(lot: EntryGateLot): PricingPolicy {
  const pricing = readLotPricing(lot);
  if (pricing instanceof PricingPolicyInvalidError) {
    throw new EntryRefusedError('LOT_NOT_IN_SERVICE', { cause: pricing });
  }
  return pricing;
}
