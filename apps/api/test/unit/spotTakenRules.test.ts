import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import { reportPlanOf } from '../../src/domain/parkingSessions/SpotTakenReport.ts';
import type { SpotState } from '../../src/domain/spots/spotStates.ts';

function planFor(sessionState: EntrySessionState, reportedNumber = 'A-1', assignedSpotState: SpotState = 'OCCUPIED') {
  return reportPlanOf({ sessionState, assignedSpot: { number: 'A-1', state: assignedSpotState }, reportedNumber });
}

describe('which session may report its spot taken (story #23)', () => {
  it('takes the report of a session through the gate, not parked yet, and flags its occupied spot', () => {
    expect(planFor('ENTRY_CONFIRMED')).toEqual({ outcome: 'report', flagsReported: true });
  });

  it.each([
    ['CREATED', 'entry-not-confirmed'],
    ['PARKED_PRESUMED', 'already-parked'],
    ['PARKED_UNCONFIRMED', 'already-parked'],
    ['PARKED_CONFIRMED', 'already-parked'],
    ['CANCELLED', 'closed'],
  ] as const)('refuses a session %s with %s', (state, refusal) => {
    expect(planFor(state)).toEqual({ outcome: 'refused', refusal });
  });
});

describe('which spot the report names', () => {
  it.each(['A-1', 'a1', ' a - 1 '])('takes « %s » as Julie\'s assigned A-1', (reportedNumber) => {
    expect(planFor('ENTRY_CONFIRMED', reportedNumber)).toMatchObject({ outcome: 'report' });
  });

  it('refuses a report naming A-2, no longer or never her spot, so a retry after a reassignment changes nothing', () => {
    expect(planFor('ENTRY_CONFIRMED', 'A-2')).toEqual({ outcome: 'refused', refusal: 'spot-not-assigned' });
  });

  it.each(['OCCUPIED_UNKNOWN', 'AVAILABLE', 'OUT_OF_SERVICE'] as const)('reassigns without flagging A-1 when an operator moved it to %s', (state) => {
    expect(planFor('ENTRY_CONFIRMED', 'A-1', state)).toEqual({ outcome: 'report', flagsReported: false });
  });
});
