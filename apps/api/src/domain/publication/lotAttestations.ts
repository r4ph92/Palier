import type { Attestation, AttestationKind, LotPublication } from '@palier/shared-types';
import { canonicalNameOf } from '@palier/shared-types/displayText';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { ATTESTATION_TIME_ZONE, attestationErrors, calendarDayIn } from '@palier/shared-types/publication';
import { DashboardRefusedError } from '../dashboard/DashboardRefusedError.ts';
import { operatorIdOfMember, type MemberLot } from '../dashboard/memberOperator.ts';
import { readOwnedPublication, refuseUnwritten, type LotPublicationSources } from './lotPublication.ts';

export interface MemberAttestation extends MemberLot {
  readonly kind: AttestationKind;
  readonly attestation: Attestation;
}

// The operator's word for what they measured on site (OQ8): a new attestation replaces the last one.
// The rule runs before any read, so a refused body says nothing about the lot.
export async function attestOfMember(sources: LotPublicationSources, request: MemberAttestation): Promise<LotPublication> {
  const attestation = validatedAttestation(request.attestation, calendarDayIn(ATTESTATION_TIME_ZONE, sources.clock()));
  const operatorId = await operatorIdOfMember(sources.operators, request);
  refuseUnwritten(await sources.publication.attest(operatorId, request.lotId, { kind: request.kind, ...attestation }));
  return readOwnedPublication(sources.publication, operatorId, request.lotId);
}

// Built from its own keys only, the note stored as it reads: accents composed and every run of spaces one plain space.
function validatedAttestation({ measuredOn, note }: Attestation, today: string): Attestation {
  const attestation = { measuredOn, note: canonicalNameOf(note) };
  const refusal = firstFieldError(attestationErrors(attestation, today));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return attestation;
}
