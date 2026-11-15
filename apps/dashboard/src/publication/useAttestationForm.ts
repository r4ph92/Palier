import type { Attestation, AttestationErrorCode, AttestationField, LotPublication } from '@palier/shared-types';
import { ATTESTATION_NOTE_LENGTH, ATTESTATION_TIME_ZONE, attestationErrors, calendarDayIn, EARLIEST_ATTESTATION_DAY } from '@palier/shared-types/publication';
import { dashboardClient } from '../api/dashboardClient.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { formatCalendarDay, formatCount } from '../i18n/formatNumbers.ts';
import type { Language } from '../i18n/LanguageContext.tsx';

export type AttestationKind = 'WIFI' | 'CELLULAR';

export interface AttestationTarget {
  readonly lotId: string;
  readonly kind: AttestationKind;
  readonly attestation: Attestation | null;
  readonly onSaved: (publication: LotPublication) => void;
}

const FIELD_OF_CODE: Readonly<Record<AttestationErrorCode, AttestationField>> = {
  ATTESTATION_DAY_INVALID: 'measuredOn',
  ATTESTATION_DAY_IN_FUTURE: 'measuredOn',
  ATTESTATION_NOTE_INVALID: 'note',
};

const SEND_BY_KIND: Readonly<Record<AttestationKind, (lotId: string, attestation: Attestation) => Promise<LotPublication>>> = {
  WIFI: dashboardClient.attestWifi,
  CELLULAR: dashboardClient.attestCellular,
};

const NOT_MEASURED: FieldValues<AttestationField> = { measuredOn: '', note: '' };

// Filled once from the checklist: a later poll never overwrites what the operator is typing.
export function useAttestationForm({ lotId, kind, attestation, onSaved }: AttestationTarget): FieldForm<AttestationField> {
  const send = async (request: Attestation) => onSaved(await SEND_BY_KIND[kind](lotId, request));
  return useFieldForm({ initialValues: attestation ?? NOT_MEASURED, read: readAttestation, send, fieldOfCode: FIELD_OF_CODE });
}

// Today is Montréal's day, as on the API: the lots are in Québec whatever the operator's computer says.
function readAttestation(values: FieldValues<AttestationField>): ReadForm<AttestationField, Attestation> {
  const attestation: Attestation = { measuredOn: values.measuredOn.trim(), note: values.note };
  return readFormOf(attestation, attestationErrors(attestation, calendarDayIn(ATTESTATION_TIME_ZONE, new Date())));
}

export function attestationMessageValues(language: Language): Readonly<Record<string, string>> {
  return { earliestDay: formatCalendarDay(EARLIEST_ATTESTATION_DAY, language), noteMaximum: formatCount(ATTESTATION_NOTE_LENGTH.maximum, language) };
}
