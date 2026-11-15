import type { ScriptedSql } from './scriptedSql.ts';

export interface AppendedSessionEvent {
  readonly sessionId: unknown;
  readonly lotId: unknown;
  readonly kind: unknown;
  readonly payload: Record<string, unknown>;
  readonly occurredAtText: string;
  readonly transactionNumber: number | null;
}

// appendSessionEvent binds the session, the lot, the kind and the JSON payload first, in that order.
export function appendedSessionEvents(scripted: ScriptedSql): AppendedSessionEvent[] {
  return scripted.statements
    .filter(({ label }) => label === 'append-session-event')
    .map(({ params, text, transactionNumber }) => ({
      sessionId: params[0],
      lotId: params[1],
      kind: params[2],
      payload: JSON.parse(String(params[3])) as Record<string, unknown>,
      occurredAtText: text.slice(text.lastIndexOf('from (select')),
      transactionNumber,
    }));
}

export function onlyAppendedSessionEvent(scripted: ScriptedSql): AppendedSessionEvent {
  const events = appendedSessionEvents(scripted);
  if (events.length !== 1) {
    throw new Error(`Expected one appended session event, found ${events.length}.`);
  }
  return events[0] as AppendedSessionEvent;
}

export interface BuiltPayload {
  readonly kind: string;
  readonly keys: string[];
}

// One level of parentheses inside the object, for a value such as exists (select …).
const KIND_THEN_BUILT_OBJECT = /'([A-Z_]+)', jsonb_build_object\(((?:[^()]|\([^()]*\))*)\)/g;

// The kind and keys of every payload a statement builds from the rows it writes: 'KIND', jsonb_build_object(key, value, key, value).
export function builtPayloads(text: string): BuiltPayload[] {
  return [...text.matchAll(KIND_THEN_BUILT_OBJECT)].map(([, kind, pairs]) => ({
    kind: kind ?? '',
    keys: (pairs ?? '')
      .split(', ')
      .filter((_item, index) => index % 2 === 0)
      .map((key) => key.replaceAll("'", '')),
  }));
}
