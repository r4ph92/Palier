import { CANCELLATION_REASONS, GATE_DIRECTIONS, PRESUMED_PARKING_EVIDENCES, SESSION_EXIT_METHODS, type TimelineDetails, type TimelineEntry } from '@palier/shared-types/sessionTimeline';
import { SESSION_EVENT_KINDS, type SessionEventKind } from '../sessionEvents/SessionEvent.ts';
import { booleanField, centsField, choiceField, payloadOf, textField, type EventPayload } from './payloadFields.ts';
import type { StoredSessionEvent } from './SessionTimelineRepository.ts';

// What each kind shows, picked field by field: a payload field that is not listed here never leaves the API (decision 042).
const DETAILS_OF: Readonly<Record<SessionEventKind, (payload: EventPayload) => TimelineDetails>> = {
  ENTRY_SCANNED: (payload) => detailsOf({ spotNumber: textField(payload, 'spotNumber') }),
  GATE_OPENED: (payload) => detailsOf({ direction: choiceField(payload, 'direction', GATE_DIRECTIONS) }),
  ENTRY_LOOP_CLOSED: () => ({}),
  AISLE_DETECTED: (payload) => detailsOf({ aisleCode: textField(payload, 'aisleCode'), isAssignedAisle: booleanField(payload, 'isAssignedAisle') }),
  PARKING_PRESUMED: (payload) => detailsOf({ evidence: choiceField(payload, 'evidence', PRESUMED_PARKING_EVIDENCES), spotNumber: textField(payload, 'spotNumber') }),
  PARKING_CONFIRMED: (payload) => detailsOf({ spotNumber: textField(payload, 'spotNumber') }),
  ENTRY_CANCELLED: (payload) => detailsOf({ reason: choiceField(payload, 'reason', CANCELLATION_REASONS) }),
  EXIT_IDENTIFIED: (payload) => detailsOf({ method: choiceField(payload, 'method', SESSION_EXIT_METHODS) }),
  CAPTURED: (payload) => detailsOf({ amountCents: amountWithSurplusOf(payload, 'capturedCents', 'surplusPaidCents'), unpaidCents: centsField(payload, 'unpaidCents') }),
  CAPTURE_PENDING: (payload) => detailsOf({ amountCents: amountWithSurplusOf(payload, 'pendingCaptureCents', 'pendingSurplusCents') }),
  EXIT_LOOP_CLOSED: () => ({}),
  PRESENCE_CONFIRMED: () => ({}),
  CLOSED_BY_STAFF: () => ({}),
};

// The steps in the order they were written; the clock of a step never orders them (decision 037).
export function timelineOf(events: readonly StoredSessionEvent[]): TimelineEntry[] {
  return [...events].sort((left, right) => left.sequence - right.sequence).map((event, index) => timelineEntryOf(event, index + 1));
}

function timelineEntryOf({ kind, occurredAt, payload }: StoredSessionEvent, step: number): TimelineEntry {
  const base = { step, occurredAt: occurredAt.toISOString() };
  return isKnownKind(kind) ? { ...base, kind, details: DETAILS_OF[kind](payloadOf(payload)) } : { ...base, kind: 'UNKNOWN', details: {} };
}

function isKnownKind(kind: string): kind is SessionEventKind {
  return (SESSION_EVENT_KINDS as readonly string[]).includes(kind);
}

function amountWithSurplusOf(payload: EventPayload, mainKey: string, surplusKey: string): number | undefined {
  const main = centsField(payload, mainKey);
  return main === undefined ? undefined : main + (centsField(payload, surplusKey) ?? 0);
}

function detailsOf(fields: { readonly [Field in keyof TimelineDetails]: TimelineDetails[Field] | undefined }): TimelineDetails {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}
