import type { DashboardStaleSession } from '@palier/shared-types';
import { parkingDemo } from './fakeDashboardData.ts';

export const JULIE_STALE_SESSION_ID = '00000000-0000-4000-8000-000000000981';
export const MARC_STALE_SESSION_ID = '00000000-0000-4000-8000-000000000982';

// Parking Démo as the story has it: Julie's vehicle flagged first, then Marc's, both with no exit for 7 days.
export function seededStaleSessions(): Map<string, DashboardStaleSession[]> {
  const flagged: DashboardStaleSession[] = [
    {
      id: JULIE_STALE_SESSION_ID,
      plate: 'JTR 482',
      spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
      lastProofAt: '2026-11-01T09:00:00.000Z',
      lastProofKind: 'ENTRY',
      flaggedAt: '2026-11-08T09:00:00.000Z',
    },
    {
      id: MARC_STALE_SESSION_ID,
      plate: 'MGA 913',
      spot: { number: 'B-2', levelCode: 'P1', aisleCode: 'B' },
      lastProofAt: '2026-11-01T10:30:00.000Z',
      lastProofKind: 'PRESENCE',
      flaggedAt: '2026-11-08T10:30:00.000Z',
    },
  ];
  return new Map([[parkingDemo.id, flagged]]);
}
