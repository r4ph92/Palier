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

// The keys of every jsonb_build_object in a statement, for payloads built from the rows the statement writes: key, value, key, value.
export function builtPayloadKeys(text: string): string[][] {
  return [...text.matchAll(/jsonb_build_object\(([^)]*)\)/g)].map(([, pairs]) =>
    (pairs ?? '')
      .split(', ')
      .filter((_item, index) => index % 2 === 0)
      .map((key) => key.replaceAll("'", '')),
  );
}
