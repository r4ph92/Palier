import type { LotPublication, MissingPrerequisite, MissingPrerequisiteCode, PublicationGate } from '@palier/shared-types';

// What the checklist reads about a lot, before it is judged.
export type PublicationFacts = Omit<LotPublication, 'missing'>;

type LotPrerequisiteCode = Exclude<MissingPrerequisiteCode, 'GATE_UNVERIFIED'>;

export function publicationOf(facts: PublicationFacts): LotPublication {
  return { ...facts, missing: missingPrerequisitesOf(facts) };
}

// Empty exactly when the lot may go online, in the order the checklist shows the lines.
export function missingPrerequisitesOf(facts: PublicationFacts): MissingPrerequisite[] {
  const lotPrerequisites: readonly (readonly [LotPrerequisiteCode, boolean])[] = [
    ['STRIPE_NOT_VERIFIED', facts.stripe.kycStatus === 'VERIFIED'],
    ['PRICING_MISSING', facts.pricing.dailyCapCents !== null],
    ['CAPACITY_ZERO', facts.spots.capacity >= 1],
    ['NO_SPOT_IN_SERVICE', facts.spots.inServiceCount >= 1],
    ['WIFI_NOT_ATTESTED', facts.wifi !== null],
    ['CELLULAR_NOT_ATTESTED', facts.cellular !== null],
    ['ENTRY_GATE_MISSING', hasGateOfKind(facts.gates, 'ENTRY')],
    ['EXIT_GATE_MISSING', hasGateOfKind(facts.gates, 'EXIT')],
  ];
  const unmet = lotPrerequisites.filter(([, isMet]) => !isMet).map(([code]) => ({ code, gateId: null }));
  return [...unmet, ...unverifiedGatesOf(facts.gates)];
}

function hasGateOfKind(gates: readonly PublicationGate[], kind: PublicationGate['kind']): boolean {
  return gates.some((gate) => gate.kind === kind);
}

function unverifiedGatesOf(gates: readonly PublicationGate[]): MissingPrerequisite[] {
  return gates.filter(({ verifiedAt }) => verifiedAt === null).map(({ id }) => ({ code: 'GATE_UNVERIFIED', gateId: id }));
}
