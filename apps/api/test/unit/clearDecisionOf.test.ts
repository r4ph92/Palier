import { describe, expect, it } from 'vitest';
import { clearDecisionOf } from '../../src/domain/dashboard/clearDecisionOf.ts';
import { SPOT_STATES } from '../../src/domain/spots/spotStates.ts';

describe('deciding whether a flagged spot can be cleared', () => {
  it('clears a flagged spot that is free and held by no session', () => {
    expect(clearDecisionOf({ state: 'AVAILABLE', needsCheck: true, heldBySession: false })).toBe('CLEAR');
  });

  it.each(SPOT_STATES)('refuses a flagged spot that is %s while an active session points at it, as still assigned', (state) => {
    expect(clearDecisionOf({ state, needsCheck: true, heldBySession: true })).toBe('SPOT_STILL_ASSIGNED');
  });

  it.each(['HELD', 'ASSIGNED'] as const)('refuses a flagged spot that is %s with no session yet, as still assigned', (state) => {
    expect(clearDecisionOf({ state, needsCheck: true, heldBySession: false })).toBe('SPOT_STILL_ASSIGNED');
  });

  it.each(['OUT_OF_SERVICE', 'OCCUPIED_UNKNOWN', 'OCCUPIED'] as const)('refuses a flagged spot that is %s with no session, as not free', (state) => {
    expect(clearDecisionOf({ state, needsCheck: true, heldBySession: false })).toBe('SPOT_NOT_FREE');
  });

  it('leaves a spot that is not flagged as it is, whatever holds it', () => {
    expect(clearDecisionOf({ state: 'ASSIGNED', needsCheck: false, heldBySession: true })).toBe('ALREADY_CLEAR');
  });
});
