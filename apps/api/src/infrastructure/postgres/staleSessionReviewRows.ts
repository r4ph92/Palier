import type { StaleSessionListRead, StaleSessionRecord } from '../../domain/dashboard/StaleSessionReviewRepository.ts';
import type { PresumptionEvidence } from '../../domain/parkingSessions/PresumptionEvidence.ts';

interface StaleSessionColumns {
  readonly id: string;
  readonly plate: string;
  readonly number: string;
  readonly aisle_code: string;
  readonly level_code: string;
  readonly entry_confirmed_at: Date | string | null;
  readonly parked_at: Date | string | null;
  readonly presumed_by: PresumptionEvidence | null;
  readonly parked_answered_at: Date | string | null;
  readonly presence_confirmed_at: Date | string | null;
  readonly stale_flagged_at: Date | string;
}

type NoSessionColumns = { readonly [Column in keyof StaleSessionColumns]: null };

export type StaleSessionRow = Record<string, unknown> & { readonly lot_name: string } & (StaleSessionColumns | NoSessionColumns);

// No row: the lot is not the operator's. A lot with no flagged session comes back as one row of null columns, which still names the lot.
export function staleSessionListOf(rows: readonly StaleSessionRow[]): StaleSessionListRead | null {
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  return { lotName: first.lot_name, sessions: rows.flatMap(staleSessionOf) };
}

function instantOf(value: Date | string | null): Date | null {
  return value === null ? null : new Date(value);
}

function staleSessionOf(row: StaleSessionRow): StaleSessionRecord[] {
  if (row.id === null) {
    return [];
  }
  return [
    {
      id: row.id,
      plate: row.plate,
      spot: { number: row.number, levelCode: row.level_code, aisleCode: row.aisle_code },
      proofs: {
        entryConfirmedAt: instantOf(row.entry_confirmed_at),
        parkedAt: instantOf(row.parked_at),
        presumedBy: row.presumed_by,
        parkedAnsweredAt: instantOf(row.parked_answered_at),
        presenceConfirmedAt: instantOf(row.presence_confirmed_at),
      },
      flaggedAt: new Date(row.stale_flagged_at),
    },
  ];
}
