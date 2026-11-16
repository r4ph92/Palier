import { describe, expect, it } from 'vitest';
import { missingPrerequisitesOf, publicationOf, type PublicationFacts } from '../../src/domain/publication/lotPrerequisites.ts';
import { entreeNord, readyGarageRoyNord, sortieNord } from './fakes/publicationFixtures.ts';

describe('the prerequisites of putting a lot online', () => {
  it('finds nothing missing for Garage Roy Nord once everything is verified', () => {
    expect(missingPrerequisitesOf(readyGarageRoyNord())).toEqual([]);
  });

  it.each([
    ['Stripe not verified yet', { stripe: { kycStatus: 'PENDING' } }, 'STRIPE_NOT_VERIFIED'],
    ['no pricing, so no cap', { pricing: { dailyCapCents: null } }, 'PRICING_MISSING'],
    ['a capacity of zero', { spots: { inServiceCount: 4, capacity: 0 } }, 'CAPACITY_ZERO'],
    ['every spot out of service or retired', { spots: { inServiceCount: 0, capacity: 4 } }, 'NO_SPOT_IN_SERVICE'],
    ['no Wi-Fi attestation', { wifi: null }, 'WIFI_NOT_ATTESTED'],
    ['no cellular attestation', { cellular: null }, 'CELLULAR_NOT_ATTESTED'],
    ['no entry gate', { gates: [sortieNord] }, 'ENTRY_GATE_MISSING'],
    ['no exit gate', { gates: [entreeNord] }, 'EXIT_GATE_MISSING'],
  ] as const)('names %s', (_case, change: Partial<PublicationFacts>, code) => {
    expect(missingPrerequisitesOf(readyGarageRoyNord(change))).toEqual([{ code, gateId: null }]);
  });

  it('names each gate its controller has not verified yet', () => {
    const gates = [{ ...entreeNord, verifiedAt: null }, { ...sortieNord, verifiedAt: null }];

    expect(missingPrerequisitesOf(readyGarageRoyNord({ gates }))).toEqual([
      { code: 'GATE_UNVERIFIED', gateId: entreeNord.id },
      { code: 'GATE_UNVERIFIED', gateId: sortieNord.id },
    ]);
  });

  it('lists everything a new lot lacks, in the checklist order', () => {
    const newLot = readyGarageRoyNord({ stripe: { kycStatus: 'NOT_STARTED' }, pricing: { dailyCapCents: null }, spots: { inServiceCount: 0, capacity: 0 }, wifi: null, cellular: null, gates: [] });

    expect(missingPrerequisitesOf(newLot).map(({ code }) => code)).toEqual([
      'STRIPE_NOT_VERIFIED',
      'PRICING_MISSING',
      'CAPACITY_ZERO',
      'NO_SPOT_IN_SERVICE',
      'WIFI_NOT_ATTESTED',
      'CELLULAR_NOT_ATTESTED',
      'ENTRY_GATE_MISSING',
      'EXIT_GATE_MISSING',
    ]);
  });

  it('keeps the facts beside what is missing', () => {
    const facts = readyGarageRoyNord({ wifi: null });

    expect(publicationOf(facts)).toEqual({ ...facts, missing: [{ code: 'WIFI_NOT_ATTESTED', gateId: null }] });
  });
});
