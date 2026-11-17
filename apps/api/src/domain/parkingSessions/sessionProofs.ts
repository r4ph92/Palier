import type { LastProofKind } from '@palier/shared-types/staleSessions';
import { MILLISECONDS_PER_HOUR } from '../time/durations.ts';
import type { PresumptionEvidence } from './PresumptionEvidence.ts';

// Q46: 7 days counted in hours, so the limit never moves with a daylight saving change.
export const STALE_AFTER_MILLISECONDS = 168 * MILLISECONDS_PER_HOUR;

// The stored instants that can prove the vehicle is still there. parked_at proves it only when a walk to the spot set it:
// a timeout presumption stamps the job's clock, which says nothing about the vehicle.
export interface SessionProofs {
  readonly entryConfirmedAt: Date | null;
  readonly parkedAt: Date | null;
  readonly presumedBy: PresumptionEvidence | null;
  readonly parkedAnsweredAt: Date | null;
  readonly presenceConfirmedAt: Date | null;
}

export interface LastProof {
  readonly at: Date;
  readonly kind: LastProofKind;
}

export function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_AFTER_MILLISECONDS);
}

// Null for a session whose entry was never confirmed: nothing proves anything yet, and such a session is never flagged.
export function lastProofOf(proofs: SessionProofs): LastProof | null {
  const found = proofsOf(proofs).filter((proof): proof is LastProof => proof.at !== null);
  return found.reduce<LastProof | null>((newest, proof) => (newest === null || proof.at > newest.at ? proof : newest), null);
}

// The same cut as the SQL: flagged at or before the cutoff, so a proof exactly 7 days old is stale and one a millisecond newer is not.
export function isStale(proofs: SessionProofs, cutoff: Date): boolean {
  const last = lastProofOf(proofs);
  return last !== null && last.at <= cutoff;
}

function proofsOf(proofs: SessionProofs): { readonly at: Date | null; readonly kind: LastProofKind }[] {
  return [
    { at: proofs.entryConfirmedAt, kind: 'ENTRY' },
    { at: proofs.presumedBy === 'WALK' ? proofs.parkedAt : null, kind: 'PARKED_ON_FOOT' },
    { at: proofs.parkedAnsweredAt, kind: 'ANSWERED' },
    { at: proofs.presenceConfirmedAt, kind: 'PRESENCE' },
  ];
}
