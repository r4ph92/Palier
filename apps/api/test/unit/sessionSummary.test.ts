import { describe, expect, it } from 'vitest';
import { amountOf, parkingEvidenceOf, realSpotNumberOf, sessionRowOf, sessionSummaryOf } from '../../src/domain/dashboard/sessionSummary.ts';
import type { SessionRecord } from '../../src/domain/dashboard/SessionTimelineRepository.ts';

const INSIDE: SessionRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  plate: 'ABC 123',
  state: 'ENTRY_CONFIRMED',
  enteredAt: new Date('2026-11-15T14:00:00.000Z'),
  exitedAt: null,
  assignedSpotNumber: 'A-1',
  confirmedSpotNumber: null,
  presumedBy: null,
  wasAnswered: false,
  exitMethod: null,
  capturedCents: null,
  surplusPaidCents: 0,
  pendingCaptureCents: null,
  pendingSurplusCents: 0,
  unpaidCents: 0,
};

const LEFT_AT = new Date('2026-11-15T16:00:00.000Z');

describe('the amount of a session', () => {
  it('is nothing yet while the vehicle is inside', () => {
    expect(amountOf(INSIDE)).toBeNull();
  });

  it('is the receipt total once paid: the capture plus the surplus the card paid', () => {
    expect(amountOf({ ...INSIDE, state: 'CLOSED_PAID', exitedAt: LEFT_AT, capturedCents: 2500, surplusPaidCents: 300, unpaidCents: 200 })).toBe(2800);
  });

  it('is the pending capture and surplus when the vehicle left before Stripe answered', () => {
    expect(amountOf({ ...INSIDE, state: 'CLOSED_CAPTURE_PENDING', exitedAt: LEFT_AT, pendingCaptureCents: 1200, pendingSurplusCents: 150 })).toBe(1350);
  });

  it('does not count a retried capture twice: the pending amounts stay on the row after it is paid', () => {
    const retried = { ...INSIDE, state: 'CLOSED_PAID', exitedAt: LEFT_AT, capturedCents: 1200, pendingCaptureCents: 1200 } as const;

    expect(amountOf(retried)).toBe(1200);
  });

  it('is nothing for a cancelled entry', () => {
    expect(amountOf({ ...INSIDE, state: 'CANCELLED' })).toBeNull();
  });
});

describe('the proof that the vehicle is parked', () => {
  it.each([
    ['no walk yet', {}, null],
    ['presumed by the walk', { presumedBy: 'WALK' }, 'ON_FOOT'],
    ['presumed by the timeout', { presumedBy: 'TIMEOUT' }, 'TIMEOUT'],
    ['answered by the driver after a presumption', { presumedBy: 'WALK', wasAnswered: true }, 'ANSWERED'],
    ['answered with no presumption kept', { wasAnswered: true }, 'ANSWERED'],
  ] as const)('is %s', (_label, facts, evidence) => {
    expect(parkingEvidenceOf({ ...INSIDE, ...facts })).toBe(evidence);
  });
});

describe('the real spot of a session', () => {
  it('is unknown until the driver walked away', () => {
    expect(realSpotNumberOf(INSIDE)).toBeNull();
  });

  it('is the assigned spot once parking is presumed', () => {
    expect(realSpotNumberOf({ ...INSIDE, presumedBy: 'WALK' })).toBe('A-1');
  });

  it('is the spot the driver confirmed when it differs', () => {
    expect(realSpotNumberOf({ ...INSIDE, presumedBy: 'WALK', confirmedSpotNumber: 'B-2' })).toBe('B-2');
  });
});

describe('the list row and the summary of a session', () => {
  it('shows the assigned spot in the list and the times as instants', () => {
    expect(sessionRowOf({ ...INSIDE, confirmedSpotNumber: 'B-2' })).toEqual({
      id: INSIDE.id,
      plate: 'ABC 123',
      state: 'ENTRY_CONFIRMED',
      entryAt: '2026-11-15T14:00:00.000Z',
      exitAt: null,
      assignedSpotNumber: 'A-1',
      amountCents: null,
    });
  });

  it('gathers the facts of a paid stay', () => {
    const paid = { ...INSIDE, state: 'CLOSED_PAID', exitedAt: LEFT_AT, exitMethod: 'PLATE', capturedCents: 2500, presumedBy: 'WALK', unpaidCents: 100 } as const;

    expect(sessionSummaryOf(paid)).toEqual({
      plate: 'ABC 123',
      state: 'CLOSED_PAID',
      assignedSpotNumber: 'A-1',
      realSpotNumber: 'A-1',
      parkingEvidence: 'ON_FOOT',
      exitMethod: 'PLATE',
      amountCents: 2500,
      unpaidCents: 100,
      entryAt: '2026-11-15T14:00:00.000Z',
      exitAt: '2026-11-15T16:00:00.000Z',
    });
  });
});
