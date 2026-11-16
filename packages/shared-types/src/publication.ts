import type { KycStatus } from './dashboard.ts';
import { isValidDisplayText } from './displayText.ts';
import { fieldErrorsOf, type FieldErrors } from './fieldErrors.ts';
import type { GateKind } from './gates.ts';

export const ATTESTATION_NOTE_LENGTH = { minimum: 1, maximum: 300 } as const;
export const EARLIEST_ATTESTATION_DAY = '2020-01-01';
// The lots are in Québec: the day the operator measured is a day on Montréal's calendar.
export const ATTESTATION_TIME_ZONE = 'America/Toronto';

export const PUBLICATION_ERROR_CODES = ['LOT_NOT_READY', 'ATTESTATION_DAY_INVALID', 'ATTESTATION_DAY_IN_FUTURE', 'ATTESTATION_NOTE_INVALID'] as const;

export const ATTESTATION_KINDS = ['WIFI', 'CELLULAR'] as const;
export type AttestationKind = (typeof ATTESTATION_KINDS)[number];
// The last segment of each kind's dashboard route.
export const ATTESTATION_PATH_SEGMENTS = { WIFI: 'wifi', CELLULAR: 'cellular' } as const satisfies Readonly<Record<AttestationKind, string>>;

export type AttestationErrorCode = Exclude<(typeof PUBLICATION_ERROR_CODES)[number], 'LOT_NOT_READY'>;

// What the operator measured on site: the day, as YYYY-MM-DD, and a note on how and where.
export interface Attestation {
  readonly measuredOn: string;
  readonly note: string;
}

export type AttestationField = keyof Attestation;
export type AttestationErrors = FieldErrors<AttestationField, AttestationErrorCode>;

export const MISSING_PREREQUISITE_CODES = [
  'STRIPE_NOT_VERIFIED',
  'PRICING_MISSING',
  'CAPACITY_ZERO',
  'NO_SPOT_IN_SERVICE',
  'WIFI_NOT_ATTESTED',
  'CELLULAR_NOT_ATTESTED',
  'ENTRY_GATE_MISSING',
  'EXIT_GATE_MISSING',
  'GATE_UNVERIFIED',
] as const;

export type MissingPrerequisiteCode = (typeof MISSING_PREREQUISITE_CODES)[number];

// gateId names the unverified gate; it is null for every other code.
export interface MissingPrerequisite {
  readonly code: MissingPrerequisiteCode;
  readonly gateId: string | null;
}

export interface PublicationGate {
  readonly id: string;
  readonly name: string;
  readonly kind: GateKind;
  // When its controller passed the test passage; null until then, and again after a change that could break it.
  readonly verifiedAt: string | null;
}

// The checklist as facts: the dashboard words, formats and localises every line itself.
export interface LotPublication {
  readonly lotId: string;
  readonly lotName: string;
  readonly isOnline: boolean;
  readonly stripe: { readonly kycStatus: KycStatus };
  readonly pricing: { readonly dailyCapCents: number | null };
  readonly spots: { readonly inServiceCount: number; readonly capacity: number };
  readonly wifi: Attestation | null;
  readonly cellular: Attestation | null;
  // Entry gates first, then by name.
  readonly gates: readonly PublicationGate[];
  // Empty exactly when the lot can go online, in the checklist's order.
  readonly missing: readonly MissingPrerequisite[];
}

export interface LotOnlineRequest {
  readonly online: boolean;
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

// A real day of the calendar: 2026-02-30 has the shape but is no day.
export function isCalendarDay(text: string): boolean {
  if (!CALENDAR_DAY.test(text)) {
    return false;
  }
  const day = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(text);
}

// The day a moment falls on in the time zone, as YYYY-MM-DD.
export function calendarDayIn(timeZone: string, moment: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(moment);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// today is a YYYY-MM-DD day, which compares with another in calendar order.
export function attestationErrors({ measuredOn, note }: Attestation, today: string): AttestationErrors {
  return fieldErrorsOf<AttestationField, AttestationErrorCode>([
    ['measuredOn', measuredOnErrorOf(measuredOn, today)],
    ['note', isValidDisplayText(note, ATTESTATION_NOTE_LENGTH) ? null : 'ATTESTATION_NOTE_INVALID'],
  ]);
}

function measuredOnErrorOf(measuredOn: string, today: string): AttestationErrorCode | null {
  if (!isCalendarDay(measuredOn) || measuredOn < EARLIEST_ATTESTATION_DAY) {
    return 'ATTESTATION_DAY_INVALID';
  }
  return measuredOn > today ? 'ATTESTATION_DAY_IN_FUTURE' : null;
}
