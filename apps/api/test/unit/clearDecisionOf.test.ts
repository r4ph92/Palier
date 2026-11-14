import { describe, expect, it } from 'vitest';
import { clearDecisionOf } from '../../src/domain/dashboard/clearDecisionOf.ts';
import { SPOT_STATES } from '../../src/domain/spots/spotStates.ts';

describe('deciding whether a flagged spot can be cleared', () => {
  it('clears a flagged spot that is free and held by no session', () => {
    expect(clearDecisionOf({ state: 'AVAILABLE', needsCheck: true, heldBySession: false })).toBe('CLEAR');
  });

  it.each(SPOT_STATES.filter((state) => state !== 'AVAILABLE'))('refuses a flagged spot that is %s', (state) => {
    expect(clearDecisionOf({ state, needsCheck: true, heldBySession: false })).toBe('STILL_ASSIGNED');
  });

  it('refuses a free flagged spot an active session still points at', () => {
    expect(clearDecisionOf({ state: 'AVAILABLE', needsCheck: true, heldBySession: true })).toBe('STILL_ASSIGNED');
  });

  it('leaves a spot that is not flagged as it is, whatever holds it', () => {
    expect(clearDecisionOf({ state: 'ASSIGNED', needsCheck: false, heldBySession: true })).toBe('ALREADY_CLEAR');
  });
});
