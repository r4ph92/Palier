import { ATTESTATION_NOTE_LENGTH, EARLIEST_ATTESTATION_DAY, type AttestationErrorCode } from '@palier/shared-types/publication';

export type PublicationReason = AttestationErrorCode | 'LOT_NOT_READY';

export const PUBLICATION_MESSAGES: Readonly<Record<PublicationReason, string>> = {
  LOT_NOT_READY: 'The lot cannot go online until every prerequisite is met.',
  ATTESTATION_DAY_INVALID: `Enter the day of the measure as YYYY-MM-DD, from ${EARLIEST_ATTESTATION_DAY}.`,
  ATTESTATION_DAY_IN_FUTURE: 'The day of the measure cannot be after today.',
  ATTESTATION_NOTE_INVALID: `The note must be ${ATTESTATION_NOTE_LENGTH.minimum} to ${ATTESTATION_NOTE_LENGTH.maximum} characters on one line, with no invisible characters.`,
};
