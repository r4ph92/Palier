import type { DashboardSessionDetail, DashboardSessionRow, TimelineEntry } from '@palier/shared-types';
import { parkingDemo } from './fakeDashboardData.ts';

export const OPEN_SESSION_ID = '00000000-0000-4000-8000-000000000801';
export const PAID_SESSION_ID = '00000000-0000-4000-8000-000000000802';
export const UNPAID_SESSION_ID = '00000000-0000-4000-8000-000000000803';
export const PENDING_SESSION_ID = '00000000-0000-4000-8000-000000000804';

export interface FakeVisit {
  readonly id: string;
  readonly detail: DashboardSessionDetail;
}

export function rowOf({ id, detail: { summary } }: FakeVisit): DashboardSessionRow {
  const { plate, state, entryAt, exitAt, assignedSpotNumber, amountCents } = summary;
  return { id, plate, state, entryAt, exitAt, assignedSpotNumber, amountCents };
}

export type StepAt = readonly [step: number, kind: TimelineEntry['kind'], time: string];

export function stepOf([step, kind, time]: StepAt, details: TimelineEntry['details'] = {}): TimelineEntry {
  return { step, kind, occurredAt: `2026-11-15T${time}.000Z`, details };
}

const ENTRY_STEPS: TimelineEntry[] = [
  stepOf([1, 'ENTRY_SCANNED', '14:00:00'], { spotNumber: 'A-1' }),
  stepOf([2, 'GATE_OPENED', '14:00:01'], { direction: 'ENTRY' }),
  stepOf([3, 'ENTRY_LOOP_CLOSED', '14:00:05']),
  stepOf([4, 'AISLE_DETECTED', '14:01:00'], { aisleCode: 'B', isAssignedAisle: false }),
  stepOf([5, 'PARKING_PRESUMED', '14:02:00'], { evidence: 'ON_FOOT', spotNumber: 'A-1' }),
];

const BASE_SUMMARY = {
  plate: 'JTR 482',
  state: 'ENTRY_CONFIRMED',
  assignedSpotNumber: 'A-1',
  realSpotNumber: null,
  parkingEvidence: null,
  exitMethod: null,
  amountCents: null,
  unpaidCents: 0,
  entryAt: '2026-11-15T14:00:00.000Z',
  exitAt: null,
} as const;

function visitOf(id: string, summary: Partial<DashboardSessionDetail['summary']>, timeline: TimelineEntry[]): FakeVisit {
  return { id, detail: { lotName: parkingDemo.name, summary: { ...BASE_SUMMARY, ...summary }, timeline } };
}

const LEFT = { exitAt: '2026-11-15T16:00:02.000Z', exitMethod: 'PLATE', parkingEvidence: 'ON_FOOT', realSpotNumber: 'A-1' } as const;
const EXIT_STEPS: TimelineEntry[] = [
  stepOf([6, 'EXIT_IDENTIFIED', '16:00:00'], { method: 'PLATE' }),
  stepOf([7, 'GATE_OPENED', '16:00:01'], { direction: 'EXIT' }),
];

// Newest entry first, as the API lists them: one vehicle inside, then a paid stay, one with a refused balance, one whose capture is pending.
export function seededSessions(): Map<string, FakeVisit[]> {
  const inside = visitOf(OPEN_SESSION_ID, { entryAt: '2026-11-15T15:00:00.000Z' }, ENTRY_STEPS.slice(0, 4));
  const paid = visitOf(PAID_SESSION_ID, { ...LEFT, plate: 'MGA 315', state: 'CLOSED_PAID', amountCents: 1200 }, [
    ...ENTRY_STEPS,
    ...EXIT_STEPS,
    stepOf([8, 'CAPTURED', '16:00:02'], { amountCents: 1200, unpaidCents: 0 }),
    stepOf([9, 'EXIT_LOOP_CLOSED', '16:00:08']),
  ]);
  const unpaid = visitOf(UNPAID_SESSION_ID, { ...LEFT, plate: 'ELC 907', state: 'CLOSED_PAID', amountCents: 2500, unpaidCents: 300, entryAt: '2026-11-14T10:00:00.000Z' }, [
    ...EXIT_STEPS,
    stepOf([8, 'CAPTURED', '16:00:02'], { amountCents: 2500, unpaidCents: 300 }),
  ]);
  const pending = visitOf(PENDING_SESSION_ID, { ...LEFT, plate: 'NBD 660', state: 'CLOSED_CAPTURE_PENDING', amountCents: 1200, entryAt: '2026-11-13T10:00:00.000Z' }, [
    ...EXIT_STEPS,
    stepOf([8, 'CAPTURE_PENDING', '16:00:02'], { amountCents: 1200 }),
  ]);
  return new Map([[parkingDemo.id, [inside, paid, unpaid, pending]]]);
}
