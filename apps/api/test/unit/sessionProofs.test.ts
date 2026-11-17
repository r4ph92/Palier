import { describe, expect, it } from 'vitest';
import { lastProofOf, type SessionProofs } from '../../src/domain/parkingSessions/sessionProofs.ts';

const AT = (hour: number): Date => new Date(`2026-11-01T${String(hour).padStart(2, '0')}:00:00Z`);

const NONE: SessionProofs = { entryConfirmedAt: null, parkedAt: null, presumedBy: null, parkedAnsweredAt: null, presenceConfirmedAt: null };

describe('lastProofOf', () => {
  it('has no proof before the entry is confirmed', () => {
    expect(lastProofOf(NONE)).toBeNull();
  });

  it('is the entry when nothing came after it', () => {
    expect(lastProofOf({ ...NONE, entryConfirmedAt: AT(9) })).toEqual({ at: AT(9), kind: 'ENTRY' });
  });

  it('takes the walk to the spot only when a walk presumed the parking', () => {
    const walked = { ...NONE, entryConfirmedAt: AT(9), parkedAt: AT(10) };

    expect(lastProofOf({ ...walked, presumedBy: 'WALK' })).toEqual({ at: AT(10), kind: 'PARKED_ON_FOOT' });
    expect(lastProofOf({ ...walked, presumedBy: 'TIMEOUT' })).toEqual({ at: AT(9), kind: 'ENTRY' });
  });

  it('is the newest of the answer and the presence check', () => {
    const answered = { ...NONE, entryConfirmedAt: AT(9), parkedAnsweredAt: AT(11) };

    expect(lastProofOf(answered)).toEqual({ at: AT(11), kind: 'ANSWERED' });
    expect(lastProofOf({ ...answered, presenceConfirmedAt: AT(12) })).toEqual({ at: AT(12), kind: 'PRESENCE' });
  });
});
