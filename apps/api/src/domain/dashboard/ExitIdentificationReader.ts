import type { SessionExitMethod } from '@palier/shared-types/sessionTimeline';

export type RecordedExitCounts = Readonly<Record<SessionExitMethod, number>>;

export interface ExitCountsRead {
  readonly lotName: string;
  readonly counts: RecordedExitCounts;
}

export interface ExitIdentificationReader {
  // The exits of the lot since the cutoff, by the way the vehicle was identified; null when the operator has no lot with this id.
  readExitCounts(operatorId: string, lotId: string, since: Date): Promise<ExitCountsRead | null>;
}
