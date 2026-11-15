import { describe, expect, it } from 'vitest';
import { timelineOf } from '../../src/domain/dashboard/sessionTimeline.ts';
import type { StoredSessionEvent } from '../../src/domain/dashboard/SessionTimelineRepository.ts';
import type { SessionEvent } from '../../src/domain/sessionEvents/SessionEvent.ts';

const AT = new Date('2026-11-15T14:00:00.000Z');

function stored(sequence: number, event: SessionEvent): StoredSessionEvent {
  return { sequence, kind: event.kind, occurredAt: AT, payload: event.payload };
}

const GATE = '00000000-0000-4000-8000-0000000000a1';
const SPOT = '00000000-0000-4000-8000-0000000000b2';

describe('the timeline of a session', () => {
  it.each([
    [
      { kind: 'ENTRY_SCANNED', payload: { plate: 'ABC 123', gateId: GATE, spotId: SPOT, spotNumber: 'A-1', aisleCode: 'A', levelCode: 'P1' } },
      { spotNumber: 'A-1' },
    ],
    [{ kind: 'GATE_OPENED', payload: { direction: 'ENTRY', gateId: GATE, commandId: 'command-1' } }, { direction: 'ENTRY' }],
    [{ kind: 'GATE_OPENED', payload: { direction: 'EXIT', gateId: GATE, commandId: 'command-2' } }, { direction: 'EXIT' }],
    [{ kind: 'ENTRY_LOOP_CLOSED', payload: { gateId: GATE } }, {}],
    [{ kind: 'AISLE_DETECTED', payload: { aisleId: SPOT, aisleCode: 'B', beaconMinor: 7, isAssignedAisle: false } }, { aisleCode: 'B', isAssignedAisle: false }],
    [{ kind: 'PARKING_PRESUMED', payload: { evidence: 'ON_FOOT', spotId: SPOT, spotNumber: 'A-1' } }, { evidence: 'ON_FOOT', spotNumber: 'A-1' }],
    [{ kind: 'PARKING_PRESUMED', payload: { evidence: 'TIMEOUT', spotId: SPOT, spotNumber: 'A-1' } }, { evidence: 'TIMEOUT', spotNumber: 'A-1' }],
    [{ kind: 'PARKING_CONFIRMED', payload: { spotId: SPOT, spotNumber: 'B-2' } }, { spotNumber: 'B-2' }],
    [{ kind: 'ENTRY_CANCELLED', payload: { reason: 'NO_LOOP', wasBarrierOpened: true } }, { reason: 'NO_LOOP' }],
    [{ kind: 'ENTRY_CANCELLED', payload: { reason: 'ADMISSION_FAILED' } }, { reason: 'ADMISSION_FAILED' }],
    [{ kind: 'EXIT_IDENTIFIED', payload: { method: 'PLATE', gateId: GATE } }, { method: 'PLATE' }],
    [{ kind: 'CAPTURED', payload: { capturedCents: 1200, surplusPaidCents: 300, unpaidCents: 100 } }, { amountCents: 1500, unpaidCents: 100 }],
    [{ kind: 'CAPTURE_PENDING', payload: { pendingCaptureCents: 1200, pendingSurplusCents: 0 } }, { amountCents: 1200 }],
    [{ kind: 'EXIT_LOOP_CLOSED', payload: { gateId: GATE } }, {}],
  ] satisfies [SessionEvent, object][])('shows only the whitelisted facts of %j', (event, details) => {
    const [entry] = timelineOf([stored(1, event)]);

    expect(entry).toEqual({ sequence: 1, kind: event.kind, occurredAt: AT.toISOString(), details });
  });

  it('follows the order of writing, not the clock of each step', () => {
    const early = { ...stored(2, { kind: 'ENTRY_LOOP_CLOSED', payload: { gateId: GATE } }), occurredAt: new Date('2026-11-15T13:00:00.000Z') };
    const late = { ...stored(1, { kind: 'GATE_OPENED', payload: { direction: 'ENTRY', gateId: GATE, commandId: 'c' } }), occurredAt: new Date('2026-11-15T15:00:00.000Z') };

    expect(timelineOf([early, late]).map(({ kind }) => kind)).toEqual(['GATE_OPENED', 'ENTRY_LOOP_CLOSED']);
  });

  it('keeps the written order of steps sharing one instant', () => {
    const events = [1, 2, 3].map((sequence) => stored(sequence, { kind: 'ENTRY_LOOP_CLOSED', payload: { gateId: GATE } }));

    expect(timelineOf([...events].reverse()).map(({ sequence }) => sequence)).toEqual([1, 2, 3]);
  });

  it('shows a kind it does not know as a step with its time only', () => {
    const [entry] = timelineOf([{ sequence: 4, kind: 'SPOT_TAKEN_REPORTED', occurredAt: AT, payload: { spotId: SPOT, reporter: 'driver@palier.test' } }]);

    expect(entry).toEqual({ sequence: 4, kind: 'UNKNOWN', occurredAt: AT.toISOString(), details: {} });
  });

  it('leaves out a field the payload lacks or holds with the wrong type, and never fails', () => {
    const entries = timelineOf([
      { sequence: 1, kind: 'CAPTURED', occurredAt: AT, payload: { capturedCents: '1200' } },
      { sequence: 2, kind: 'GATE_OPENED', occurredAt: AT, payload: null },
      { sequence: 3, kind: 'EXIT_IDENTIFIED', occurredAt: AT, payload: { method: 'FACE' } },
      { sequence: 4, kind: 'CAPTURED', occurredAt: AT, payload: { capturedCents: 900 } },
    ]);

    expect(entries.map(({ details }) => details)).toEqual([{}, {}, {}, { amountCents: 900 }]);
  });

  it('never carries an id, a command, a plate or a beacon', () => {
    const everything = timelineOf([
      stored(1, { kind: 'ENTRY_SCANNED', payload: { plate: 'ABC 123', gateId: GATE, spotId: SPOT, spotNumber: 'A-1', aisleCode: 'A', levelCode: 'P1' } }),
      stored(2, { kind: 'GATE_OPENED', payload: { direction: 'ENTRY', gateId: GATE, commandId: 'command-1' } }),
      stored(3, { kind: 'AISLE_DETECTED', payload: { aisleId: SPOT, aisleCode: 'B', beaconMinor: 7, isAssignedAisle: true } }),
      stored(4, { kind: 'EXIT_IDENTIFIED', payload: { method: 'APP', gateId: GATE } }),
    ]);

    const text = JSON.stringify(everything);

    for (const hidden of [GATE, SPOT, 'command-1', 'ABC 123', 'gateId', 'spotId', 'aisleId', 'beaconMinor', 'commandId', 'plate']) {
      expect(text).not.toContain(hidden);
    }
  });
});
