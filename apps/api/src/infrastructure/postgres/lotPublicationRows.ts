import type { Attestation, GateKind, KycStatus, PublicationGate } from '@palier/shared-types';
import type { PublicationFacts } from '../../domain/publication/lotPrerequisites.ts';

interface GateCell {
  readonly id: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly verified_at: string | null;
}

export interface PublicationFactsRow extends Record<string, unknown> {
  readonly lot_name: string;
  readonly is_online: boolean;
  readonly kyc_status: KycStatus;
  readonly daily_cap_cents: number | null;
  readonly capacity: number;
  readonly in_service_spot_count: number;
  readonly wifi_measured_on: string | null;
  readonly wifi_note: string | null;
  readonly cell_measured_on: string | null;
  readonly cell_note: string | null;
  readonly gates: readonly GateCell[];
}

export function publicationFactsOf(lotId: string, row: PublicationFactsRow): PublicationFacts {
  return {
    lotId,
    lotName: row.lot_name,
    isOnline: row.is_online,
    stripe: { kycStatus: row.kyc_status },
    pricing: { dailyCapCents: row.daily_cap_cents },
    spots: { inServiceCount: row.in_service_spot_count, capacity: row.capacity },
    wifi: attestationOf(row.wifi_measured_on, row.wifi_note),
    cellular: attestationOf(row.cell_measured_on, row.cell_note),
    gates: row.gates.map(publicationGateOf),
  };
}

// The constraint keeps the day and the note together; either one missing reads as not attested.
function attestationOf(measuredOn: string | null, note: string | null): Attestation | null {
  return measuredOn === null || note === null ? null : { measuredOn, note };
}

// JSON carries the instant with the session's offset: the API answers it in UTC like every other instant.
function publicationGateOf({ id, name, kind, verified_at }: GateCell): PublicationGate {
  return { id, name, kind, verifiedAt: verified_at === null ? null : new Date(verified_at).toISOString() };
}
