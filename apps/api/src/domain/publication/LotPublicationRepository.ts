import type { Attestation, AttestationKind, DashboardErrorCode } from '@palier/shared-types';
import type { PublicationFacts } from './lotPrerequisites.ts';

export interface LotAttestation extends Attestation {
  readonly kind: AttestationKind;
}

export type PublicationRefusal = Extract<DashboardErrorCode, 'LOT_NOT_FOUND' | 'LOT_BUSY' | 'LOT_NOT_READY'>;

export type PublicationWrite = 'written' | PublicationRefusal;

// now frees the spots of the holds an unpublish ends.
export interface OnlineChange {
  readonly online: boolean;
  readonly now: Date;
}

// Every statement names the operator: another operator's lot is LOT_NOT_FOUND before any of its rows is read.
export interface LotPublicationRepository {
  // Null when the operator has no lot with this id.
  readPublicationFacts(operatorId: string, lotId: string): Promise<PublicationFacts | null>;
  attest(operatorId: string, lotId: string, attestation: LotAttestation): Promise<PublicationWrite>;
  // Going online judges the prerequisites under the lot lock: anything missing is LOT_NOT_READY and nothing changes.
  // Going offline is always allowed, and releases the lot's active spot holds in the same transaction.
  changeOnline(operatorId: string, lotId: string, change: OnlineChange): Promise<PublicationWrite>;
}
