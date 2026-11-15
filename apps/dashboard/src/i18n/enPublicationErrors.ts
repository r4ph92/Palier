import type { frPublicationErrors } from './frPublicationErrors.ts';

export const enPublicationErrors: typeof frPublicationErrors = {
  LOT_NOT_READY: 'A prerequisite is still missing: the parking lot stays offline. The list was read again.',
  ATTESTATION_DAY_INVALID: 'Enter a real date, from %{earliestDay}.',
  ATTESTATION_DAY_IN_FUTURE: 'The date of the measure cannot be after today.',
  ATTESTATION_NOTE_INVALID: 'The note must be 1 to %{noteMaximum} characters on one line, with no invisible characters.',
};
