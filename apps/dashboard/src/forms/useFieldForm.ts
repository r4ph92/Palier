import { useState, type FormEvent } from 'react';
import { asDashboardApiError, endsSession, type DashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import { useGuardedRequest } from './useGuardedRequest.ts';

export type FieldValues<Field extends string> = Readonly<Record<Field, string>>;
export type FieldErrorCodes<Field extends string> = Partial<Readonly<Record<Field, DisplayedErrorCode>>>;
export type ReadForm<Field extends string, Value> = { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly errors: FieldErrorCodes<Field> };

export function readFormOf<Field extends string, Value>(value: Value, errors: FieldErrorCodes<Field>): ReadForm<Field, Value> {
  return Object.keys(errors).length === 0 ? { ok: true, value } : { ok: false, errors };
}

export interface FieldFormSetup<Field extends string, Value> {
  readonly initialValues: FieldValues<Field>;
  // The shared rule, run before the request: a form that breaks it sends nothing.
  readonly read: (values: FieldValues<Field>) => ReadForm<Field, Value>;
  readonly send: (value: Value) => Promise<void>;
  readonly fieldOfCode: Partial<Readonly<Record<DisplayedErrorCode, Field>>>;
  // Empties every field once a send succeeds, so the form is ready for the next entry; focus stays on the submit button.
  readonly emptiesOnSuccess?: boolean;
}

export interface FieldForm<Field extends string> {
  readonly values: FieldValues<Field>;
  readonly setValue: (field: Field, value: string) => void;
  readonly errors: FieldErrorCodes<Field>;
  readonly summary: DisplayedErrorCode | null;
  // Changes with each refused submit, so the summary takes focus again even when its text stays the same.
  readonly attempt: number;
  readonly submitting: boolean;
  readonly submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

interface Outcome<Field extends string> {
  readonly errors: FieldErrorCodes<Field>;
  readonly refusal: DisplayedErrorCode | null;
}

const ACCEPTED = { errors: {}, refusal: null } as const;

export function useFieldForm<Field extends string, Value>(setup: FieldFormSetup<Field, Value>): FieldForm<Field> {
  const { values, setValue, outcome, setOutcome, reset } = useFieldValues(setup.initialValues);
  const afterSuccess = setup.emptiesOnSuccess === true ? reset : () => undefined;
  const { attempt, submitting, submit } = useSubmit(values, useSender(setup, { show: setOutcome, afterSuccess }));
  return { values, setValue, errors: outcome.errors, summary: summaryOf(outcome), attempt, submitting, submit };
}

// Editing a field clears its own error only, so the others stay beside their fields until fixed.
function useFieldValues<Field extends string>(initialValues: FieldValues<Field>) {
  const [values, setValues] = useState(initialValues);
  const [outcome, setOutcome] = useState<Outcome<Field>>(ACCEPTED);
  const setValue = (field: Field, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setOutcome((previous) => ({ ...previous, errors: withoutField(previous.errors, field) }));
  };
  const reset = () => {
    setValues(initialValues);
    setOutcome(ACCEPTED);
  };
  return { values, setValue, outcome, setOutcome, reset };
}

function useSubmit<Field extends string>(values: FieldValues<Field>, sendValues: (values: FieldValues<Field>) => Promise<boolean>) {
  const [attempt, setAttempt] = useState(0);
  const request = useGuardedRequest();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await request.run(async () => {
      if (!(await sendValues(values))) {
        setAttempt((previous) => previous + 1);
      }
    });
  };
  return { attempt, submitting: request.busy, submit };
}

interface SenderFollowUps<Field extends string> {
  readonly show: (outcome: Outcome<Field>) => void;
  readonly afterSuccess: () => void;
}

// Reads the form and sends it only when the shared rule accepts it; answers whether the request succeeded.
function useSender<Field extends string, Value>({ read, send, fieldOfCode }: FieldFormSetup<Field, Value>, { show, afterSuccess }: SenderFollowUps<Field>) {
  const refreshSession = useSessionRefresh();
  return async (values: FieldValues<Field>): Promise<boolean> => {
    const readForm = read(values);
    if (!readForm.ok) {
      show({ errors: readForm.errors, refusal: null });
      return false;
    }
    show(ACCEPTED);
    try {
      await send(readForm.value);
      afterSuccess();
      return true;
    } catch (failure) {
      show(refusalOutcome(asDashboardApiError(failure), fieldOfCode, refreshSession));
      return false;
    }
  };
}

// A refusal that names a field goes beside it; any other goes in the summary. A 401 also reads the session again.
function refusalOutcome<Field extends string>(
  error: DashboardApiError,
  fieldOfCode: FieldFormSetup<Field, unknown>['fieldOfCode'],
  refreshSession: () => Promise<void>,
): Outcome<Field> {
  if (endsSession(error)) {
    void refreshSession();
  }
  const field = fieldOfCode[error.code];
  return field === undefined ? { errors: {}, refusal: error.code } : { errors: { [field]: error.code } as FieldErrorCodes<Field>, refusal: null };
}

function summaryOf<Field extends string>({ errors, refusal }: Outcome<Field>): DisplayedErrorCode | null {
  return refusal ?? (Object.keys(errors).length === 0 ? null : 'FIELDS_INVALID');
}

function withoutField<Field extends string>(errors: FieldErrorCodes<Field>, field: Field): FieldErrorCodes<Field> {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field)) as FieldErrorCodes<Field>;
}
