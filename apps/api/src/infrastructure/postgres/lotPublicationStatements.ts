import { sql, type SQL } from 'drizzle-orm';
import { ATTESTATION_TIME_ZONE } from '@palier/shared-types/publication';
import type { AttestationKind, LotAttestation } from '../../domain/publication/LotPublicationRepository.ts';
import { liveSpot } from './liveSpot.ts';

// One statement for the whole checklist; a day attested is read back as the operator entered it, on Montréal's calendar.
export function readPublicationFactsStatement(operatorId: string, lotId: string): SQL {
  return sql`
    select parking_lot.name as lot_name, parking_lot.is_online, operator.kyc_status, parking_lot.daily_cap_cents, parking_lot.capacity,
      (select count(*)::int from spot where spot.lot_id = parking_lot.id and ${liveSpot()} and spot.state <> 'OUT_OF_SERVICE') as in_service_spot_count,
      to_char(parking_lot.wifi_verified_at at time zone ${ATTESTATION_TIME_ZONE}, 'YYYY-MM-DD') as wifi_measured_on, parking_lot.wifi_note,
      to_char(parking_lot.cell_verified_at at time zone ${ATTESTATION_TIME_ZONE}, 'YYYY-MM-DD') as cell_measured_on, parking_lot.cell_note,
      coalesce((
        select json_agg(json_build_object('id', gate.id, 'name', gate.name, 'kind', gate.kind, 'verified_at', gate.verified_at) order by gate.kind, gate.name)
        from gate where gate.lot_id = parking_lot.id), '[]'::json) as gates
    from parking_lot
    join operator on operator.id = parking_lot.operator_id
    where parking_lot.id = ${lotId} and parking_lot.operator_id = ${operatorId}`;
}

// Run under the owned lot's lock, after the checklist was judged on the same transaction.
export function setLotOnlineStatement(lotId: string, online: boolean): SQL {
  return sql`update parking_lot set is_online = ${online} where id = ${lotId}`;
}

// Fixed column names, never input: the kind only picks which pair of columns the attestation fills.
const ATTESTATION_COLUMNS: Readonly<Record<AttestationKind, { readonly day: SQL; readonly note: SQL }>> = {
  WIFI: { day: sql.raw('wifi_verified_at'), note: sql.raw('wifi_note') },
  CELLULAR: { day: sql.raw('cell_verified_at'), note: sql.raw('cell_note') },
};

// The day is stored as its midnight in Montréal, the instant the existing verified_at columns hold.
export function attestStatement(lotId: string, { kind, measuredOn, note }: LotAttestation): SQL {
  const columns = ATTESTATION_COLUMNS[kind];
  return sql`
    update parking_lot set ${columns.day} = (${measuredOn}::date)::timestamp at time zone ${ATTESTATION_TIME_ZONE}, ${columns.note} = ${note}
    where id = ${lotId}`;
}
