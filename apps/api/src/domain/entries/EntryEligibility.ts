import type { DriverRepository } from '../drivers/DriverRepository.ts';
import { parsePricingPolicy, PricingPolicyInvalidError, type PricingPolicy } from '../pricing/PricingPolicy.ts';
import type { VehicleRepository } from '../vehicles/VehicleRepository.ts';
import type { EntryGate, EntryGateLot, EntryGateRepository } from './EntryGateRepository.ts';
import { EntryRefusedError } from './EntryRefusedError.ts';
import { isSignedWith, readGateToken } from './gateToken.ts';

export interface EntryPolicy {
  readonly allowPlatformChargesWithoutOperatorAccount: boolean;
}

export interface EntryEligibilityDependencies {
  readonly gates: EntryGateRepository;
  readonly vehicles: Pick<VehicleRepository, 'findDefaultVehicle'>;
  readonly drivers: Pick<DriverRepository, 'findStripeCustomerId' | 'findDefaultPaymentMethodId'>;
  readonly policy: EntryPolicy;
}

export interface EntryAttempt {
  readonly driverId: string;
  readonly qrContent: string;
}

export interface EligibleEntry {
  readonly driverId: string;
  readonly gate: { readonly id: string; readonly lotId: string };
  readonly vehicle: { readonly id: string; readonly plate: string };
  readonly payment: {
    readonly customerId: string;
    readonly paymentMethodId: string;
    readonly amountCents: number;
    readonly destinationAccountId: string | null;
  };
  readonly pricing: PricingPolicy;
}

type DriverPrerequisites = Pick<EligibleEntry, 'vehicle'> & { readonly customerId: string; readonly paymentMethodId: string };

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
    if (gate.lot.operatorStripeAccountId === null && !this.#dependencies.policy.allowPlatformChargesWithoutOperatorAccount) {
      throw new EntryRefusedError('OPERATOR_NOT_PAYABLE');
    }
  }

  async #driverPrerequisites(driverId: string): Promise<DriverPrerequisites> {
    const { vehicles, drivers } = this.#dependencies;
    const [vehicle, customerId, paymentMethodId] = await Promise.all([
      vehicles.findDefaultVehicle(driverId),
      drivers.findStripeCustomerId(driverId),
      drivers.findDefaultPaymentMethodId(driverId),
    ]);
    if (vehicle === null || customerId === null || paymentMethodId === null) {
      throw new EntryRefusedError('PREREQUISITES_MISSING');
    }
    return { vehicle: { id: vehicle.id, plate: vehicle.plate }, customerId, paymentMethodId };
  }
}

// A lot without a usable price cannot bill a session, so it is out of service until its operator fixes the policy.
// The refusal keeps the parse error as its cause, so the route can log it.
function lotPricing(lot: EntryGateLot): PricingPolicy {
  try {
    return parsePricingPolicy(lot.pricingPolicy, lot.dailyCapCents);
  } catch (error) {
    if (!(error instanceof PricingPolicyInvalidError)) {
      throw error;
    }
    throw new EntryRefusedError('LOT_NOT_IN_SERVICE', { cause: error });
  }
}
