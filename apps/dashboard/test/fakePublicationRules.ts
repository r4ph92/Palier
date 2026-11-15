import type { LotPublication, MissingPrerequisite, MissingPrerequisiteCode } from '@palier/shared-types';

type PublicationFacts = Omit<LotPublication, 'missing'>;

// The API's rule (domain/publication/lotPrerequisites.ts), so the fake lists what the API would.
export function missingPrerequisitesOf(facts: PublicationFacts): MissingPrerequisite[] {
  const checks: readonly (readonly [MissingPrerequisiteCode, boolean])[] = [
    ['STRIPE_NOT_VERIFIED', facts.stripe.kycStatus === 'VERIFIED'],
    ['PRICING_MISSING', facts.pricing.dailyCapCents !== null],
    ['CAPACITY_ZERO', facts.spots.capacity > 0],
    ['NO_SPOT_IN_SERVICE', facts.spots.inServiceCount > 0],
    ['WIFI_NOT_ATTESTED', facts.wifi !== null],
    ['CELLULAR_NOT_ATTESTED', facts.cellular !== null],
    ['ENTRY_GATE_MISSING', facts.gates.some(({ kind }) => kind === 'ENTRY')],
    ['EXIT_GATE_MISSING', facts.gates.some(({ kind }) => kind === 'EXIT')],
  ];
  const unmet = checks.filter(([, isMet]) => !isMet).map(([code]) => ({ code, gateId: null }));
  const unverified = facts.gates.filter(({ verifiedAt }) => verifiedAt === null).map(({ id }) => ({ code: 'GATE_UNVERIFIED' as const, gateId: id }));
  return [...unmet, ...unverified];
}
