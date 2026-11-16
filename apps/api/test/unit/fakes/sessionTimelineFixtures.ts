import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import type { StoredSessionEvent } from '../../../src/domain/dashboard/SessionTimelineRepository.ts';
import type { FakeStoredSession } from './fakeSessionTimelineRepository.ts';

export const GATE_ID = '00000000-0000-4000-8000-0000000000a1';
export const SPOT_ID = '00000000-0000-4000-8000-0000000000b2';

let counter = 0;

export function sessionIdOf(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

// A session still inside Parking Démo; the overrides turn it into any other stay.
export function sessionOf(overrides: Partial<FakeStoredSession> = {}): FakeStoredSession {
  counter += 1;
  return {
    id: sessionIdOf(counter),
    lotId: PARKING_DEMO_ID,
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
    events: [],
    ...overrides,
  };
}

export function eventOf(sequence: number, kind: string, payload: unknown): StoredSessionEvent {
  return { sequence, kind, payload, occurredAt: new Date('2026-11-15T14:00:00.000Z') };
}

function at(time: string, event: StoredSessionEvent): StoredSessionEvent {
  return { ...event, occurredAt: new Date(`2026-11-15T${time}.000Z`) };
}

// Julie's whole visit: in, walked away, answered, out by plate, paid.
export function fullVisitEvents(): StoredSessionEvent[] {
  return [
    eventOf(1, 'ENTRY_SCANNED', { plate: 'ABC 123', gateId: GATE_ID, spotId: SPOT_ID, spotNumber: 'A-1', aisleCode: 'A', levelCode: 'P1' }),
    at('14:00:01', eventOf(2, 'GATE_OPENED', { direction: 'ENTRY', gateId: GATE_ID, commandId: 'command-1' })),
    at('14:00:05', eventOf(3, 'ENTRY_LOOP_CLOSED', { gateId: GATE_ID })),
    at('14:01:00', eventOf(4, 'AISLE_DETECTED', { aisleId: SPOT_ID, aisleCode: 'A', beaconMinor: 3, isAssignedAisle: true })),
    at('14:02:00', eventOf(5, 'PARKING_PRESUMED', { evidence: 'ON_FOOT', spotId: SPOT_ID, spotNumber: 'A-1' })),
    at('16:00:00', eventOf(6, 'EXIT_IDENTIFIED', { method: 'PLATE', gateId: GATE_ID })),
    at('16:00:01', eventOf(7, 'GATE_OPENED', { direction: 'EXIT', gateId: GATE_ID, commandId: 'command-2' })),
    at('16:00:02', eventOf(8, 'CAPTURED', { capturedCents: 1200, surplusPaidCents: 0, unpaidCents: 0 })),
    at('16:00:08', eventOf(9, 'EXIT_LOOP_CLOSED', { gateId: GATE_ID })),
  ];
}
