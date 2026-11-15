export type EventPayload = Readonly<Record<string, unknown>>;

// A stored payload is read field by field and never trusted whole: a missing or mistyped field is left out, not an error.
export function payloadOf(stored: unknown): EventPayload {
  return typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? (stored as EventPayload) : {};
}

export function textField(payload: EventPayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

export function booleanField(payload: EventPayload, key: string): boolean | undefined {
  const value = payload[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function centsField(payload: EventPayload, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function choiceField<Choice extends string>(payload: EventPayload, key: string, choices: readonly Choice[]): Choice | undefined {
  const value = payload[key];
  return choices.find((choice) => choice === value);
}
